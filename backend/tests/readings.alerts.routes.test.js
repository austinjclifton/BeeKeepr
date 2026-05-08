"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const backendRoot = path.resolve(__dirname, "..");

const readingsRoutesPath = path.join(
  backendRoot,
  "src/routes/readings.routes.js",
);
const readingsControllerPath = path.join(
  backendRoot,
  "src/controllers/readings.controller.js",
);
const readingsServicePath = path.join(
  backendRoot,
  "src/services/readings.service.js",
);

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
        next();
      },
    },
  };
}

function buildReadingsApp(stubs, userId = 101) {
  clearRequireCache([
    readingsRoutesPath,
    readingsControllerPath,
    readingsServicePath,
    requireAuthPath,
  ]);
  stubRequireAuth({ userId });

  require.cache[readingsServicePath] = {
    id: readingsServicePath,
    filename: readingsServicePath,
    loaded: true,
    exports: {
      getHiveReadingsSince: stubs.getHiveReadingsSince,
      getLatestForHive: stubs.getLatestForHive,
    },
  };

  const routes = require(readingsRoutesPath);
  const app = express();
  app.use(express.json());
  app.use("/api/readings", routes);
  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });
  return app;
}

function buildAlertsApp(stubs, userId = 101) {
  clearRequireCache([
    alertsRoutesPath,
    alertsControllerPath,
    alertsServicePath,
    requireAuthPath,
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

function readingNoops() {
  return {
    getHiveReadingsSince: async () => [],
    getLatestForHive: async () => null,
  };
}

function alertNoops() {
  return {
    listAlerts: async () => [],
    resolveAlert: async () => ({ id: 1, resolved: true }),
  };
}

test("GET /api/readings/since returns 400 when since is missing", async () => {
  const app = buildReadingsApp(readingNoops());

  const res = await request(app)
    .get("/api/readings/since?hiveId=7")
    .expect(400);

  assert.equal(res.body.error, "since is required");
});

test("GET /api/readings/since passes query values to service", async () => {
  let captured = null;
  const stubs = readingNoops();
  stubs.getHiveReadingsSince = async (input) => {
    captured = input;
    return [{ id: 101 }];
  };

  const app = buildReadingsApp(stubs, 55);

  const res = await request(app)
    .get(
      "/api/readings/since?hiveId=7&since=2026-03-01T00:00:00.000Z&until=2026-03-02T00:00:00.000Z&limit=10&order=desc",
    )
    .expect(200);

  assert.deepEqual(captured, {
    beekeeperId: 55,
    hiveId: "7",
    since: "2026-03-01T00:00:00.000Z",
    until: "2026-03-02T00:00:00.000Z",
    limit: "10",
    order: "desc",
  });
  assert.equal(res.body.readings.length, 1);
});

test("GET /api/readings/latest returns 404 when hive is not found", async () => {
  const app = buildReadingsApp(readingNoops());

  const res = await request(app)
    .get("/api/readings/latest?hiveId=7")
    .expect(404);

  assert.equal(res.body.error, "Hive not found");
});

test("GET /api/readings/latest returns reading when available", async () => {
  const stubs = readingNoops();
  stubs.getLatestForHive = async () => ({
    id: 9,
    hive_id: 7,
    temperature: 73.1,
  });

  const app = buildReadingsApp(stubs);

  const res = await request(app)
    .get("/api/readings/latest?hiveId=7")
    .expect(200);

  assert.equal(res.body.reading.id, 9);
});

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

  const res = await request(app).patch("/api/alerts/31/resolve").expect(200);

  assert.deepEqual(captured, { beekeeperId: 9, alertId: 31 });
  assert.equal(res.body.success, true);
  assert.equal(res.body.alert.resolved, true);
});
