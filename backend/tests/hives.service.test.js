"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const servicePath = path.join(backendRoot, "src/services/hives.service.js");
const hiveRepoPath = path.join(backendRoot, "src/db/hives.db.js");
const locationRepoPath = path.join(backendRoot, "src/db/locations.db.js");

function clearRequireCache() {
  delete require.cache[servicePath];
  delete require.cache[hiveRepoPath];
  delete require.cache[locationRepoPath];
}

function buildService({ hiveRepoStubs, locationRepoStubs = baseLocationRepo() }) {
  clearRequireCache();

  require.cache[hiveRepoPath] = {
    id: hiveRepoPath,
    filename: hiveRepoPath,
    loaded: true,
    exports: hiveRepoStubs,
  };

  require.cache[locationRepoPath] = {
    id: locationRepoPath,
    filename: locationRepoPath,
    loaded: true,
    exports: locationRepoStubs,
  };

  return require(servicePath);
}

function baseHiveRepo() {
  return {
    findByIdScoped: async () => ({
      id: 10,
      beekeeper_id: 5,
      name: "North Hive",
      status: "active",
      archived_at: null,
      warning_low_threshold: 92,
      warning_high_threshold: 99,
      critical_low_threshold: 88,
      critical_high_threshold: 104,
    }),
    updateScoped: async (input) => ({ id: input.hiveId, ...input }),
  };
}

function baseLocationRepo() {
  return {
    findById: async () => ({ id: 1 }),
  };
}

test("updateHive validates per-hive threshold ordering", async () => {
  let updated = false;
  const repo = baseHiveRepo();
  repo.updateScoped = async () => {
    updated = true;
    return {};
  };

  const service = buildService({ hiveRepoStubs: repo });

  await assert.rejects(
    () =>
      service.updateHive({
        beekeeperId: 5,
        hiveId: 10,
        criticalLowThreshold: 95,
        warningLowThreshold: 92,
        warningHighThreshold: 99,
        criticalHighThreshold: 104,
      }),
    (err) =>
      err.status === 400 &&
      err.message ===
        "Thresholds must satisfy criticalLowThreshold < warningLowThreshold < warningHighThreshold < criticalHighThreshold",
  );
  assert.equal(updated, false);
});

test("updateHive saves valid thresholds only for the scoped hive", async () => {
  let captured = null;
  const repo = baseHiveRepo();
  repo.updateScoped = async (input) => {
    captured = input;
    return { id: input.hiveId, warning_low_threshold: input.warningLowThreshold };
  };

  const service = buildService({ hiveRepoStubs: repo });
  const result = await service.updateHive({
    beekeeperId: 5,
    hiveId: 10,
    criticalLowThreshold: "88",
    warningLowThreshold: "92",
    warningHighThreshold: "99",
    criticalHighThreshold: "104",
  });

  assert.equal(result.id, 10);
  assert.equal(captured.beekeeperId, 5);
  assert.equal(captured.hiveId, 10);
  assert.equal(captured.warningLowThreshold, 92);
  assert.equal(captured.warningHighThreshold, 99);
  assert.equal(captured.criticalLowThreshold, 88);
  assert.equal(captured.criticalHighThreshold, 104);
});

test("updateHive returns null for another beekeeper's hive", async () => {
  let updated = false;
  const repo = baseHiveRepo();
  repo.findByIdScoped = async () => null;
  repo.updateScoped = async () => {
    updated = true;
    return {};
  };

  const service = buildService({ hiveRepoStubs: repo });
  const result = await service.updateHive({
    beekeeperId: 5,
    hiveId: 99,
    criticalLowThreshold: 88,
    warningLowThreshold: 92,
    warningHighThreshold: 99,
    criticalHighThreshold: 104,
  });

  assert.equal(result, null);
  assert.equal(updated, false);
});
