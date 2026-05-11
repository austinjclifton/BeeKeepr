"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const backendRoot = path.resolve(__dirname, "..");

const hivesRoutesPath = path.join(backendRoot, "src/routes/hives.routes.js");
const hivesControllerPath = path.join(
  backendRoot,
  "src/controllers/hives.controller.js",
);
const hivesServicePath = path.join(
  backendRoot,
  "src/services/hives.service.js",
);
const devicesControllerPath = path.join(
  backendRoot,
  "src/controllers/devices.controller.js",
);
const analyticsControllerPath = path.join(
  backendRoot,
  "src/controllers/analytics.controller.js",
);

const locationsRoutesPath = path.join(
  backendRoot,
  "src/routes/locations.routes.js",
);
const locationsControllerPath = path.join(
  backendRoot,
  "src/controllers/locations.controller.js",
);
const locationsServicePath = path.join(
  backendRoot,
  "src/services/locations.service.js",
);

const requireAuthPath = path.join(backendRoot, "src/middleware/requireAuth.js");
const requireCsrfPath = path.join(backendRoot, "src/middleware/requireCsrf.js");

function clearRequireCache(paths) {
  for (const p of paths) delete require.cache[p];
}

function authAndCsrfStubs({ userId = 101, csrfToken = "csrf-101" }) {
  require.cache[requireAuthPath] = {
    id: requireAuthPath,
    filename: requireAuthPath,
    loaded: true,
    exports: {
      requireAuth: (req, res, next) => {
        req.user = { id: userId };
        req.session = { csrfToken };
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
        if (req.get("x-csrf-token") === csrfToken) return next();
        return res.status(403).json({ error: "Invalid CSRF token" });
      },
    },
  };
}

function buildHivesApp(stubs) {
  clearRequireCache([
    hivesRoutesPath,
    hivesControllerPath,
    hivesServicePath,
    devicesControllerPath,
    analyticsControllerPath,
    requireAuthPath,
    requireCsrfPath,
  ]);

  authAndCsrfStubs({});

  require.cache[hivesServicePath] = {
    id: hivesServicePath,
    filename: hivesServicePath,
    loaded: true,
    exports: {
      listHives: stubs.listHives,
      getHive: stubs.getHive,
      createHive: stubs.createHive,
      updateHive: stubs.updateHive,
      deleteHive: stubs.deleteHive,
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

  require.cache[analyticsControllerPath] = {
    id: analyticsControllerPath,
    filename: analyticsControllerPath,
    loaded: true,
    exports: {
      hivesStatus: (req, res) => res.status(501).json({ error: "not used" }),
      hiveReadingsSince: (req, res) =>
        res.status(501).json({ error: "not used" }),
      latestHiveReading: (req, res) =>
        res.status(501).json({ error: "not used" }),
      dashboardHiveTemperature24h: (req, res) =>
        res.status(501).json({ error: "not used" }),
      hiveSummary: (req, res) => res.status(501).json({ error: "not used" }),
      hiveTemperature: (req, res) =>
        res.status(501).json({ error: "not used" }),
    },
  };

  const routes = require(hivesRoutesPath);
  const app = express();
  app.use(express.json());
  app.use("/api/hives", routes);
  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });
  return app;
}

