"use strict";

const hiveRepo = require("../db/hives.db.js");
const locationRepo = require("../db/locations.db.js");

/* ========================================================================== */
/* Config                                                                      */
/* ========================================================================== */

const HIVE_NAME_MAX = 100;
const HIVE_STATUSES = new Set(["active", "inactive", "archived"]);

/* ========================================================================== */
/* Public API                                                                  */
/* ========================================================================== */

exports.createHive = async ({
  beekeeperId,
  name,
  notes,
  locationId,
  status,
  installedAt,
  archivedAt,
  warningLowThreshold,
  warningHighThreshold,
  criticalLowThreshold,
  criticalHighThreshold,
}) => {
  assertPositiveInt(beekeeperId, "beekeeperId");

  const nameNorm = normalizeRequiredName(name);
  const notesNorm = normalizeNotesForCreate(notes);
  const locationIdNorm = normalizeLocationIdForCreate(locationId);
  const statusNorm = normalizeStatusForCreate(status);
  const installedAtNorm = normalizeTimestampForCreate(installedAt, "installedAt");
  const archivedAtNorm = normalizeTimestampForCreate(archivedAt, "archivedAt");
  const thresholds = normalizeThresholds({
    warningLowThreshold,
    warningHighThreshold,
    criticalLowThreshold,
    criticalHighThreshold,
  });

  assertArchiveState({
    status: statusNorm,
    archivedAt: archivedAtNorm,
  });
  assertThresholdOrder(thresholds);

  if (locationIdNorm !== null) {
    await assertLocationExists(locationIdNorm);
  }

  return hiveRepo.create({
    beekeeperId,
    name: nameNorm,
    notes: notesNorm,
    locationId: locationIdNorm,
    status: statusNorm,
    installedAt: installedAtNorm,
    archivedAt: archivedAtNorm,
    ...thresholds,
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
  status,
  installedAt,
  archivedAt,
  warningLowThreshold,
  warningHighThreshold,
  criticalLowThreshold,
  criticalHighThreshold,
}) => {
  assertPositiveInt(beekeeperId, "beekeeperId");
  assertPositiveInt(hiveId, "hiveId");

  const nameNorm = normalizeNameForPatch(name);
  const notesNorm = normalizeNotesForPatch(notes);
  const locationIdNorm = normalizeLocationIdForPatch(locationId);
  const statusNorm = normalizeStatusForPatch(status);
  const installedAtNorm = normalizeTimestampForPatch(installedAt, "installedAt");
  const archivedAtNorm = normalizeTimestampForPatch(archivedAt, "archivedAt");
  const thresholds = normalizeThresholds({
    warningLowThreshold,
    warningHighThreshold,
    criticalLowThreshold,
    criticalHighThreshold,
    patch: true,
  });

  if (
    nameNorm === undefined &&
    notesNorm === undefined &&
    locationIdNorm === undefined &&
    statusNorm === undefined &&
    installedAtNorm === undefined &&
    archivedAtNorm === undefined &&
    thresholds.warningLowThreshold === undefined &&
    thresholds.warningHighThreshold === undefined &&
    thresholds.criticalLowThreshold === undefined &&
    thresholds.criticalHighThreshold === undefined
  ) {
    throw badRequest("Provide at least one field to update");
  }

  const existing = await hiveRepo.findByIdScoped({ beekeeperId, hiveId });
  if (!existing) return null;

  assertArchiveState({
    status: statusNorm ?? existing.status,
    archivedAt:
      archivedAtNorm !== undefined ? archivedAtNorm : existing.archived_at,
  });
  assertThresholdOrder({
    warningLowThreshold:
      thresholds.warningLowThreshold !== undefined
        ? thresholds.warningLowThreshold
        : existing.warning_low_threshold,
    warningHighThreshold:
      thresholds.warningHighThreshold !== undefined
        ? thresholds.warningHighThreshold
        : existing.warning_high_threshold,
    criticalLowThreshold:
      thresholds.criticalLowThreshold !== undefined
        ? thresholds.criticalLowThreshold
        : existing.critical_low_threshold,
    criticalHighThreshold:
      thresholds.criticalHighThreshold !== undefined
        ? thresholds.criticalHighThreshold
        : existing.critical_high_threshold,
  });

  if (locationIdNorm !== undefined && locationIdNorm !== null) {
    await assertLocationExists(locationIdNorm);
  }

  return hiveRepo.updateScoped({
    beekeeperId,
    hiveId,
    name: nameNorm,
    notes: notesNorm,
    locationId: locationIdNorm,
    status: statusNorm,
    installedAt: installedAtNorm,
    archivedAt: archivedAtNorm,
    ...thresholds,
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

function normalizeStatusForCreate(status) {
  if (status === undefined) return "active";
  return normalizeStatus(status);
}

function normalizeStatusForPatch(status) {
  if (status === undefined) return undefined;
  return normalizeStatus(status);
}

function normalizeStatus(status) {
  if (typeof status !== "string") {
    throw badRequest("status must be a string");
  }

  const normalized = status.trim().toLowerCase();
  if (!HIVE_STATUSES.has(normalized)) {
    throw badRequest("status must be active, inactive, or archived");
  }

  return normalized;
}

function normalizeTimestampForCreate(value, field) {
  if (value === undefined || value === null) return null;
  return normalizeTimestamp(value, field);
}

function normalizeTimestampForPatch(value, field) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return normalizeTimestamp(value, field);
}

function normalizeTimestamp(value, field) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`${field} must be a valid ISO8601 timestamp`);
  }

  return d.toISOString();
}

