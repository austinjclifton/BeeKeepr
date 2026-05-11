"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const servicePath = path.join(backendRoot, "src/services/devices.service.js");
const deviceRepoPath = path.join(backendRoot, "src/db/devices.db.js");
const hiveRepoPath = path.join(backendRoot, "src/db/hives.db.js");

function clearRequireCache() {
  delete require.cache[servicePath];
  delete require.cache[deviceRepoPath];
  delete require.cache[hiveRepoPath];
}

function buildService({ deviceRepoStubs, hiveRepoStubs }) {
  clearRequireCache();

  require.cache[deviceRepoPath] = {
    id: deviceRepoPath,
    filename: deviceRepoPath,
    loaded: true,
    exports: deviceRepoStubs,
  };

  require.cache[hiveRepoPath] = {
    id: hiveRepoPath,
    filename: hiveRepoPath,
    loaded: true,
    exports: hiveRepoStubs,
  };

  return require(servicePath);
}

function baseDeviceRepo() {
  return {
    createScoped: async () => ({ id: 1 }),
    listDevicesByBeekeeper: async () => [],
    listDevicesByHiveScoped: async () => [],
    findByIdScoped: async () => null,
    updateScoped: async () => ({ id: 1 }),
    touchLastSeenScoped: async () => ({ id: 1 }),
    removeScoped: async () => true,
  };
}

function baseHiveRepo() {
  return {
    existsScoped: async () => true,
  };
}

test("createDevice returns null when hive does not exist", async () => {
  const deviceRepo = baseDeviceRepo();
  let createCalled = false;
  deviceRepo.createScoped = async () => {
    createCalled = true;
    return { id: 1 };
  };

  const hiveRepo = baseHiveRepo();
  hiveRepo.existsScoped = async () => false;

  const service = buildService({
    deviceRepoStubs: deviceRepo,
    hiveRepoStubs: hiveRepo,
  });
  const result = await service.createDevice({
    beekeeperId: 1,
    hiveId: 2,
    installedAt: undefined,
  });

  assert.equal(result, null);
  assert.equal(createCalled, false);
});

test("createDevice maps PG unique violation to 409 conflict", async () => {
  const deviceRepo = baseDeviceRepo();
  deviceRepo.listDevicesByHiveScoped = async () => [];
  deviceRepo.createScoped = async () => {
    const err = new Error("duplicate");
    err.code = "23505";
    throw err;
  };

  const service = buildService({
    deviceRepoStubs: deviceRepo,
    hiveRepoStubs: baseHiveRepo(),
  });

  await assert.rejects(
    () =>
      service.createDevice({
        beekeeperId: 1,
        hiveId: 2,
        installedAt: undefined,
      }),
    (err) =>
      err.status === 409 &&
      err.code === "CONFLICT" &&
      err.message === "This hive already has a device",
  );
});

test("updateDevice requires at least one provided field", async () => {
  const service = buildService({
    deviceRepoStubs: baseDeviceRepo(),
    hiveRepoStubs: baseHiveRepo(),
  });

  await assert.rejects(
    () => service.updateDevice({ beekeeperId: 1, deviceId: 2 }),
    (err) =>
      err.status === 400 &&
      err.message === "Provide at least one field to update",
  );
});

test("updateDevice normalizes dates and forwards null clear", async () => {
  let captured = null;
  const deviceRepo = baseDeviceRepo();
  deviceRepo.updateScoped = async (input) => {
    captured = input;
    return { id: input.deviceId };
  };

  const service = buildService({
    deviceRepoStubs: deviceRepo,
    hiveRepoStubs: baseHiveRepo(),
  });

  await service.updateDevice({
    beekeeperId: 3,
    deviceId: 4,
    installedAt: new Date("2026-03-01T10:00:00.000Z"),
    lastSeenAt: null,
  });

  assert.equal(captured.beekeeperId, 3);
  assert.equal(captured.deviceId, 4);
  assert.equal(captured.installedAt, "2026-03-01T10:00:00.000Z");
  assert.equal(captured.lastSeenAt, null);
});

test("touchLastSeen validates seenAt and forwards ISO", async () => {
  let captured = null;
  const deviceRepo = baseDeviceRepo();
  deviceRepo.touchLastSeenScoped = async (input) => {
    captured = input;
    return { id: input.deviceId };
  };

  const service = buildService({
    deviceRepoStubs: deviceRepo,
    hiveRepoStubs: baseHiveRepo(),
  });

  await service.touchLastSeen({
    beekeeperId: 8,
    deviceId: 9,
    seenAt: "2026-03-20T12:00:00.000Z",
  });

  assert.deepEqual(captured, {
    beekeeperId: 8,
    deviceId: 9,
    seenAt: "2026-03-20T12:00:00.000Z",
  });
});

test("touchLastSeen rejects invalid seenAt", async () => {
  const service = buildService({
    deviceRepoStubs: baseDeviceRepo(),
    hiveRepoStubs: baseHiveRepo(),
  });

  await assert.rejects(
    () =>
      service.touchLastSeen({
        beekeeperId: 1,
        deviceId: 2,
        seenAt: "not-a-date",
      }),
    (err) =>
      err.status === 400 &&
      err.message === "seenAt must be a valid ISO8601 timestamp",
  );
});

test("listDevicesForHive returns null when hive is outside scope", async () => {
  const hiveRepo = baseHiveRepo();
  hiveRepo.existsScoped = async () => false;

  const service = buildService({
    deviceRepoStubs: baseDeviceRepo(),
    hiveRepoStubs: hiveRepo,
  });
  const result = await service.listDevicesForHive({
    beekeeperId: 2,
    hiveId: 20,
  });

  assert.equal(result, null);
});
