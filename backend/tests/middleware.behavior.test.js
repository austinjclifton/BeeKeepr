"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

const backendRoot = path.resolve(__dirname, "..");

const requireAuthPath = path.join(backendRoot, "src/middleware/requireAuth.js");
const sessionsServicePath = path.join(
  backendRoot,
  "src/services/sessions.service.js",
);
const sessionCookiePath = path.join(backendRoot, "src/utils/sessionCookie.js");
const requireCsrfPath = path.join(backendRoot, "src/middleware/requireCsrf.js");
const requireIngestTokenPath = path.join(
  backendRoot,
  "src/middleware/requireIngestToken.js",
);
const requireWritableAccountPath = path.join(
  backendRoot,
  "src/middleware/requireWritableAccount.js",
);
const demoAccountUtilPath = path.join(backendRoot, "src/utils/demoAccount.js");

function clearRequireCache(paths) {
  for (const p of paths) delete require.cache[p];
}

function buildRequireAuthApp({ validateSessionImpl, signedCookies }) {
  clearRequireCache([requireAuthPath, sessionsServicePath, sessionCookiePath]);

  require.cache[sessionsServicePath] = {
    id: sessionsServicePath,
    filename: sessionsServicePath,
    loaded: true,
    exports: {
      validateSession: validateSessionImpl,
    },
  };

  require.cache[sessionCookiePath] = {
    id: sessionCookiePath,
    filename: sessionCookiePath,
    loaded: true,
    exports: {
      SESSION_COOKIE_NAME: "sessionId",
    },
  };

  const { requireAuth } = require(requireAuthPath);

  const app = express();
  app.use(cookieParser());
  if (signedCookies) {
    app.use((req, res, next) => {
      req.signedCookies = { ...signedCookies };
      next();
    });
  }
  app.get("/protected", requireAuth, (req, res) => {
    res.status(200).json({
      user: req.user,
      sessionToken: req.session?.sessionToken,
    });
  });
  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });
  return app;
}