function normalizeThresholds({
  warningLowThreshold,
  warningHighThreshold,
  criticalLowThreshold,
  criticalHighThreshold,
  patch = false,
}) {
  const normalize = patch
    ? normalizeNumberOrNullForPatch
    : normalizeNumberOrNullForCreate;

  return {
    warningLowThreshold: normalize(
      warningLowThreshold,
      "warningLowThreshold",
    ),
    warningHighThreshold: normalize(
      warningHighThreshold,
      "warningHighThreshold",
    ),
    criticalLowThreshold: normalize(
      criticalLowThreshold,
      "criticalLowThreshold",
    ),
    criticalHighThreshold: normalize(
      criticalHighThreshold,
      "criticalHighThreshold",
    ),
  };
}

function normalizeNumberOrNullForCreate(value, field) {
  if (value === undefined || value === null) return null;
  return normalizeNumber(value, field);
}

function normalizeNumberOrNullForPatch(value, field) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return normalizeNumber(value, field);
}

function normalizeNumber(value, field) {
  const n = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(n)) {
    throw badRequest(`${field} must be a valid number or null`);
  }

  return n;
}

function assertArchiveState({ status, archivedAt }) {
  if (status === "archived" && archivedAt === null) {
    throw badRequest("archivedAt is required when status is archived");
  }

  if (status !== "archived" && archivedAt !== null) {
    throw badRequest("archivedAt must be null unless status is archived");
  }
}

function assertThresholdOrder(thresholds) {
  const values = [
    thresholds.warningLowThreshold,
    thresholds.warningHighThreshold,
    thresholds.criticalLowThreshold,
    thresholds.criticalHighThreshold,
  ];

  const allEmpty = values.every((value) => value == null);
  const allPresent = values.every((value) => value != null);

  if (!allEmpty && !allPresent) {
    throw badRequest(
      "Hive thresholds must either all be numbers or all be null",
    );
  }

  if (allEmpty) return;

  if (!(thresholds.criticalLowThreshold < thresholds.warningLowThreshold)) {
    throw thresholdOrderError();
  }

  if (!(thresholds.warningLowThreshold < thresholds.warningHighThreshold)) {
    throw thresholdOrderError();
  }

  if (!(thresholds.warningHighThreshold < thresholds.criticalHighThreshold)) {
    throw thresholdOrderError();
  }
}

function thresholdOrderError() {
  return badRequest(
    "Thresholds must satisfy criticalLowThreshold < warningLowThreshold < warningHighThreshold < criticalHighThreshold",
  );
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
