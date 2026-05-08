"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const backendRoot = path.resolve(__dirname, "..");

const routesModulePath = path.join(
  backendRoot,
  "src/routes/sessions.routes.js",
);
const controllerModulePath = path.join(
  backendRoot,
  "src/controllers/session.controller.js",
);
const requireAuthModulePath = path.join(
  backendRoot,
  "src/middleware/requireAuth.js",
);
const requireCsrfModulePath = path.join(
  backendRoot,
  "src/middleware/requireCsrf.js",
);
const sessionServiceModulePath = path.join(
  backendRoot,
  "src/services/sessions.service.js",
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
  delete require.cache[sessionServiceModulePath];
  delete require.cache[sessionCookieModulePath];
}

function buildTestApp({ authContext, enforceCsrf = true, serviceStubs }) {
  clearRequireCache();

  require.cache[requireAuthModulePath] = {
    id: requireAuthModulePath,
    filename: requireAuthModulePath,
    loaded: true,
    exports: {
      requireAuth: (req, res, next) => {
        req.user = authContext.user;
        req.session = authContext.session;
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
        if (!enforceCsrf) return next();
        if (req.get("x-csrf-token") === req.session?.csrfToken) return next();
        return res.status(403).json({ error: "Invalid CSRF token" });
      },
    },
  };

  require.cache[sessionServiceModulePath] = {
    id: sessionServiceModulePath,
    filename: sessionServiceModulePath,
    loaded: true,
    exports: {
      invalidateSession: serviceStubs.invalidateSession,
      invalidateAllSessionsForUser: serviceStubs.invalidateAllSessionsForUser,
    },
  };

  require.cache[sessionCookieModulePath] = {
    id: sessionCookieModulePath,
    filename: sessionCookieModulePath,
    loaded: true,
    exports: {
      clearSessionCookie: (res) => {
        res.set("x-session-cleared", "1");
      },
    },
  };

  const routes = require(routesModulePath);
  const app = express();
  app.use(express.json());
  app.use("/api/sessions", routes);

  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });

  return app;
}

test("GET /api/sessions/current returns current user and ISO expiration", async () => {
  const app = buildTestApp({
    authContext: {
      user: { id: 12, username: "beekeeper" },
      session: {
        sessionToken: "s-token",
        csrfToken: "csrf-abc",
        expiresAt: "2026-04-01T10:00:00.000Z",
      },
    },
    serviceStubs: {
      invalidateSession: async () => {},
      invalidateAllSessionsForUser: async () => {},
    },
  });

  const res = await request(app).get("/api/sessions/current").expect(200);

  assert.equal(res.body.user.id, 12);
  assert.equal(res.body.session.expiresAt, "2026-04-01T10:00:00.000Z");
});

test("DELETE /api/sessions/current invalidates current session and clears cookie", async () => {
  const calls = [];

  const app = buildTestApp({
    authContext: {
      user: { id: 12 },
      session: {
        sessionToken: "tok-123",
        csrfToken: "csrf-abc",
        expiresAt: "2026-04-01T10:00:00.000Z",
      },
    },
    serviceStubs: {
      invalidateSession: async ({ sessionToken }) => {
        calls.push(sessionToken);
      },
      invalidateAllSessionsForUser: async () => {},
    },
  });

  const res = await request(app)
    .delete("/api/sessions/current")
    .set("x-csrf-token", "csrf-abc")
    .expect(200);

  assert.deepEqual(calls, ["tok-123"]);
  assert.equal(res.body.success, true);
  assert.equal(res.headers["x-session-cleared"], "1");
});

test("DELETE /api/sessions/current skips invalidate when session token missing", async () => {
  let called = false;

  const app = buildTestApp({
    authContext: {
      user: { id: 12 },
      session: {
        csrfToken: "csrf-abc",
        expiresAt: "2026-04-01T10:00:00.000Z",
      },
    },
    serviceStubs: {
      invalidateSession: async () => {
        called = true;
      },
      invalidateAllSessionsForUser: async () => {},
    },
  });

  await request(app)
    .delete("/api/sessions/current")
    .set("x-csrf-token", "csrf-abc")
    .expect(200);

  assert.equal(called, false);
});

test("DELETE /api/sessions invalidates all user sessions", async () => {
  const calls = [];

  const app = buildTestApp({
    authContext: {
      user: { id: 77 },
      session: {
        sessionToken: "tok-123",
        csrfToken: "csrf-abc",
        expiresAt: "2026-04-01T10:00:00.000Z",
      },
    },
    serviceStubs: {
      invalidateSession: async () => {},
      invalidateAllSessionsForUser: async ({ beekeeperId }) => {
        calls.push(beekeeperId);
      },
    },
  });

  const res = await request(app)
    .delete("/api/sessions")
    .set("x-csrf-token", "csrf-abc")
    .expect(200);

  assert.deepEqual(calls, [77]);
  assert.equal(res.body.success, true);
  assert.equal(res.headers["x-session-cleared"], "1");
});

test("DELETE /api/sessions rejects invalid CSRF token", async () => {
  const app = buildTestApp({
    authContext: {
      user: { id: 77 },
      session: {
        sessionToken: "tok-123",
        csrfToken: "csrf-abc",
        expiresAt: "2026-04-01T10:00:00.000Z",
      },
    },
    serviceStubs: {
      invalidateSession: async () => {},
      invalidateAllSessionsForUser: async () => {},
    },
  });

  const res = await request(app)
    .delete("/api/sessions")
    .set("x-csrf-token", "wrong")
    .expect(403);

  assert.equal(res.body.error, "Invalid CSRF token");
});
