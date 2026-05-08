"use strict";

const readingService = require("../services/readings.service.js");

/* ========================================================================== */
/* GET                                                                         */
/* ========================================================================== */

/**
 * GET /api/readings/since?hiveId=123&since=...&until=...&limit=...&order=...
 */
exports.since = async (req, res, next) => {
  try {
    const q = safeQuery(req);

    const readings = await readingService.getHiveReadingsSince({
      beekeeperId: authedUserId(req),
      hiveId: requireQueryParam(q, "hiveId"),
      since: requireQueryParam(q, "since"),
      until: q.until,
      limit: q.limit,
      order: q.order,
    });

    return res.status(200).json({ readings });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/readings/latest?hiveId=123
 */
exports.latest = async (req, res, next) => {
  try {
    const q = safeQuery(req);

    const reading = await readingService.getLatestForHive({
      beekeeperId: authedUserId(req),
      hiveId: requireQueryParam(q, "hiveId"),
    });

    if (!reading || reading.hive_id === null) {
      return res.status(404).json({ error: "Hive not found" });
    }

    return res.status(200).json({ reading });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* POST                                                                        */
/* ========================================================================== */

/* ========================================================================== */
/* PATCH                                                                       */
/* ========================================================================== */

/* ========================================================================== */
/* DELETE                                                                      */
/* ========================================================================== */

/* ========================================================================== */
/* Helpers                                                                     */
/* ========================================================================== */

function safeQuery(req) {
  return req.query ?? {};
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function badRequest(message) {
  return httpError(400, "VALIDATION_ERROR", message);
}

function toTrimmedString(value) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function requireQueryParam(query, name) {
  const raw = query[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const s = toTrimmedString(value);
  if (!s) throw badRequest(`${name} is required`);
  return s;
}

function authedUserId(req) {
  const n = Number(req.user?.id);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest("Invalid authenticated user");
  }
  return n;
}
