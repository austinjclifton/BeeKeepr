"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const servicePath = path.join(
  backendRoot,
  "src/services/externalConditions.service.js",
);
const hivesRepoPath = path.join(backendRoot, "src/db/hives.db.js");
const devicesRepoPath = path.join(backendRoot, "src/db/devices.db.js");
const locationsRepoPath = path.join(backendRoot, "src/db/locations.db.js");
const externalRepoPath = path.join(
  backendRoot,
  "src/db/externalConditions.db.js",
);

function clearRequireCache() {
  delete require.cache[servicePath];
  delete require.cache[hivesRepoPath];
  delete require.cache[devicesRepoPath];
  delete require.cache[locationsRepoPath];
  delete require.cache[externalRepoPath];
}

function buildService({
  hivesStubs,
  devicesStubs,
  locationsStubs,
  externalStubs,
  env = {},
}) {
  clearRequireCache();

  require.cache[hivesRepoPath] = {
    id: hivesRepoPath,
    filename: hivesRepoPath,
    loaded: true,
    exports: hivesStubs,
  };

  require.cache[devicesRepoPath] = {
    id: devicesRepoPath,
    filename: devicesRepoPath,
    loaded: true,
    exports: devicesStubs,
  };

  require.cache[locationsRepoPath] = {
    id: locationsRepoPath,
    filename: locationsRepoPath,
    loaded: true,
    exports: locationsStubs,
  };

  require.cache[externalRepoPath] = {
    id: externalRepoPath,
    filename: externalRepoPath,
    loaded: true,
    exports: externalStubs,
  };

  const prev = {
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    OPENWEATHER_BASE_URL: process.env.OPENWEATHER_BASE_URL,
    OPENWEATHER_UNITS: process.env.OPENWEATHER_UNITS,
  };

  process.env.OPENWEATHER_API_KEY = env.OPENWEATHER_API_KEY ?? "test-key";
  process.env.OPENWEATHER_BASE_URL =
    env.OPENWEATHER_BASE_URL ?? "https://api.openweathermap.org";
  process.env.OPENWEATHER_UNITS = env.OPENWEATHER_UNITS ?? "imperial";

  const service = require(servicePath);

  return {
    service,
    restoreEnv: () => {
      process.env.OPENWEATHER_API_KEY = prev.OPENWEATHER_API_KEY;
      process.env.OPENWEATHER_BASE_URL = prev.OPENWEATHER_BASE_URL;
      process.env.OPENWEATHER_UNITS = prev.OPENWEATHER_UNITS;
    },
  };
}

function baseDeps() {
  return {
    hivesStubs: {
      getLocationIdForHive: async () => ({ location_id: 3 }),
    },
    devicesStubs: {
      getLocationIdForDevice: async () => ({ location_id: 3 }),
    },
    locationsStubs: {
      getCoordsById: async () => ({ lat: 35.6, lon: -82.5 }),
    },
    externalStubs: {
      getByLocationAndBucket: async () => null,
      upsert: async (input) => ({ id: 1, ...input }),
      getLatestByLocationId: async () => null,
      listByLocationSince: async () => [],
    },
  };
}

test("getForHiveSince rejects until before since", async () => {
  const { service, restoreEnv } = buildService(baseDeps());

  try {
    await assert.rejects(
      () =>
        service.getForHiveSince({
          beekeeperId: 1,
          hiveId: 2,
          since: "2026-03-02T00:00:00.000Z",
          until: "2026-03-01T00:00:00.000Z",
        }),
      (err) => err.status === 400 && err.message === "until must be >= since",
    );
  } finally {
    restoreEnv();
  }
});

test("fetchCurrentForHive returns 404 when hive is missing", async () => {
  const deps = baseDeps();
  deps.hivesStubs.getLocationIdForHive = async () => null;

  const { service, restoreEnv } = buildService(deps);

  try {
    await assert.rejects(
      () => service.fetchCurrentForHive({ beekeeperId: 1, hiveId: 99 }),
      (err) => err.status === 404 && err.message === "Hive not found",
    );
  } finally {
    restoreEnv();
  }
});

test("fetchCurrentForHive returns existing bucket row without calling fetch", async () => {
  let upsertCalled = false;
  const deps = baseDeps();
  deps.externalStubs.getByLocationAndBucket = async () => ({
    id: 77,
    status: "success",
  });
  deps.externalStubs.upsert = async () => {
    upsertCalled = true;
  };

  const priorFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("fetch should not be called");
  };

  const { service, restoreEnv } = buildService(deps);

  try {
    const row = await service.fetchCurrentForHive({
      beekeeperId: 1,
      hiveId: 2,
    });
    assert.equal(row.id, 77);
    assert.equal(upsertCalled, false);
  } finally {
    global.fetch = priorFetch;
    restoreEnv();
  }
});

test("fetchCurrentForHive upserts success payload from OpenWeather", async () => {
  let captured = null;
  const deps = baseDeps();
  deps.externalStubs.upsert = async (input) => {
    captured = input;
    return { id: 5, ...input };
  };

  const priorFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify({
        current: {
          dt: 1711891200,
          temp: 74.5,
          humidity: 40,
          pressure: 1012,
          clouds: 20,
          wind_speed: 10,
          wind_gust: 15,
          rain: { "1h": 2.5 },
        },
      }),
  });

  const { service, restoreEnv } = buildService(deps);

  try {
    await service.fetchCurrentForHive({ beekeeperId: 1, hiveId: 2 });

    assert.equal(captured.status, "success");
    assert.equal(captured.provider, "openweather");
    assert.equal(captured.temperature, 74.5);
    assert.equal(captured.humidityPct, 40);
    assert.equal(captured.precipMm, 2.5);
    assert.ok(captured.windMps > 4 && captured.windMps < 5);
  } finally {
    global.fetch = priorFetch;
    restoreEnv();
  }
});

test("fetchCurrentForHive upserts failed status when upstream fails", async () => {
  let captured = null;
  const deps = baseDeps();
  deps.externalStubs.upsert = async (input) => {
    captured = input;
    return { id: 6, ...input };
  };

  const priorFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("network down");
  };

  const { service, restoreEnv } = buildService(deps);

  try {
    const row = await service.fetchCurrentForHive({
      beekeeperId: 1,
      hiveId: 2,
    });

    assert.equal(row.status, "failed");
    assert.equal(captured.status, "failed");
    assert.equal(captured.provider, "openweather");
    assert.equal(captured.temperature, null);
  } finally {
    global.fetch = priorFetch;
    restoreEnv();
  }
});
