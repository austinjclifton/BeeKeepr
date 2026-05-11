"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const servicePath = path.join(backendRoot, "src/services/ingest.service.js");
const ingestRepoPath = path.join(backendRoot, "src/db/ingest.db.js");
const externalServicePath = path.join(
  backendRoot,
  "src/services/externalConditions.service.js",
);
const alertsServicePath = path.join(
  backendRoot,
  "src/services/alerts.service.js",
);

function clearRequireCache() {
  delete require.cache[servicePath];
  delete require.cache[ingestRepoPath];
  delete require.cache[externalServicePath];
  delete require.cache[alertsServicePath];
}

function buildService({ ingestRepoStubs, externalStubs, alertsStubs }) {
  clearRequireCache();

  require.cache[ingestRepoPath] = {
    id: ingestRepoPath,
    filename: ingestRepoPath,
    loaded: true,
    exports: ingestRepoStubs,
  };

  require.cache[externalServicePath] = {
    id: externalServicePath,
    filename: externalServicePath,
    loaded: true,
    exports: externalStubs,
  };

  require.cache[alertsServicePath] = {
    id: alertsServicePath,
    filename: alertsServicePath,
    loaded: true,
    exports: alertsStubs,
  };

  return require(servicePath);
}

function baseDeps() {
  return {
    ingestRepoStubs: {
      createReadingDeduped10m: async () => ({
        inserted: true,
        reading: { id: 1, device_id: 1 },
      }),
    },
    externalStubs: {
      fetchCurrentForDevice: async () => {},
    },
    alertsStubs: {
      processReading: async () => {},
    },
  };
}

test("createReading rejects out-of-range temperature", async () => {
  const svc = buildService(baseDeps());

  await assert.rejects(
    () => svc.createReading({ deviceId: 1, temperature: -100, rssi: -50 }),
    (err) =>
      err.status === 400 && /temperature must be between/.test(err.message),
  );
});

test("createReading rejects out-of-range rssi", async () => {
  const svc = buildService(baseDeps());

  await assert.rejects(
    () => svc.createReading({ deviceId: 1, temperature: 72, rssi: 1 }),
    (err) => err.status === 400 && /rssi must be between/.test(err.message),
  );
});

test("createReading forwards payload to repo and returns inserted reading", async () => {
  let captured = null;
  const deps = baseDeps();
  deps.ingestRepoStubs.createReadingDeduped10m = async (input) => {
    captured = input;
    return { inserted: true, reading: { id: 7, device_id: input.deviceId } };
  };

  const svc = buildService(deps);
  const result = await svc.createReading({
    deviceId: 42,
    temperature: 73.4,
    rssi: -90,
  });

  assert.equal(captured.deviceId, 42);
  assert.equal(captured.temperature, 73.4);
  assert.equal(captured.rssiDbm, -90);
  assert.equal(typeof captured.bucketAt, "string");
  assert.equal(new Date(captured.bucketAt).getUTCMinutes() % 10, 0);
  assert.equal(new Date(captured.bucketAt).getUTCSeconds(), 0);
  assert.equal(new Date(captured.bucketAt).getUTCMilliseconds(), 0);
  assert.equal(result.inserted, true);
  assert.equal(result.reading.id, 7);
});

test("createReading triggers alerts and external fetch when inserted", async () => {
  const calls = [];
  const deps = baseDeps();
  deps.alertsStubs.processReading = async (reading) => {
    calls.push(["alerts", reading.id]);
  };
  deps.externalStubs.fetchCurrentForDevice = async ({ deviceId }) => {
    calls.push(["external", deviceId]);
  };

  const svc = buildService(deps);
  await svc.createReading({ deviceId: 99, temperature: 70, rssi: -80 });

  assert.deepEqual(calls, [
    ["alerts", 1],
    ["external", 99],
  ]);
});

test("createReading swallows side-effect errors and still returns success", async () => {
  const deps = baseDeps();
  deps.alertsStubs.processReading = async () => {
    throw new Error("alerts down");
  };
  deps.externalStubs.fetchCurrentForDevice = async () => {
    throw new Error("external down");
  };

  const svc = buildService(deps);
  const result = await svc.createReading({
    deviceId: 99,
    temperature: 70,
    rssi: -80,
  });

  assert.equal(result.inserted, true);
  assert.equal(result.reading.id, 1);
});

test("createReading skips side effects when insert is deduped", async () => {
  let alertCalled = false;
  let externalCalled = false;
  const deps = baseDeps();
  deps.ingestRepoStubs.createReadingDeduped10m = async () => ({
    inserted: false,
    reading: null,
  });
  deps.alertsStubs.processReading = async () => {
    alertCalled = true;
  };
  deps.externalStubs.fetchCurrentForDevice = async () => {
    externalCalled = true;
  };

  const svc = buildService(deps);
  const result = await svc.createReading({
    deviceId: 1,
    temperature: 72,
    rssi: -90,
  });

  assert.equal(result.inserted, false);
  assert.equal(alertCalled, false);
  assert.equal(externalCalled, false);
});
