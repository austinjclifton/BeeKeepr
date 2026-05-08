"use strict";
const alertsService = require("../services/alerts.service.js");

/**
 * GET /api/alerts?hiveId=123 (optional)
 *
 * Returns alerts for the authenticated beekeeper.
 * - Optionally filtered by hiveId
 */
exports.list = async (req, res, next) => {
  try {
    const beekeeperId = authedUserId(req);

    const hiveId = req.query.hiveId
      ? toPositiveInt(req.query.hiveId, "hiveId")
      : null;

    const alerts = await alertsService.listAlerts({
      beekeeperId,
      hiveId,
    });

    return res.status(200).json({
      success: true,
      alerts,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/alerts/:alertId/resolve
 *
 * Resolves a critical alert.
 * - Only critical alerts can be resolved
 */
exports.resolve = async (req, res, next) => {
  try {
    const beekeeperId = authedUserId(req);

    const alertId = toPositiveInt(req.params.alertId, "alertId");

    const alert = await alertsService.resolveAlert({
      beekeeperId,
      alertId,
    });

    return res.status(200).json({
      success: true,
      alert,
    });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

function authedUserId(req) {
  const id = req?.user?.id;
  if (!Number.isInteger(id) || id <= 0) {
    const e = new Error("Unauthorized");
    e.status = 401;
    e.code = "UNAUTHORIZED";
    throw e;
  }
  return id;
}

function toPositiveInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    const e = new Error(`${field} must be a positive integer`);
    e.status = 400;
    e.code = "VALIDATION_ERROR";
    throw e;
  }
  return n;
}