function buildRequireCsrfApp() {
  clearRequireCache([requireCsrfPath]);
  const { requireCsrf } = require(requireCsrfPath);

  const app = express();
  app.use((req, res, next) => {
    req.session = { csrfToken: "csrf-123" };
    next();
  });
  app.post("/state-change", requireCsrf, (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

function buildRequireIngestTokenApp() {
  clearRequireCache([requireIngestTokenPath]);
  const { requireIngestToken } = require(requireIngestTokenPath);

  const app = express();
  app.post("/ingest", requireIngestToken, (req, res) => {
    res.status(200).json({ token: req.ingestToken });
  });
  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });
  return app;
}

function buildRequireWritableAccountApp(user) {
  clearRequireCache([requireWritableAccountPath, demoAccountUtilPath]);
  const { requireWritableAccount } = require(requireWritableAccountPath);

  const app = express();
  app.use((req, res, next) => {
    req.user = user;
    next();
  });
  app.post("/state-change", requireWritableAccount, (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

test("requireAuth returns 401 when session cookie is missing", async () => {
  const app = buildRequireAuthApp({
    validateSessionImpl: async () => null,
  });

  const res = await request(app).get("/protected").expect(401);
  assert.equal(res.body.error, "Authentication required");
});

test("requireAuth returns 401 when session is invalid", async () => {
  const app = buildRequireAuthApp({
    validateSessionImpl: async () => null,
  });

  const res = await request(app)
    .get("/protected")
    .set("Cookie", "sessionId=bad-token")
    .expect(401);

  assert.equal(res.body.error, "Invalid or expired session");
});

test("requireAuth sets req.user and req.session and calls next", async () => {
  const app = buildRequireAuthApp({
    validateSessionImpl: async ({ sessionToken }) => ({
      user: { id: 5, username: "beek" },
      session: {
        sessionToken,
        csrfToken: "csrf-5",
        expiresAt: "2026-04-01T00:00:00.000Z",
      },
    }),
  });

  const res = await request(app)
    .get("/protected")
    .set("Cookie", "sessionId=good-token")
    .expect(200);

  assert.equal(res.body.user.id, 5);
  assert.equal(res.body.sessionToken, "good-token");
});

test("requireAuth accepts signed session cookies", async () => {
  const app = buildRequireAuthApp({
    validateSessionImpl: async ({ sessionToken }) => ({
      user: { id: 9, username: "signed" },
      session: {
        sessionToken,
        csrfToken: "csrf-9",
        expiresAt: "2026-04-01T00:00:00.000Z",
      },
    }),
    signedCookies: {
      sessionId: "signed-token",
    },
  });

  const res = await request(app).get("/protected").expect(200);

  assert.equal(res.body.user.id, 9);
  assert.equal(res.body.sessionToken, "signed-token");
});

test("requireCsrf allows matching token", async () => {
  const app = buildRequireCsrfApp();

  await request(app)
    .post("/state-change")
    .set("x-csrf-token", "csrf-123")
    .expect(200);
});

test("requireCsrf rejects mismatched token", async () => {
  const app = buildRequireCsrfApp();

  const res = await request(app)
    .post("/state-change")
    .set("x-csrf-token", "wrong")
    .expect(403);

  assert.equal(res.body.error, "Invalid CSRF token");
});

test("requireIngestToken accepts x-ingest-token", async () => {
  const app = buildRequireIngestTokenApp();

  const res = await request(app)
    .post("/ingest")
    .set("x-ingest-token", "abc123")
    .expect(200);

  assert.equal(res.body.token, "abc123");
});

test("requireIngestToken accepts Authorization Bearer token", async () => {
  const app = buildRequireIngestTokenApp();

  const res = await request(app)
    .post("/ingest")
    .set("authorization", "Bearer bearer-token")
    .expect(200);

  assert.equal(res.body.token, "bearer-token");
});

test("requireIngestToken rejects missing token", async () => {
  const app = buildRequireIngestTokenApp();

  const res = await request(app).post("/ingest").expect(401);

  assert.equal(res.body.error, "ingest token is required");
});

test("requireIngestToken enforces INGEST_TOKEN when configured", async () => {
  const priorToken = process.env.INGEST_TOKEN;
  const priorSecret = process.env.INGEST_SECRET;
  process.env.INGEST_TOKEN = "secret-token";
  delete process.env.INGEST_SECRET;

  try {
    const app = buildRequireIngestTokenApp();

    const bad = await request(app)
      .post("/ingest")
      .set("x-ingest-token", "wrong")
      .expect(401);

    assert.equal(bad.body.error, "Invalid ingest token");

    const good = await request(app)
      .post("/ingest")
      .set("x-ingest-token", "secret-token")
      .expect(200);

    assert.equal(good.body.token, "secret-token");
  } finally {
    if (priorToken === undefined) delete process.env.INGEST_TOKEN;
    else process.env.INGEST_TOKEN = priorToken;

    if (priorSecret === undefined) delete process.env.INGEST_SECRET;
    else process.env.INGEST_SECRET = priorSecret;
  }
});

test("requireIngestToken falls back to legacy INGEST_SECRET", async () => {
  const priorToken = process.env.INGEST_TOKEN;
  const priorSecret = process.env.INGEST_SECRET;
  delete process.env.INGEST_TOKEN;
  process.env.INGEST_SECRET = "legacy-secret";

  try {
    const app = buildRequireIngestTokenApp();

    const good = await request(app)
      .post("/ingest")
      .set("x-ingest-token", "legacy-secret")
      .expect(200);

    assert.equal(good.body.token, "legacy-secret");
  } finally {
    if (priorToken === undefined) delete process.env.INGEST_TOKEN;
    else process.env.INGEST_TOKEN = priorToken;

    if (priorSecret === undefined) delete process.env.INGEST_SECRET;
    else process.env.INGEST_SECRET = priorSecret;
  }
});

test("requireWritableAccount blocks configured demo account writes", async () => {
  const prior = process.env.DEMO_ACCOUNT_USERNAME;
  process.env.DEMO_ACCOUNT_USERNAME = "demo";

  try {
    const app = buildRequireWritableAccountApp({
      id: 10,
      username: "demo",
    });

    const res = await request(app).post("/state-change").expect(403);

    assert.equal(res.body.error, "Demo account is read-only");
  } finally {
    if (prior === undefined) delete process.env.DEMO_ACCOUNT_USERNAME;
    else process.env.DEMO_ACCOUNT_USERNAME = prior;
  }
});

test("requireWritableAccount allows non-demo account writes", async () => {
  const prior = process.env.DEMO_ACCOUNT_USERNAME;
  process.env.DEMO_ACCOUNT_USERNAME = "demo";

  try {
    const app = buildRequireWritableAccountApp({
      id: 11,
      username: "beekeeper",
    });

    const res = await request(app).post("/state-change").expect(200);

    assert.equal(res.body.ok, true);
  } finally {
    if (prior === undefined) delete process.env.DEMO_ACCOUNT_USERNAME;
    else process.env.DEMO_ACCOUNT_USERNAME = prior;
  }
});
