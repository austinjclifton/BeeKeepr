"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const backendRoot = path.resolve(__dirname, "..");

const routesModulePath = path.join(backendRoot, "src/routes/ingest.routes.js");
const controllerModulePath = path.join(
  backendRoot,
  "src/controllers/ingest.controller.js",
);
const serviceModulePath = path.join(
  backendRoot,
  "src/services/ingest.service.js",
);

function clearRequireCache() {
  delete require.cache[routesModulePath];
  delete require.cache[controllerModulePath];
  delete require.cache[serviceModulePath];
}

function buildTestApp({ createReadingImpl }) {
  clearRequireCache();

  require.cache[serviceModulePath] = {
    id: serviceModulePath,
    filename: serviceModulePath,
    loaded: true,
    exports: {
      createReading: createReadingImpl,
    },
  };

  const routes = require(routesModulePath);
  const app = express();
  app.use(express.json());
  app.use("/ingest", routes);

  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });

  return app;
}

test("POST /ingest/readings returns 401 when ingest token is missing", async () => {
  const app = buildTestApp({
    createReadingImpl: async () => ({ inserted: true, reading: { id: 1 } }),
  });

  const res = await request(app)
    .post("/ingest/readings")
    .send({ deviceId: 1, temperature: 70, rssi: -90 })
    .expect(401);

  assert.equal(res.body.error, "ingest token is required");
});

test("POST /ingest/readings accepts x-ingest-token and returns 201", async () => {
  let capturedInput = null;

  const app = buildTestApp({
    createReadingImpl: async (input) => {
      capturedInput = input;
      return {
        inserted: true,
        reading: {
          id: 5,
          device_id: input.deviceId,
          temperature: input.temperature,
        },
      };
    },
  });

  const res = await request(app)
    .post("/ingest/readings")
    .set("x-ingest-token", "abc123")
    .send({ deviceId: 42, temperature: 71.25, rssi: -88 })
    .expect(201);

  assert.deepEqual(capturedInput, {
    deviceId: 42,
    temperature: 71.25,
    rssi: -88,
  });

  assert.equal(res.body.success, true);
  assert.equal(res.body.inserted, true);
  assert.equal(res.body.reading.id, 5);
});

test("POST /ingest/readings accepts Bearer token and returns 409 for duplicate bucket", async () => {
  const app = buildTestApp({
    createReadingImpl: async () => ({ inserted: false, reading: null }),
  });

  const res = await request(app)
    .post("/ingest/readings")
    .set("authorization", "Bearer abc123")
    .send({ deviceId: 42, temperature: 71.25, rssi: -88 })
    .expect(409);

  assert.equal(res.body.success, false);
  assert.equal(res.body.inserted, false);
  assert.equal(
    res.body.error,
    "Reading already exists for this 10-minute bucket",
  );
});

test("POST /ingest/readings returns 401 for invalid token when INGEST_TOKEN is set", async () => {
  const priorToken = process.env.INGEST_TOKEN;
  const priorSecret = process.env.INGEST_SECRET;
  process.env.INGEST_TOKEN = "expected-token";
  delete process.env.INGEST_SECRET;

  try {
    const app = buildTestApp({
      createReadingImpl: async () => ({ inserted: true, reading: { id: 1 } }),
    });

    const res = await request(app)
      .post("/ingest/readings")
      .set("x-ingest-token", "wrong-token")
      .send({ deviceId: 1, temperature: 70, rssi: -90 })
      .expect(401);

    assert.equal(res.body.error, "Invalid ingest token");
  } finally {
    if (priorToken === undefined) delete process.env.INGEST_TOKEN;
    else process.env.INGEST_TOKEN = priorToken;

    if (priorSecret === undefined) delete process.env.INGEST_SECRET;
    else process.env.INGEST_SECRET = priorSecret;
  }
});

test("POST /ingest/readings returns 400 when service rejects payload", async () => {
  const app = buildTestApp({
    createReadingImpl: async () => {
      const err = new Error("rssi must be between -200 and 0");
      err.status = 400;
      throw err;
    },
  });

  const res = await request(app)
    .post("/ingest/readings")
    .set("x-ingest-token", "abc123")
    .send({ deviceId: 1, temperature: 70, rssi: 5 })
    .expect(400);

  assert.equal(res.body.error, "rssi must be between -200 and 0");
});
