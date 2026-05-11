"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const backendRoot = path.resolve(__dirname, "..");

const routesModulePath = path.join(backendRoot, "src/routes/auth.routes.js");
const controllerModulePath = path.join(
  backendRoot,
  "src/controllers/auth.controller.js",
);
const requireAuthModulePath = path.join(
  backendRoot,
  "src/middleware/requireAuth.js",
);
const requireCsrfModulePath = path.join(
  backendRoot,
  "src/middleware/requireCsrf.js",
);
const authServiceModulePath = path.join(
  backendRoot,
  "src/services/auth.service.js",
);
const sessionsServiceModulePath = path.join(
  backendRoot,
  "src/services/sessions.service.js",
);
const passwordResetServiceModulePath = path.join(
  backendRoot,
  "src/services/passwordReset.service.js",
);
const sessionCookieModulePath = path.join(
  backendRoot,
  "src/utils/sessionCookie.js",
);

function clearRequireCache() {
  delete require.cache[routesModulePath];
  delete require.cache[controllerModulePath];
  delete require.cache[requireAuthModulePath];
  delete require.cache[requireCsrfModulePath];
  delete require.cache[authServiceModulePath];
  delete require.cache[sessionsServiceModulePath];
  delete require.cache[passwordResetServiceModulePath];
  delete require.cache[sessionCookieModulePath];
}

function buildTestApp({ authContext, serviceStubs }) {
  clearRequireCache();

  require.cache[requireAuthModulePath] = {
    id: requireAuthModulePath,
    filename: requireAuthModulePath,
    loaded: true,
    exports: {
      requireAuth: (req, res, next) => {
        req.user = authContext?.user ?? { id: 1 };
        req.session = authContext?.session ?? {
          sessionToken: "sess-1",
          csrfToken: "csrf-1",
          expiresAt: new Date().toISOString(),
        };
        next();
      },
    },
  };

  require.cache[requireCsrfModulePath] = {
    id: requireCsrfModulePath,
    filename: requireCsrfModulePath,
    loaded: true,
    exports: {
      requireCsrf: (req, res, next) => {
        if (req.get("x-csrf-token") === req.session?.csrfToken) return next();
        return res.status(403).json({ error: "Invalid CSRF token" });
      },
    },
  };

  require.cache[authServiceModulePath] = {
    id: authServiceModulePath,
    filename: authServiceModulePath,
    loaded: true,
    exports: {
      register: serviceStubs.register,
      login: serviceStubs.login,
      resetPassword: serviceStubs.resetPassword,
      changePassword: serviceStubs.changePassword,
      updateBeekeeperAlertSettings: serviceStubs.updateBeekeeperAlertSettings,
      deleteUserAndSessions: serviceStubs.deleteUserAndSessions,
    },
  };

  require.cache[sessionsServiceModulePath] = {
    id: sessionsServiceModulePath,
    filename: sessionsServiceModulePath,
    loaded: true,
    exports: {
      invalidateSession: serviceStubs.invalidateSession,
    },
  };

  require.cache[passwordResetServiceModulePath] = {
    id: passwordResetServiceModulePath,
    filename: passwordResetServiceModulePath,
    loaded: true,
    exports: {
      requestResetForEmail: serviceStubs.requestResetForEmail,
      verifyResetToken: serviceStubs.verifyResetToken,
      consumeResetTokenForBeekeeper:
        serviceStubs.consumeResetTokenForBeekeeper,
    },
  };

  require.cache[sessionCookieModulePath] = {
    id: sessionCookieModulePath,
    filename: sessionCookieModulePath,
    loaded: true,
    exports: {
      setSessionCookie: (res, token) => {
        res.set("x-session-token", token);
      },
      clearSessionCookie: (res) => {
        res.set("x-session-cleared", "1");
      },
    },
  };

  const routes = require(routesModulePath);
  const app = express();
  app.use(express.json());
  app.use("/api/auth", routes);
  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });
  return app;
}

