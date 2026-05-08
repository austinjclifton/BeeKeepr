"use strict";

const hiveService = require("../services/hives.service.js");

/* ========================================================================== */
/* GET                                                                         */
/* ========================================================================== */

/**
 * GET /api/hives
 * List hives for the authenticated beekeeper
 */
exports.list = async (req, res, next) => {
  try {
    const hives = await hiveService.listHives({
      beekeeperId: authedUserId(req),
    });

    return res.status(200).json({ hives });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/hives/:id
 * Get a single hive by id (scoped)
 */
exports.getById = async (req, res, next) => {
  try {
    const hive = await hiveService.getHive({
      beekeeperId: authedUserId(req),
      hiveId: toPositiveInt(req.params.id, "id"),
    });

    if (!hive) {
      return res.status(404).json({ error: "Hive not found" });
    }

    return res.status(200).json({ hive });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* POST                                                                        */
/* ========================================================================== */

/**
 * POST /api/hives
 * Create a hive (scoped)
 */
exports.create = async (req, res, next) => {
  try {
    const body = safeBody(req);

    // Preserve existing semantics: only reject when missing, not empty string/null.
    if (body.name === undefined) {
      throw badRequest("name is required");
    }

    const hive = await hiveService.createHive({
      beekeeperId: authedUserId(req),
      name: body.name,
      notes: body.notes, // service handles semantics
      locationId: body.locationId, // allow locationId on create
    });

    return res.status(201).json({ hive });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* PATCH                                                                       */
/* ========================================================================== */

/**
 * PATCH /api/hives/:id
 * Update hive fields (scoped)
 */
exports.update = async (req, res, next) => {
  try {
    const body = safeBody(req);

    const hive = await hiveService.updateHive({
      beekeeperId: authedUserId(req),
      hiveId: toPositiveInt(req.params.id, "id"),
      name: body.name,
      notes: body.notes,
      locationId: body.locationId,
    });

    if (!hive) {
      return res.status(404).json({ error: "Hive not found" });
    }

    return res.status(200).json({ hive });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* DELETE                                                                      */
/* ========================================================================== */

/**
 * DELETE /api/hives/:id
 * Delete a hive (scoped)
 */
exports.remove = async (req, res, next) => {
  try {
    const deleted = await hiveService.deleteHive({
      beekeeperId: authedUserId(req),
      hiveId: toPositiveInt(req.params.id, "id"),
    });

    if (!deleted) {
      return res.status(404).json({ error: "Hive not found" });
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