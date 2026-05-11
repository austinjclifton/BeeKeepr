"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const backendRoot = path.resolve(__dirname, "..");

const analyticsRoutesPath = path.join(
  backendRoot,
  "src/routes/analytics.routes.js",
);
const hivesRoutesPath = path.join(backendRoot, "src/routes/hives.routes.js");
const analyticsControllerPath = path.join(
  backendRoot,
  "src/controllers/analytics.controller.js",
);
const hivesControllerPath = path.join(
  backendRoot,
  "src/controllers/hives.controller.js",
);
const devicesControllerPath = path.join(
  backendRoot,
  "src/controllers/devices.controller.js",
);
const analyticsServicePath = path.join(
  backendRoot,
  "src/services/analytics.service.js",
);
const requireAuthPath = path.join(backendRoot, "src/middleware/requireAuth.js");
const requireCsrfPath = path.join(backendRoot, "src/middleware/requireCsrf.js");

function clearRequireCache() {
  for (const p of [
    analyticsRoutesPath,
    hivesRoutesPath,
    analyticsControllerPath,
    hivesControllerPath,
    devicesControllerPath,
    analyticsServicePath,
    requireAuthPath,
    requireCsrfPath,
  ]) {
    delete require.cache[p];
  }
}

function stubAuth(userId = 101) {
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
      requireCsrf: (req, res, next) => next(),
    },
  };
}

function stubHivesDependencies() {
  require.cache[hivesControllerPath] = {
    id: hivesControllerPath,
    filename: hivesControllerPath,
    loaded: true,
    exports: {
      list: (req, res) => res.status(501).json({ error: "not used" }),
      getById: (req, res) => res.status(501).json({ error: "not used" }),
      create: (req, res) => res.status(501).json({ error: "not used" }),
      update: (req, res) => res.status(501).json({ error: "not used" }),
      remove: (req, res) => res.status(501).json({ error: "not used" }),
    },
  };

  require.cache[devicesControllerPath] = {
    id: devicesControllerPath,
    filename: devicesControllerPath,
    loaded: true,
    exports: {
      listForHive: (req, res) => res.status(501).json({ error: "not used" }),
      createForHive: (req, res) => res.status(501).json({ error: "not used" }),
    },
  };
}

function buildAnalyticsApp(serviceStubs, userId = 101) {
  clearRequireCache();
  stubAuth(userId);

  require.cache[analyticsServicePath] = {
    id: analyticsServicePath,
    filename: analyticsServicePath,
    loaded: true,
    exports: serviceStubs,
  };

  const routes = require(analyticsRoutesPath);
  const app = express();
  app.use(express.json());
  app.use("/api/analytics", routes);
  app.use(errorHandler);
  return app;
}

function buildHivesAnalyticsApp(serviceStubs, userId = 101) {
  clearRequireCache();
  stubAuth(userId);
  stubHivesDependencies();

  require.cache[analyticsServicePath] = {
    id: analyticsServicePath,
    filename: analyticsServicePath,
    loaded: true,
    exports: serviceStubs,
  };

  const routes = require(hivesRoutesPath);
  const app = express();
  app.use(express.json());
  app.use("/api/hives", routes);
  app.use(errorHandler);
  return app;
}

function baseService() {
  return {
    getHiveReadingsSince: async ({ hiveId }) => ({
      hiveId,
      readings: [],
    }),
    getLatestHiveReading: async ({ hiveId }) => ({
      hiveId,
      reading: null,
    }),
    getHivesStatus: async () => ({ range: "1d", hives: [] }),
    getHiveSummary: async ({ hiveId }) => ({
      hiveId,
      range: "7d",
      summary: { readingCount: 0, warningCount: 0, criticalCount: 0 },
    }),
    getHiveTemperatureSeries: async ({ hiveId }) => ({
      hiveId,
      range: "7d",
      bucketSize: "hour",
      series: [],
    }),
    compareHives: async () => ({ range: "7d", bucketSize: "hour", hives: [] }),
    listOwnedLocations: async () => ({ locations: [] }),
    getDashboardHiveTemperature24h: async ({ hiveId }) => ({
      hive: { hiveId },
      bucketSize: "10m",
      points: [],
    }),
    getDashboardFleetTemperature24h: async () => ({
      bucketSize: "10m",
      hives: [],
    }),
    prepareCsvExport: async () => ({
      filename: "beekeepr-user-export.csv",
      writeTo: async (res) => res.write("record_type\n"),
    }),
  };
}

