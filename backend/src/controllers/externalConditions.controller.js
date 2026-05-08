"use strict";
const externalConditionsService = require("../services/externalConditions.service.js");

/**
 * GET /api/external-conditions/latest?hiveId=123
 */
exports.latestForHive = async (req, res, next) => {
  try {
    const q = safeQuery(req);

    const externalCondition = await externalConditionsService.getLatestForHive({
      beekeeperId: authedUserId(req),
      hiveId: requireQueryParamAsPositiveInt(q, "hiveId"),
    });

    if (!externalCondition) {
      return res
        .status(404)
        .json({ error: "No external conditions found for hive" });
    }

    return res.status(200).json({ externalCondition });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/external-conditions/since?hiveId=123&since=...&until=...&limit=...&order=...
 */
exports.sinceForHive = async (req, res, next) => {
  try {
    const q = safeQuery(req);

    const externalConditions = await externalConditionsService.getForHiveSince({
      beekeeperId: authedUserId(req),
      hiveId: requireQueryParamAsPositiveInt(q, "hiveId"),
      since: requireQueryParamAsIsoDate(q, "since"),
      until: q.until ? requireQueryParamAsIsoDate(q, "until") : undefined,
      limit: q.limit,
      order: q.order,
    });

    return res.status(200).json({ externalConditions });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/external-conditions/fetch?hiveId=123
 */
exports.fetchForHive = async (req, res, next) => {
  try {
    const q = safeQuery(req);

    const externalCondition =
      await externalConditionsService.fetchCurrentForHive({
        beekeeperId: authedUserId(req),
        hiveId: requireQueryParamAsPositiveInt(q, "hiveId"),
      });

    return res.status(200).json({ externalCondition });
  } catch (err) {
    return next(err);
  }
};

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

  // express can represent query params as string | string[] | undefined
  const value = Array.isArray(raw) ? raw[0] : raw;
  const s = toTrimmedString(value);

  if (!s) throw badRequest(`${name} is required`);
  return s;
}

function requireQueryParamAsPositiveInt(query, name) {
  const s = requireQueryParam(query, name);
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest(`${name} must be a positive integer`);
  }
  return n;
}

function requireQueryParamAsIsoDate(query, name) {
  const s = requireQueryParam(query, name);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`${name} must be a valid ISO date string`);
  }
  // keep the original string so downstream can preserve timezone semantics if desired
  return s;
}

function authedUserId(req) {
  const n = Number(req.user?.id);
  if (!Number.isInteger(n) || n <= 0) throw badRequest("Invalid authenticated user");
  return n;
}