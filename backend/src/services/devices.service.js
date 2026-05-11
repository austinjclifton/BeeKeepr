"use strict";

const deviceRepo = require("../db/devices.db.js");
const hiveRepo = require("../db/hives.db.js");

/* ========================================================================== */
/* Public API                                                                  */
/* ========================================================================== */

exports.createDevice = async ({ beekeeperId, hiveId, installedAt }) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  assertPositiveInt(hiveId, "hiveId");

  const hiveExists = await hiveRepo.existsScoped({ beekeeperId, hiveId });
  if (!hiveExists) return null;

  await assertHiveHasNoDevice({ beekeeperId, hiveId });

  const installedIso = normalizeOptionalIso(installedAt, "installedAt");

  try {
    return await deviceRepo.createScoped({
      beekeeperId,
      hiveId,
      installedAt: installedIso,
    });
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw conflict("This hive already has a device");
    }
    throw err;
  }
};

exports.listDevices = async ({ beekeeperId }) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  return deviceRepo.listDevicesByBeekeeper({ beekeeperId });
};

exports.listDevicesForHive = async ({ beekeeperId, hiveId }) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  assertPositiveInt(hiveId, "hiveId");

  const hiveExists = await hiveRepo.existsScoped({ beekeeperId, hiveId });
  if (!hiveExists) return null;

  return deviceRepo.listDevicesByHiveScoped({ beekeeperId, hiveId });
};

exports.getDevice = async ({ beekeeperId, deviceId }) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  assertPositiveInt(deviceId, "deviceId");

  return deviceRepo.findByIdScoped({ beekeeperId, deviceId });
};

exports.updateDevice = async ({
  beekeeperId,
  deviceId,
  installedAt,
  lastSeenAt,
}) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  assertPositiveInt(deviceId, "deviceId");

  const installedIso = normalizeOptionalIso(installedAt, "installedAt");
  const lastSeenIso = normalizeOptionalIso(lastSeenAt, "lastSeenAt");

  // Enforce PATCH semantics at the service boundary
  if (installedIso === undefined && lastSeenIso === undefined) {
    throw badRequest("Provide at least one field to update");
  }

  return deviceRepo.updateScoped({
    beekeeperId,
    deviceId,
    installedAt: installedIso,
    lastSeenAt: lastSeenIso,
  });
};

exports.touchLastSeen = async ({ beekeeperId, deviceId, seenAt }) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  assertPositiveInt(deviceId, "deviceId");

  const seenIso = normalizeOptionalIso(seenAt, "seenAt");

  return deviceRepo.touchLastSeenScoped({
    beekeeperId,
    deviceId,
    seenAt: seenIso,
  });
};

exports.deleteDevice = async ({ beekeeperId, deviceId }) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  assertPositiveInt(deviceId, "deviceId");

  return deviceRepo.removeScoped({ beekeeperId, deviceId });
};

/* ========================================================================== */
/* Domain rules                                                                */
/* ========================================================================== */

async function assertHiveHasNoDevice({ beekeeperId, hiveId }) {
  // Uses scoped hive listing so ownership rules match device creation
  const existing = await deviceRepo.listDevicesByHiveScoped({ beekeeperId, hiveId });
  if (existing && existing.length > 0) {
    throw conflict("This hive already has a device");
  }
}

/* ========================================================================== */
/* Normalization                                                               */
/* ========================================================================== */

function normalizeOptionalIso(value, field) {
  // undefined => not provided which preserves PATCH semantics
  // null => explicitly clear
  if (value === undefined) return undefined;
  if (value === null) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`${field} must be a valid ISO8601 timestamp`);
  }

  return d.toISOString();
}

/* ========================================================================== */
/* Validation                                                                  */
/* ========================================================================== */

function assertPositiveInt(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw badRequest(`${field} must be a positive integer`);
  }
}

/* ========================================================================== */
/* Repo error mapping                                                          */
/* ========================================================================== */

function isPgUniqueViolation(err) {
  return Boolean(err && err.code === "23505");
}

/* ========================================================================== */
/* Errors                                                                      */
/* ========================================================================== */

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function badRequest(message) {
  return httpError(400, "VALIDATION_ERROR", message);
}

function conflict(message) {
  return httpError(409, "CONFLICT", message);
}