function noops() {
  return {
    register: async () => ({
      user: { id: 1, username: "u", email: "u@example.com" },
      session: { sessionToken: "sess-1", csrfToken: "csrf-1" },
    }),
    login: async () => ({
      user: { id: 1, username: "u", email: "u@example.com" },
      session: { sessionToken: "sess-1", csrfToken: "csrf-1" },
    }),
    resetPassword: async () => { },
    changePassword: async () => { },
    updateBeekeeperAlertSettings: async () => ({
      alertsEnabled: true,
      warningLow: 90,
      warningHigh: 100,
      criticalLow: 85,
      criticalHigh: 105,
      updatedAt: new Date().toISOString(),
    }),
    deleteUserAndSessions: async () => { },
    invalidateSession: async () => { },
    requestResetForEmail: async () => { },
    verifyResetToken: async () => ({ beekeeperId: 1 }),
    consumeResetTokenForBeekeeper: async () => { },
  };
}

test("POST /api/auth/register returns 400 when required fields are missing", async () => {
  const app = buildTestApp({ authContext: null, serviceStubs: noops() });

  const res = await request(app)
    .post("/api/auth/register")
    .send({ username: "user" })
    .expect(400);

  assert.equal(res.body.error, "username, email, and password are required");
});

test("POST /api/auth/register trims inputs and returns user+csrf", async () => {
  let captured = null;
  const stubs = noops();
  stubs.register = async (input) => {
    captured = input;
    return {
      user: { id: 2, username: input.username, email: input.email },
      session: { sessionToken: "sess-2", csrfToken: "csrf-2" },
    };
  };

  const app = buildTestApp({ authContext: null, serviceStubs: stubs });

  const res = await request(app)
    .post("/api/auth/register")
    .send({
      username: "  beek  ",
      email: "  beek@example.com ",
      password: "  secret  ",
    })
    .expect(201);

  assert.deepEqual(captured, {
    username: "beek",
    email: "beek@example.com",
    password: "  secret  ",
    context: undefined,
  });

  assert.equal(res.body.user.id, 2);
  assert.equal(res.body.csrfToken, "csrf-2");
  assert.equal(res.headers["x-session-token"], "sess-2");
});

test("POST /api/auth/login accepts identifier and returns user+csrf", async () => {
  let captured = null;
  const stubs = noops();
  stubs.login = async (input) => {
    captured = input;
    return {
      user: { id: 3, username: "beek", email: "beek@example.com" },
      session: { sessionToken: "sess-3", csrfToken: "csrf-3" },
    };
  };

  const app = buildTestApp({ authContext: null, serviceStubs: stubs });

  const res = await request(app)
    .post("/api/auth/login")
    .send({ identifier: " beek ", password: "password123" })
    .expect(200);

  assert.deepEqual(captured, {
    identifier: "beek",
    password: "password123",
    context: undefined,
  });
  assert.equal(res.body.user.username, "beek");
  assert.equal(res.body.csrfToken, "csrf-3");
  assert.equal(res.headers["x-session-token"], "sess-3");
});

test("POST /api/auth/login accepts legacy email field", async () => {
  let captured = null;
  const stubs = noops();
  stubs.login = async (input) => {
    captured = input;
    return {
      user: { id: 4, username: "beek", email: input.identifier },
      session: { sessionToken: "sess-4", csrfToken: "csrf-4" },
    };
  };

  const app = buildTestApp({ authContext: null, serviceStubs: stubs });

  await request(app)
    .post("/api/auth/login")
    .send({ email: " beek@example.com ", password: "password123" })
    .expect(200);

  assert.deepEqual(captured, {
    identifier: "beek@example.com",
    password: "password123",
    context: undefined,
  });
});

test("POST /api/auth/logout invalidates session and clears cookie", async () => {
  const calls = [];
  const stubs = noops();
  stubs.invalidateSession = async ({ sessionToken }) => {
    calls.push(sessionToken);
  };

  const app = buildTestApp({
    authContext: {
      user: { id: 9 },
      session: {
        sessionToken: "sess-9",
        csrfToken: "csrf-9",
        expiresAt: new Date().toISOString(),
      },
    },
    serviceStubs: stubs,
  });

  const res = await request(app)
    .post("/api/auth/logout")
    .set("x-csrf-token", "csrf-9")
    .expect(200);

  assert.deepEqual(calls, ["sess-9"]);
  assert.equal(res.body.success, true);
  assert.equal(res.headers["x-session-cleared"], "1");
});

