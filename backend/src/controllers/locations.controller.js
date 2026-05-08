"use strict";

const locationsService = require("../services/locations.service.js");

/* ========================================================================== */
/* GET                                                                         */
/* ========================================================================== */

/**
 * GET /api/locations?limit=&order=
 */
exports.listLocations = async (req, res, next) => {
  try {
    const q = safeQuery(req);

    const locations = await locationsService.listLocations({
      limit: q.limit,
      order: q.order,
    });

    return res.status(200).json({ locations });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/locations/:locationId
 */
exports.getById = async (req, res, next) => {
  try {
    const locationId = requireParam(req, "locationId");

    const location = await locationsService.getById({ locationId });
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    return res.status(200).json({ location });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* POST                                                                        */
/* ========================================================================== */

/**
 * POST /api/locations
 */
exports.create = async (req, res, next) => {
  try {
    const body = safeBody(req);

    const location = await locationsService.createOrGetLocation({
      name: body.name,
      lat: requireBodyField(body, "lat"),
      lon: requireBodyField(body, "lon"),
    });

    return res.status(201).json({ location });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* PATCH                                                                       */
/* ========================================================================== */

/**
 * PATCH /api/locations/:locationId
 */
exports.update = async (req, res, next) => {
  try {
    const locationId = requireParam(req, "locationId");
    const body = safeBody(req);

    const location = await locationsService.update({
      locationId,
      name: body.name,
      lat: body.lat,
      lon: body.lon,
    });

    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    return res.status(200).json({ location });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* DELETE                                                                      */
/* ========================================================================== */

/**
 * DELETE /api/locations/:locationId
 */
exports.remove = async (req, res, next) => {
  try {
    const locationId = requireParam(req, "locationId");

    const ok = await locationsService.remove({ locationId });
    if (!ok) {
      return res.status(404).json({ error: "Location not found" });
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

function requireBodyField(body, name) {
  const value = body[name];
  if (value === undefined || value === null || value === "") {
    throw badRequest(`${name} is required`);
  }
  return value;
}

function requireParam(req, name) {
  const value = req.params?.[name];
  if (value === undefined || value === null || value === "") {
    throw badRequest(`${name} is required`);
  }
  return value;
}
