"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const backendRoot = path.resolve(__dirname, "..");

const authModulePath = path.join(backendRoot, "src/middleware/requireAuth.js");
const serviceModulePath = path.join(
  backendRoot,
  "src/services/devices.service.js",
);
const routesModulePath = path.join(backendRoot, "src/routes/devices.routes.js");

function clearRequireCache() {
  delete require.cache[routesModulePath];
  delete require.cache[
    path.join(backendRoot, "src/controllers/devices.controller.js")
  ];
  delete require.cache[serviceModulePath];
  delete require.cache[authModulePath];
}

function buildTestApp({ touchLastSeenImpl }) {
  clearRequireCache();

  require.cache[authModulePath] = {
    id: authModulePath,
    filename: authModulePath,
    loaded: true,
    exports: {
      requireAuth: (req, res, next) => {
        req.user = { id: 101 };
        next();
      },
    },
  };

  require.cache[serviceModulePath] = {
    id: serviceModulePath,
    filename: serviceModulePath,
    loaded: true,
    exports: {
      touchLastSeen: touchLastSeenImpl,
    },
  };

  const devicesRoutes = require(routesModulePath);

  const app = express();
  app.use(express.json());
  app.use("/api/devices", devicesRoutes);

  app.use((err, req, res, next) => {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal server error" });
  });

  return app;
}

test("POST /api/devices/:id/last-seen updates last seen and returns device", async () => {
  let capturedInput = null;

  const app = buildTestApp({
    touchLastSeenImpl: async (input) => {
      capturedInput = input;
      return {
        id: input.deviceId,
        hive_id: 7,
        last_seen_at: input.seenAt,
      };
    },
  });

  const seenAt = "2026-03-31T12:34:56.000Z";

  const res = await request(app)
    .post("/api/devices/42/last-seen")
    .send({ seenAt })
    .expect(200);

  assert.deepEqual(capturedInput, {
    beekeeperId: 101,
    deviceId: 42,
    seenAt,
  });

  assert.equal(res.body.device.id, 42);
  assert.equal(res.body.device.last_seen_at, seenAt);
});

test("POST /api/devices/:id/last-seen returns 404 when device is not found", async () => {
  const app = buildTestApp({
    touchLastSeenImpl: async () => null,
  });

  const res = await request(app)
    .post("/api/devices/999/last-seen")
    .send({})
    .expect(404);

  assert.equal(res.body.error, "Device not found");
});

test("POST /api/devices/:id/last-seen returns 400 for invalid device id", async () => {
  let called = false;

  const app = buildTestApp({
    touchLastSeenImpl: async () => {
      called = true;
      return null;
    },
  });

  const res = await request(app)
    .post("/api/devices/not-a-number/last-seen")
    .send({})
    .expect(400);

  assert.equal(res.body.error, "id must be a positive integer");
  assert.equal(called, false);
});
