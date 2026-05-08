"use strict";

const hiveRepo = require("../db/hives.db.js");
const locationRepo = require("../db/locations.db.js");

/* ========================================================================== */
/* Config                                                                      */
/* ========================================================================== */

const HIVE_NAME_MAX = 100;

/* ========================================================================== */
/* Public API                                                                  */
/* ========================================================================== */

exports.createHive = async ({ beekeeperId, name, notes, locationId }) => {
  assertPositiveInt(beekeeperId, "beekeeperId");

  const nameNorm = normalizeRequiredName(name);
  const notesNorm = normalizeNotesForCreate(notes);
  const locationIdNorm = normalizeLocationIdForCreate(locationId);

  if (locationIdNorm !== null) {
    await assertLocationExists(locationIdNorm);
  }

  return hiveRepo.create({
    beekeeperId,
    name: nameNorm,
    notes: notesNorm,
    locationId: locationIdNorm,
  });
};

exports.listHives = async ({ beekeeperId }) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  return hiveRepo.listHivesByBeekeeper({ beekeeperId });
};

exports.getHive = async ({ beekeeperId, hiveId }) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  assertPositiveInt(hiveId, "hiveId");

  return hiveRepo.findByIdScoped({ beekeeperId, hiveId });
};

exports.updateHive = async ({
  beekeeperId,
  hiveId,
  name,
  notes,
  locationId,
}) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  assertPositiveInt(hiveId, "hiveId");

  const nameNorm = normalizeNameForPatch(name);
  const notesNorm = normalizeNotesForPatch(notes);
  const locationIdNorm = normalizeLocationIdForPatch(locationId);

  if (
    nameNorm === undefined &&
    notesNorm === undefined &&
    locationIdNorm === undefined
  ) {
    throw badRequest("Provide at least one field to update");
  }

  if (locationIdNorm !== undefined && locationIdNorm !== null) {
    await assertLocationExists(locationIdNorm);
  }

  return hiveRepo.updateScoped({
    beekeeperId,
    hiveId,
    name: nameNorm,
    notes: notesNorm,
    locationId: locationIdNorm,
  });
};

exports.deleteHive = async ({ beekeeperId, hiveId }) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  assertPositiveInt(hiveId, "hiveId");

  return hiveRepo.removeScoped({ beekeeperId, hiveId });
};

/* ========================================================================== */
/* Validation                                                                  */
/* ========================================================================== */

function assertPositiveInt(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw badRequest(`${field} must be a positive integer`);
  }
}

function coercePositiveInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest(`${field} must be a positive integer`);
  }
  return n;
}

async function assertLocationExists(locationId) {
  const location = await locationRepo.findById({ locationId });

  if (!location) {
    throw httpError(404, "LOCATION_NOT_FOUND", "Location not found");
  }
}

/* ========================================================================== */
/* Normalization                                                               */
/* ========================================================================== */

function normalizeRequiredName(name) {
  if (typeof name !== "string") {
    throw badRequest("name is required");
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw badRequest("name is required");
  }

  if (trimmed.length > HIVE_NAME_MAX) {
    throw badRequest(`name cannot exceed ${HIVE_NAME_MAX} characters`);
  }

  return trimmed;
}

function normalizeNameForPatch(name) {
  if (name === undefined) return undefined;

  if (name === null) {
    throw badRequest("name cannot be null");
  }

  if (typeof name !== "string") {
    throw badRequest("name must be a string");
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw badRequest("name cannot be empty");
  }

  if (trimmed.length > HIVE_NAME_MAX) {
    throw badRequest(`name cannot exceed ${HIVE_NAME_MAX} characters`);
  }

  return trimmed;
}

function normalizeNotesForPatch(notes) {
  // undefined => not provided
  // null => clear
  // string => trimmed which may be empty
  if (notes === undefined) return undefined;
  if (notes === null) return null;

  if (typeof notes !== "string") {
    throw badRequest("notes must be a string or null");
  }

  return notes.trim();
}

function normalizeNotesForCreate(notes) {
  // undefined or null => store null
  // string => trimmed
  if (notes === undefined || notes === null) return null;
  return normalizeNotesForPatch(notes);
}

function normalizeLocationIdForCreate(locationId) {
  // undefined or null => store null
  // number or string => positive int
  if (locationId === undefined || locationId === null) return null;
  return coercePositiveInt(locationId, "locationId");
}

function normalizeLocationIdForPatch(locationId) {
  // undefined => not provided
  // null => clear
  // number or string => positive int
  if (locationId === undefined) return undefined;
  if (locationId === null) return null;
  return coercePositiveInt(locationId, "locationId");
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
