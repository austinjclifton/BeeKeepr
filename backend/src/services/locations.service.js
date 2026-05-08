"use strict";

const locationsRepo = require("../db/locations.db.js");

/* ========================================================================== */
/* Config                                                                      */
/* ========================================================================== */

const LIST_LIMIT = Object.freeze({
  defaultValue: 100,
  max: 10000,
});

const NAME_MAX = 120;

/* ========================================================================== */
/* Public API                                                                  */
/* ========================================================================== */

exports.getById = async ({ locationId }) => {
  const id = requirePositiveInt("locationId", locationId);
  return locationsRepo.findById({ locationId: id });
};

exports.getCoordsById = async ({ locationId }) => {
  const id = requirePositiveInt("locationId", locationId);
  return locationsRepo.getCoordsById({ locationId: id });
};

exports.createOrGetLocation = async ({ name, lat, lon }) => {
  const nm = normalizeName(name);
  const v = validateLatLon(lat, lon);

  return locationsRepo.createOrGetLocation({
    name: nm,
    lat: v.lat,
    lon: v.lon,
    latE6: v.latE6,
    lonE6: v.lonE6,
  });
};

exports.findByLatLon = async ({ lat, lon }) => {
  const v = validateLatLon(lat, lon);
  return locationsRepo.findByLatLonE6({ latE6: v.latE6, lonE6: v.lonE6 });
};

exports.listLocations = async ({ limit, order }) => {
  const lim = normalizeLimit(limit, LIST_LIMIT);
  const ord = normalizeOrder(order);
  return locationsRepo.listLocations({ limit: lim, order: ord });
};

exports.update = async ({ locationId, name, lat, lon }) => {
  const id = requirePositiveInt("locationId", locationId);
  const nm = normalizeName(name);

  const latProvided = lat !== undefined;
  const lonProvided = lon !== undefined;

  if (latProvided !== lonProvided) {
    throw badRequest("lat and lon must be provided together");
  }

  let latNum;
  let lonNum;

  if (latProvided) {
    const v = validateLatLon(lat, lon);
    latNum = v.lat;
    lonNum = v.lon;
  }

  return locationsRepo.update({
    locationId: id,
    name: nm,
    lat: latProvided ? latNum : undefined,
    lon: lonProvided ? lonNum : undefined,
  });
};

exports.remove = async ({ locationId }) => {
  const id = requirePositiveInt("locationId", locationId);
  return locationsRepo.remove({ locationId: id });
};

/* ========================================================================== */
/* Validation                                                                  */
/* ========================================================================== */

function requirePositiveInt(name, value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${name}`);
  return n;
}

function requireFiniteNumber(name, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest(`Invalid ${name}`);
  return n;
}

function normalizeLimit(limit, { defaultValue, max }) {
  if (limit === undefined || limit === null || limit === "")
    return defaultValue;
  const n = Number(limit);
  if (!Number.isInteger(n) || n <= 0) throw badRequest("Invalid limit");
  return Math.min(n, max);
}

function normalizeOrder(order) {
  if (order === undefined || order === null || order === "") return "desc";
  const o = String(order).toLowerCase().trim();
  if (o !== "asc" && o !== "desc") throw badRequest("Invalid order");
  return o;
}

function normalizeName(name) {
  if (name === undefined) return undefined;
  if (name === null) return null;

  const s = String(name).trim();
  if (s === "") return null;
  if (s.length > NAME_MAX) throw badRequest("Invalid name");

  return s;
}

function validateLatLon(lat, lon) {
  const latNum = requireFiniteNumber("lat", lat);
  const lonNum = requireFiniteNumber("lon", lon);

  if (latNum < -90 || latNum > 90) throw badRequest("Invalid lat");
  if (lonNum < -180 || lonNum > 180) throw badRequest("Invalid lon");

  return {
    lat: latNum,
    lon: lonNum,
    latE6: toE6(latNum),
    lonE6: toE6(lonNum),
  };
}

/* ========================================================================== */
/* Uniqueness helper                                                           */
/* ========================================================================== */

function toE6(n) {
  return Math.round(n * 1_000_000);
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
