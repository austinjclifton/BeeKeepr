"use strict";

/**
 * Readings Service
 *
 * Responsibilities
 * - Enforce policy and validation for ids, dates, limits, and ordering
 * - Delegate ownership enforcement to repository joins across beekeeper, hive, device, reading
 *
 * Notes
 * - Timestamp-based only and callers provide explicit since and optional until
 * - Read-only since telemetry is immutable
 */

const readingRepo = require("../db/readings.db.js");

/* ========================================================================== */
/* Config                                                                      */
/* ========================================================================== */

// Default 500 keeps responses snappy
// Max 10000 supports larger exports when requested
const HIVE_READ_LIMIT = Object.freeze({
  defaultValue: 500,
  max: 10000,
});

/* ========================================================================== */
/* Public API                                                                  */
/* ========================================================================== */

exports.getHiveReadingsSince = async ({
  beekeeperId,
  hiveId,
  since,
  until,
  limit,
  order,
}) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const hId = requirePositiveInt("hiveId", hiveId);

  const sinceDate = parseDateLike("since", since);
  const untilDate = parseOptionalUntil(sinceDate, until);

  const lim = normalizeLimit(limit, HIVE_READ_LIMIT);
  const ord = normalizeOrder(order);

  return readingRepo.getHiveReadingsSince({
    beekeeperId: bkId,
    hiveId: hId,
    since: sinceDate,
    until: untilDate,
    limit: lim,
    order: ord,
  });
};

exports.getLatestForHive = async ({ beekeeperId, hiveId }) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const hId = requirePositiveInt("hiveId", hiveId);

  return readingRepo.getLatestForHive({
    beekeeperId: bkId,
    hiveId: hId,
  });
};

exports.getHiveDailySince = async ({ beekeeperId, hiveId, since, until }) => {
  requirePositiveInt("beekeeperId", beekeeperId);
  requirePositiveInt("hiveId", hiveId);

  const sinceDate = parseDateLike("since", since);
  parseOptionalUntil(sinceDate, until);

  return readingRepo.getHiveDailySince();
};

/* ========================================================================== */
/* Validation                                                                  */
/* ========================================================================== */

function requirePositiveInt(name, value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest(`Invalid ${name}`);
  }
  return n;
}

function parseDateLike(name, value) {
  if (value === undefined || value === null || value === "") {
    throw badRequest(`Invalid ${name}`);
  }

  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`Invalid ${name}`);
  }

  return d;
}

function parseOptionalUntil(sinceDate, until) {
  if (until === undefined || until === null || until === "") return null;

  const u = parseDateLike("until", until);
  if (u.getTime() <= sinceDate.getTime()) {
    throw badRequest("Invalid until");
  }

  return u;
}

function normalizeLimit(limit, { max, defaultValue }) {
  if (limit === undefined || limit === null || limit === "")
    return defaultValue;

  const n = Number(limit);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest("Invalid limit");
  }

  return Math.min(n, max);
}

function normalizeOrder(order) {
  // Default to desc for time-series
  if (order === undefined || order === null || order === "") return "desc";

  const o = String(order).toLowerCase().trim();
  if (o !== "asc" && o !== "desc") {
    throw badRequest("Invalid order");
  }

  return o;
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