test("GET /api/analytics/hives/compare forwards range, bucket, location, and hiveIds", async () => {
  let captured = null;
  const service = baseService();
  service.compareHives = async (input) => {
    captured = input;
    return { range: "7d", bucketSize: "hour", locationId: 4, hives: [{ hiveId: 1 }] };
  };

  const app = buildAnalyticsApp(service, 55);
  const res = await request(app)
    .get("/api/analytics/hives/compare?range=7d&bucket=hour&locationId=4&hiveIds=1,2")
    .expect(200);

  assert.deepEqual(captured, {
    beekeeperId: 55,
    range: "7d",
    start: undefined,
    end: undefined,
    bucket: "hour",
    hiveIds: "1,2",
    locationId: "4",
  });
  assert.equal(res.body.hives.length, 1);
  assert.equal(res.body.locationId, 4);
});

test("GET /api/hives/status returns all-hives status payload", async () => {
  const service = baseService();
  service.getHivesStatus = async (input) => ({
    range: input.range,
    hives: [{ hiveId: 1, warningCount: 2, criticalCount: 0 }],
  });

  const app = buildHivesAnalyticsApp(service, 88);
  const res = await request(app)
    .get("/api/hives/status?range=3d")
    .expect(200);

  assert.equal(res.body.range, "3d");
  assert.equal(res.body.hives[0].warningCount, 2);
});

test("GET /api/hives/:hiveId/analytics/summary forwards ids", async () => {
  let captured = null;
  const service = baseService();
  service.getHiveSummary = async (input) => {
    captured = input;
    return {
      hiveId: input.hiveId,
      range: input.range,
      summary: { readingCount: 5, warningCount: 1, criticalCount: 0 },
    };
  };

  const app = buildHivesAnalyticsApp(service, 12);
  const res = await request(app)
    .get("/api/hives/9/analytics/summary?range=1m")
    .expect(200);

  assert.deepEqual(captured, {
    beekeeperId: 12,
    hiveId: 9,
    range: "1m",
    start: undefined,
    end: undefined,
    bucket: undefined,
  });
  assert.equal(res.body.summary.readingCount, 5);
});

test("GET /api/hives/:hiveId/analytics/temperature forwards custom dates", async () => {
  let captured = null;
  const service = baseService();
  service.getHiveTemperatureSeries = async (input) => {
    captured = input;
    return {
      hiveId: input.hiveId,
      range: "custom",
      bucketSize: "hour",
      series: [],
    };
  };

  const app = buildHivesAnalyticsApp(service, 12);
  const res = await request(app)
    .get("/api/hives/9/analytics/temperature?start=2026-05-01T00%3A00%3A00.000Z&end=2026-05-04T00%3A00%3A00.000Z")
    .expect(200);

  assert.deepEqual(captured, {
    beekeeperId: 12,
    hiveId: 9,
    range: undefined,
    start: "2026-05-01T00:00:00.000Z",
    end: "2026-05-04T00:00:00.000Z",
    bucket: undefined,
  });
  assert.equal(res.body.range, "custom");
});

