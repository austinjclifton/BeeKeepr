"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const backendRoot = path.resolve(__dirname, "..");

const alertsRoutesPath = path.join(backendRoot, "src/routes/alerts.routes.js");
const alertsControllerPath = path.join(
  backendRoot,
  "src/controllers/alerts.controller.js",
);
const alertsServicePath = path.join(
  backendRoot,
  "src/services/alerts.service.js",
);

const requireAuthPath = path.join(backendRoot, "src/middleware/requireAuth.js");
const requireCsrfPath = path.join(backendRoot, "src/middleware/requireCsrf.js");

function clearRequireCache(paths) {
  for (const p of paths) delete require.cache[p];
}

function stubRequireAuth({ userId = 101 }) {
  require.cache[requireAuthPath] = {
    id: requireAuthPath,
    filename: requireAuthPath,
    loaded: true,
    exports: {
      requireAuth: (req, res, next) => {
        req.user = { id: userId };
        req.session = { csrfToken: `csrf-${userId}` };
        next();
      },
    },
  };

  require.cache[requireCsrfPath] = {
    id: requireCsrfPath,
    filename: requireCsrfPath,
    loaded: true,
    exports: {
      requireCsrf: (req, res, next) => {
        if (req.get("x-csrf-token") === req.session?.csrfToken) return next();
        return res.status(403).json({ error: "Invalid CSRF token" });
      },
    },
  };
}

function buildAlertsApp(stubs, userId = 101) {
  clearRequireCache([
    alertsRoutesPath,
    alertsControllerPath,
    alertsServicePath,
    requireAuthPath,
    requireCsrfPath,
  ]);
  stubRequireAuth({ userId });

  require.cache[alertsServicePath] = {
    id: alertsServicePath,
    filename: alertsServicePath,
    loaded: true,
    exports: {
      listAlerts: stubs.listAlerts,
      resolveAlert: stubs.resolveAlert,
    },
  };

  const routes = require(alertsRoutesPath);
  const app = express();
  app.use(express.json());
  app.use("/api/alerts", routes);
  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });
  return app;
}

function alertNoops() {
  return {
    listAlerts: async () => [],
    resolveAlert: async () => ({ id: 1, resolved: true }),
  };
}

test("GET /api/alerts returns success and forwards optional hiveId", async () => {
  let captured = null;
  const stubs = alertNoops();
  stubs.listAlerts = async (input) => {
    captured = input;
    return [{ id: 3 }];
  };

  const app = buildAlertsApp(stubs, 88);

  const res = await request(app).get("/api/alerts?hiveId=22").expect(200);

  assert.deepEqual(captured, { beekeeperId: 88, hiveId: 22 });
  assert.equal(res.body.success, true);
  assert.equal(res.body.alerts.length, 1);
});

test("GET /api/alerts returns 400 for invalid hiveId", async () => {
  const app = buildAlertsApp(alertNoops());

  const res = await request(app).get("/api/alerts?hiveId=bad").expect(400);

  assert.equal(res.body.error, "hiveId must be a positive integer");
});

test("PATCH /api/alerts/:alertId/resolve returns 400 for invalid alertId", async () => {
  const app = buildAlertsApp(alertNoops());

  const res = await request(app)
    .patch("/api/alerts/not-an-int/resolve")
    .set("x-csrf-token", "csrf-101")
    .expect(400);

  assert.equal(res.body.error, "alertId must be a positive integer");
});

test("PATCH /api/alerts/:alertId/resolve forwards ids and returns success", async () => {
  let captured = null;
  const stubs = alertNoops();
  stubs.resolveAlert = async (input) => {
    captured = input;
    return { id: input.alertId, resolved: true };
  };

  const app = buildAlertsApp(stubs, 9);

  const res = await request(app)
    .patch("/api/alerts/31/resolve")
    .set("x-csrf-token", "csrf-9")
    .expect(200);

  assert.deepEqual(captured, { beekeeperId: 9, alertId: 31 });
  assert.equal(res.body.success, true);
  assert.equal(res.body.alert.resolved, true);
});