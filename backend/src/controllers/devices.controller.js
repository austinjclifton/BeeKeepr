"use strict";

const deviceService = require("../services/devices.service.js");

/* ========================================================================== */
/* GET                                                                         */
/* ========================================================================== */

/**
 * GET /api/devices
 * List devices for the authenticated beekeeper
 */
exports.list = async (req, res, next) => {
  try {
    const devices = await deviceService.listDevices({
      beekeeperId: authedUserId(req),
    });

    return res.status(200).json({ devices });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/hives/:hiveId/devices
 * List devices for a specific hive (scoped)
 */
exports.listForHive = async (req, res, next) => {
  try {
    const devices = await deviceService.listDevicesForHive({
      beekeeperId: authedUserId(req),
      hiveId: toPositiveInt(req.params.hiveId, "hiveId"),
    });

    if (devices === null) {
      return res.status(404).json({ error: "Hive not found" });
    }

    return res.status(200).json({ devices });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/devices/:id
 * Get a single device by id (scoped)
 */
exports.getById = async (req, res, next) => {
  try {
    const device = await deviceService.getDevice({
      beekeeperId: authedUserId(req),
      deviceId: toPositiveInt(req.params.id, "id"),
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    return res.status(200).json({ device });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* POST                                                                        */
/* ========================================================================== */

/**
 * POST /api/hives/:hiveId/devices
 * Create a device for a specific hive (scoped)
 */
exports.createForHive = async (req, res, next) => {
  try {
    const body = safeBody(req);

    const device = await deviceService.createDevice({
      beekeeperId: authedUserId(req),
      hiveId: toPositiveInt(req.params.hiveId, "hiveId"),
      installedAt: body.installedAt,
    });

    if (!device) {
      return res.status(404).json({ error: "Hive not found" });
    }

    return res.status(201).json({ device });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/devices/:id/last-seen
 * Update last-seen timestamp for a device (scoped)
 */
exports.touchLastSeen = async (req, res, next) => {
  try {
    const body = safeBody(req);

    const device = await deviceService.touchLastSeen({
      beekeeperId: authedUserId(req),
      deviceId: toPositiveInt(req.params.id, "id"),
      seenAt: body.seenAt, // undefined => service/repo defaults now()
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    return res.status(200).json({ device });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* PATCH                                                                       */
/* ========================================================================== */

/* ========================================================================== */
/* DELETE                                                                      */
/* ========================================================================== */

/**
 * DELETE /api/devices/:id
 * Delete a device (scoped)
 */
exports.remove = async (req, res, next) => {
  try {
    const deleted = await deviceService.deleteDevice({
      beekeeperId: authedUserId(req),
      deviceId: toPositiveInt(req.params.id, "id"),
    });

    if (!deleted) {
      return res.status(404).json({ error: "Device not found" });
    }

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* Helpers                                                                     */
/* ========================================================================== */

function safeBody(req) {
  return req.body ?? {};
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = "VALIDATION_ERROR";
  return err;
}

function toPositiveInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest(`${field} must be a positive integer`);
  }
  return n;
}

function authedUserId(req) {
  const id = Number(req.user?.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest("Invalid authenticated user");
  }
  return id;
}