test("POST /api/auth/reset-password/confirm returns 400 for invalid token", async () => {
  const stubs = noops();
  stubs.verifyResetToken = async () => null;

  const app = buildTestApp({ authContext: null, serviceStubs: stubs });

  const res = await request(app)
    .post("/api/auth/reset-password/confirm")
    .send({ token: "bad", newPassword: "newpass123" })
    .expect(400);

  assert.equal(res.body.error, "Invalid or expired reset token");
});

test("DELETE /api/auth/me returns 204 and clears cookie", async () => {
  const calls = [];
  const stubs = noops();
  stubs.deleteUserAndSessions = async (input) => {
    calls.push(input);
  };

  const app = buildTestApp({
    authContext: {
      user: { id: 33 },
      session: {
        sessionToken: "sess-33",
        csrfToken: "csrf-33",
        expiresAt: new Date().toISOString(),
      },
    },
    serviceStubs: stubs,
  });

  const res = await request(app)
    .delete("/api/auth/me")
    .set("x-csrf-token", "csrf-33")
    .expect(204);

  assert.deepEqual(calls, [{ userId: 33, requesterId: 33 }]);
  assert.equal(res.headers["x-session-cleared"], "1");
});

test("PATCH /api/auth/alert-settings forwards settings and returns payload", async () => {
  let captured = null;
  const stubs = noops();
  stubs.updateBeekeeperAlertSettings = async (input) => {
    captured = input;
    return {
      alertsEnabled: false,
      warningLow: 91,
      warningHigh: 99,
      criticalLow: 88,
      criticalHigh: 103,
      updatedAt: "2026-03-31T12:00:00.000Z",
    };
  };

  const app = buildTestApp({
    authContext: {
      user: { id: 42 },
      session: {
        sessionToken: "sess-42",
        csrfToken: "csrf-42",
        expiresAt: new Date().toISOString(),
      },
    },
    serviceStubs: stubs,
  });

  const res = await request(app)
    .patch("/api/auth/alert-settings")
    .set("x-csrf-token", "csrf-42")
    .send({
      alerts_enabled: false,
      warning_low_threshold: 91,
      warning_high_threshold: 99,
      critical_low_threshold: 88,
      critical_high_threshold: 103,
    })
    .expect(200);

  assert.deepEqual(captured, {
    userId: 42,
    alertsEnabled: false,
    warningLow: 91,
    warningHigh: 99,
    criticalLow: 88,
    criticalHigh: 103,
  });
  assert.equal(res.body.alert_settings.critical_high_threshold, 103);
  assert.equal(res.body.alert_settings.alerts_enabled, false);
});

test("PATCH /api/auth/alert-settings accepts nested alert_settings payload", async () => {
  let captured = null;
  const stubs = noops();
  stubs.updateBeekeeperAlertSettings = async (input) => {
    captured = input;
    return {
      alertsEnabled: true,
      warningLow: 92,
      warningHigh: 98,
      criticalLow: 89,
      criticalHigh: 104,
      updatedAt: "2026-03-31T13:00:00.000Z",
    };
  };

  const app = buildTestApp({
    authContext: {
      user: { id: 42 },
      session: {
        sessionToken: "sess-42",
        csrfToken: "csrf-42",
        expiresAt: new Date().toISOString(),
      },
    },
    serviceStubs: stubs,
  });

  const res = await request(app)
    .patch("/api/auth/alert-settings")
    .set("x-csrf-token", "csrf-42")
    .send({
      alert_settings: {
        alerts_enabled: true,
        warning_low_threshold: 92,
        warning_high_threshold: 98,
        critical_low_threshold: 89,
        critical_high_threshold: 104,
      },
    })
    .expect(200);

  assert.deepEqual(captured, {
    userId: 42,
    alertsEnabled: true,
    warningLow: 92,
    warningHigh: 98,
    criticalLow: 89,
    criticalHigh: 104,
  });
  assert.equal(res.body.alert_settings.warning_low_threshold, 92);
  assert.equal(res.body.alert_settings.updated_at, "2026-03-31T13:00:00.000Z");
});