function buildLocationsApp(stubs) {
  clearRequireCache([
    locationsRoutesPath,
    locationsControllerPath,
    locationsServicePath,
    requireAuthPath,
    requireCsrfPath,
  ]);

  require.cache[requireAuthPath] = {
    id: requireAuthPath,
    filename: requireAuthPath,
    loaded: true,
    exports: {
      requireAuth: (req, res, next) => {
        req.user = { id: 101 };
        req.session = { csrfToken: "csrf-101" };
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

  require.cache[locationsServicePath] = {
    id: locationsServicePath,
    filename: locationsServicePath,
    loaded: true,
    exports: {
      listLocations: stubs.listLocations,
      getById: stubs.getById,
      createOrGetLocation: stubs.createOrGetLocation,
      update: stubs.update,
      remove: stubs.remove,
    },
  };

  const routes = require(locationsRoutesPath);
  const app = express();
  app.use(express.json());
  app.use("/api/locations", routes);
  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });
  return app;
}

function hiveNoops() {
  return {
    listHives: async () => [],
    getHive: async () => null,
    createHive: async () => ({ id: 1 }),
    updateHive: async () => null,
    deleteHive: async () => false,
  };
}

function locationNoops() {
  return {
    listLocations: async () => [],
    getById: async () => null,
    createOrGetLocation: async () => ({ id: 1 }),
    update: async () => null,
    remove: async () => false,
  };
}

test("GET /api/hives passes beekeeper id and returns list", async () => {
  let captured = null;
  const stubs = hiveNoops();
  stubs.listHives = async (input) => {
    captured = input;
    return [{ id: 10, name: "A" }];
  };

  const app = buildHivesApp(stubs);
  const res = await request(app).get("/api/hives").expect(200);

  assert.deepEqual(captured, { beekeeperId: 101 });
  assert.equal(res.body.hives.length, 1);
  assert.equal(res.body.hives[0].id, 10);
});

test("POST /api/hives returns 400 when name is missing", async () => {
  const app = buildHivesApp(hiveNoops());

  const res = await request(app)
    .post("/api/hives")
    .set("x-csrf-token", "csrf-101")
    .send({ notes: "x" })
    .expect(400);

  assert.equal(res.body.error, "name is required");
});

test("GET /api/hives/:id returns 404 when hive not found", async () => {
  const app = buildHivesApp(hiveNoops());

  const res = await request(app).get("/api/hives/999").expect(404);
  assert.equal(res.body.error, "Hive not found");
});

test("PATCH /api/hives/:id returns 400 for invalid id", async () => {
  const app = buildHivesApp(hiveNoops());

  const res = await request(app)
    .patch("/api/hives/not-an-id")
    .set("x-csrf-token", "csrf-101")
    .send({ name: "renamed" })
    .expect(400);

  assert.equal(res.body.error, "id must be a positive integer");
});

test("DELETE /api/hives/:id returns 204 when deleted", async () => {
  const stubs = hiveNoops();
  stubs.deleteHive = async () => true;

  const app = buildHivesApp(stubs);
  await request(app)
    .delete("/api/hives/11")
    .set("x-csrf-token", "csrf-101")
    .expect(204);
});

test("GET /api/locations passes list query to service", async () => {
  let captured = null;
  const stubs = locationNoops();
  stubs.listLocations = async (input) => {
    captured = input;
    return [{ id: 1, name: "Loc" }];
  };

  const app = buildLocationsApp(stubs);
  const res = await request(app)
    .get("/api/locations?limit=5&order=asc")
    .expect(200);

  assert.deepEqual(captured, { limit: "5", order: "asc" });
  assert.equal(res.body.locations.length, 1);
});

test("POST /api/locations returns 400 when lat is missing", async () => {
  const app = buildLocationsApp(locationNoops());

  const res = await request(app)
    .post("/api/locations")
    .set("x-csrf-token", "csrf-101")
    .send({ lon: -82.5, name: "AVL" })
    .expect(400);

  assert.equal(res.body.error, "lat is required");
});

test("GET /api/locations/:locationId returns 404 for unknown location", async () => {
  const app = buildLocationsApp(locationNoops());

  const res = await request(app).get("/api/locations/1234").expect(404);
  assert.equal(res.body.error, "Location not found");
});

test("DELETE /api/locations/:locationId returns 204 when removed", async () => {
  const stubs = locationNoops();
  stubs.remove = async () => true;

  const app = buildLocationsApp(stubs);
  await request(app)
    .delete("/api/locations/1234")
    .set("x-csrf-token", "csrf-101")
    .expect(204);
});
