"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const backendRoot = path.resolve(__dirname, "..");

const routesModulePath = path.join(
  backendRoot,
  "src/routes/externalConditions.routes.js",
);
const controllerModulePath = path.join(
  backendRoot,
  "src/controllers/externalConditions.controller.js",
);
const serviceModulePath = path.join(
  backendRoot,
  "src/services/externalConditions.service.js",
);
const requireAuthModulePath = path.join(
  backendRoot,
  "src/middleware/requireAuth.js",
);

function clearRequireCache() {
  delete require.cache[routesModulePath];
  delete require.cache[controllerModulePath];
  delete require.cache[serviceModulePath];
  delete require.cache[requireAuthModulePath];
}

function buildTestApp({ serviceStubs, userId = 101 }) {
  clearRequireCache();

  require.cache[requireAuthModulePath] = {
    id: requireAuthModulePath,
    filename: requireAuthModulePath,
    loaded: true,
    exports: {
      requireAuth: (req, res, next) => {
        req.user = { id: userId };
        next();
      },
    },
  };

  require.cache[serviceModulePath] = {
    id: serviceModulePath,
    filename: serviceModulePath,
    loaded: true,
    exports: {
      getLatestForHive: serviceStubs.getLatestForHive,
      getForHiveSince: serviceStubs.getForHiveSince,
      fetchCurrentForHive: serviceStubs.fetchCurrentForHive,
    },
  };

  const routes = require(routesModulePath);
  const app = express();
  app.use(express.json());
  app.use("/api/external-conditions", routes);
  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });
  return app;
}

function noops() {
  return {
    getLatestForHive: async () => null,
    getForHiveSince: async () => [],
    fetchCurrentForHive: async () => ({ id: 1 }),
  };
}

test("GET /api/external-conditions/latest returns 400 when hiveId is missing", async () => {
  const app = buildTestApp({ serviceStubs: noops() });

  const res = await request(app)
    .get("/api/external-conditions/latest")
    .expect(400);

  assert.equal(res.body.error, "hiveId is required");
});

test("GET /api/external-conditions/latest returns 404 when no condition exists", async () => {
  const app = buildTestApp({ serviceStubs: noops() });

  const res = await request(app)
    .get("/api/external-conditions/latest?hiveId=3")
    .expect(404);

  assert.equal(res.body.error, "No external conditions found for hive");
});

test("GET /api/external-conditions/latest passes beekeeperId and hiveId", async () => {
  let captured = null;
  const stubs = noops();
  stubs.getLatestForHive = async (input) => {
    captured = input;
    return { id: 5, hive_id: input.hiveId };
  };

  const app = buildTestApp({ serviceStubs: stubs, userId: 44 });

  const res = await request(app)
    .get("/api/external-conditions/latest?hiveId=7")
    .expect(200);

  assert.deepEqual(captured, { beekeeperId: 44, hiveId: 7 });
  assert.equal(res.body.externalCondition.id, 5);
});

test("GET /api/external-conditions/since returns 400 for invalid since", async () => {
  const app = buildTestApp({ serviceStubs: noops() });

  const res = await request(app)
    .get("/api/external-conditions/since?hiveId=7&since=not-a-date")
    .expect(400);

  assert.equal(res.body.error, "since must be a valid ISO date string");
});

test("GET /api/external-conditions/since passes optional until/limit/order", async () => {
  let captured = null;
  const stubs = noops();
  stubs.getForHiveSince = async (input) => {
    captured = input;
    return [{ id: 11 }];
  };

  const app = buildTestApp({ serviceStubs: stubs });

  const res = await request(app)
    .get(
      "/api/external-conditions/since?hiveId=7&since=2026-03-01T00:00:00.000Z&until=2026-03-02T00:00:00.000Z&limit=25&order=asc",
    )
    .expect(200);

  assert.deepEqual(captured, {
    beekeeperId: 101,
    hiveId: 7,
    since: "2026-03-01T00:00:00.000Z",
    until: "2026-03-02T00:00:00.000Z",
    limit: "25",
    order: "asc",
  });
  assert.equal(res.body.externalConditions.length, 1);
});

test("POST /api/external-conditions/fetch calls service and returns condition", async () => {
  let captured = null;
  const stubs = noops();
  stubs.fetchCurrentForHive = async (input) => {
    captured = input;
    return { id: 88, hive_id: input.hiveId };
  };

  const app = buildTestApp({ serviceStubs: stubs, userId: 12 });

  const res = await request(app)
    .post("/api/external-conditions/fetch?hiveId=9")
    .expect(200);

  assert.deepEqual(captured, { beekeeperId: 12, hiveId: 9 });
  assert.equal(res.body.externalCondition.id, 88);
});