test("GET /api/hives/:hiveId/readings/since forwards path and query values", async () => {
  let captured = null;
  const service = baseService();
  service.getHiveReadingsSince = async (input) => {
    captured = input;
    return { hiveId: input.hiveId, readings: [{ id: 11 }] };
  };

  const app = buildHivesAnalyticsApp(service, 55);
  const res = await request(app)
    .get(
      "/api/hives/9/readings/since?since=2026-03-01T00:00:00.000Z&until=2026-03-02T00:00:00.000Z&limit=10&order=desc",
    )
    .expect(200);

  assert.deepEqual(captured, {
    beekeeperId: 55,
    hiveId: 9,
    since: "2026-03-01T00:00:00.000Z",
    until: "2026-03-02T00:00:00.000Z",
    limit: "10",
    order: "desc",
  });
  assert.equal(res.body.readings.length, 1);
});

test("GET /api/analytics/locations lists owned locations", async () => {
  let captured = null;
  const service = baseService();
  service.listOwnedLocations = async (input) => {
    captured = input;
    return { locations: [{ id: 4, displayName: "North Yard" }] };
  };

  const app = buildAnalyticsApp(service, 77);
  const res = await request(app).get("/api/analytics/locations").expect(200);

  assert.deepEqual(captured, { beekeeperId: 77 });
  assert.equal(res.body.locations[0].displayName, "North Yard");
});

test("GET /api/analytics/dashboard/fleet-temperature-24h forwards location filter", async () => {
  let captured = null;
  const service = baseService();
  service.getDashboardFleetTemperature24h = async (input) => {
    captured = input;
    return { bucketSize: "10m", locationId: 4, hives: [{ hiveId: 1 }] };
  };

  const app = buildAnalyticsApp(service, 77);
  const res = await request(app)
    .get("/api/analytics/dashboard/fleet-temperature-24h?locationId=4")
    .expect(200);

  assert.deepEqual(captured, { beekeeperId: 77, locationId: "4" });
  assert.equal(res.body.hives[0].hiveId, 1);
});

test("GET /api/hives/:hiveId/dashboard/temperature-24h forwards selected hive", async () => {
  let captured = null;
  const service = baseService();
  service.getDashboardHiveTemperature24h = async (input) => {
    captured = input;
    return {
      hive: { hiveId: input.hiveId, name: "North Hive" },
      bucketSize: "10m",
      points: [{ bucketAt: "2026-05-10T12:00:00.000Z", internalTemperature: 94, outsideTemperature: 65 }],
    };
  };

  const app = buildHivesAnalyticsApp(service, 22);
  const res = await request(app)
    .get("/api/hives/9/dashboard/temperature-24h")
    .expect(200);

  assert.deepEqual(captured, { beekeeperId: 22, hiveId: 9 });
  assert.equal(res.body.points[0].outsideTemperature, 65);
});

test("GET /api/analytics/export.csv forwards authenticated export options", async () => {
  let captured = null;
  const service = baseService();
  service.prepareCsvExport = async (input) => {
    captured = input;
    return {
      filename: "beekeepr-location-export.csv",
      writeTo: async (res) => res.write("record_type,hive_id\nreading,1\n"),
    };
  };

  const app = buildAnalyticsApp(service, 19);
  const res = await request(app)
    .get("/api/analytics/export.csv?scope=location&locationId=4&includeReadings=true&includeExternal=true")
    .expect(200);

  assert.equal(res.headers["content-type"], "text/csv; charset=utf-8");
  assert.equal(res.text, "record_type,hive_id\nreading,1\n");
  assert.deepEqual(captured, {
    beekeeperId: 19,
    scope: "location",
    hiveId: undefined,
    locationId: "4",
    start: undefined,
    end: undefined,
    includeReadings: "true",
    includeExternal: "true",
    includeHiveDevice: undefined,
    includeAlerts: undefined,
  });
});

test("GET /api/hives/:hiveId/readings/latest validates hive id", async () => {
  const app = buildHivesAnalyticsApp(baseService());

  const res = await request(app)
    .get("/api/hives/not-an-id/readings/latest")
    .expect(400);

  assert.equal(res.body.error, "hiveId must be a positive integer");
});

function errorHandler(err, req, res, next) {
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal server error" });
}
