"use strict";

/**
 * External Conditions Service
 *
 * Responsibilities
 * - Resolve a hive or device to a location
 * - Fetch current conditions from OpenWeather One Call 3.0
 * - Map provider payload into external_condition columns
 * - Upsert one row per location per 10-minute bucket
 * - Provide read helpers for latest and since
 *
 * Notes
 * - Temperature is stored as `temperature`
 * - We do not convert temperature to Celsius anywhere
 * - Wind is normalized to m/s for DB consistency
 */

const hivesRepo = require("../db/hives.db.js");
const devicesRepo = require("../db/devices.db.js");
const locationsRepo = require("../db/locations.db.js");
const externalConditionsRepo = require("../db/externalConditions.db.js");

/* ========================================================================== */
/* Config                                                                      */
/* ========================================================================== */

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || null;
const OPENWEATHER_BASE_URL =
  process.env.OPENWEATHER_BASE_URL || "https://api.openweathermap.org";

/*
 * We intentionally default to imperial so OpenWeather returns Fahrenheit temp.
 * The DB column is just `temperature`, and this project treats it as Fahrenheit.
 */
const OPENWEATHER_UNITS = process.env.OPENWEATHER_UNITS || "imperial";

const DEFAULT_LIMIT = 5000;
const MAX_LIMIT = 20000;
const TEN_MIN_MS = 10 * 60 * 1000;

/* ========================================================================== */
/* Public API                                                                  */
/* ========================================================================== */

/**
 * Fetches current external conditions for a hive's location and upserts the
 * current 10-minute bucket.
 */
exports.fetchCurrentForHive = async ({ beekeeperId, hiveId }) => {
  const bId = toPositiveInt(beekeeperId, "beekeeperId");
  const hId = toPositiveInt(hiveId, "hiveId");

  const row = await hivesRepo.getLocationIdForHive({
    beekeeperId: bId,
    hiveId: hId,
  });

  if (!row) throw notFound("Hive not found");
  if (!row.location_id) throw notFound("Hive has no location");

  return fetchCurrentForLocation({ locationId: row.location_id });
};

/**
 * Same core fetch flow, but resolved from device -> hive -> location.
 */
exports.fetchCurrentForDevice = async ({ deviceId }) => {
  const dId = toPositiveInt(deviceId, "deviceId");

  const row = await devicesRepo.getLocationIdForDevice({ deviceId: dId });

  if (!row) throw notFound("Device not found");
  if (!row.location_id) throw notFound("Device has no hive or location");

  return fetchCurrentForLocation({ locationId: row.location_id });
};

exports.getLatestForHive = async ({ beekeeperId, hiveId }) => {
  const bId = toPositiveInt(beekeeperId, "beekeeperId");
  const hId = toPositiveInt(hiveId, "hiveId");

  const row = await hivesRepo.getLocationIdForHive({
    beekeeperId: bId,
    hiveId: hId,
  });

  if (!row) throw notFound("Hive not found");
  if (!row.location_id) throw notFound("Hive has no location");

  return externalConditionsRepo.getLatestByLocationId({
    locationId: row.location_id,
  });
};

exports.getForHiveSince = async ({ beekeeperId, hiveId, since, until, limit, order }) => {
  const bId = toPositiveInt(beekeeperId, "beekeeperId");
  const hId = toPositiveInt(hiveId, "hiveId");

  const row = await hivesRepo.getLocationIdForHive({
    beekeeperId: bId,
    hiveId: hId,
  });

  if (!row) throw notFound("Hive not found");
  if (!row.location_id) throw notFound("Hive has no location");

  const sinceDate = parseDateLike("since", since);
  const untilDate = until ? parseDateLike("until", until) : null;

  if (untilDate && untilDate.getTime() < sinceDate.getTime()) {
    throw badRequest("until must be >= since");
  }

  return externalConditionsRepo.listByLocationSince({
    locationId: row.location_id,
    since: sinceDate,
    until: untilDate,
    limit: clampLimit(limit),
    order: normalizeOrder(order),
  });
};

/* ========================================================================== */
/* Core fetch + upsert                                                         */
/* ========================================================================== */

async function fetchCurrentForLocation({ locationId }) {
  const locId = toPositiveInt(locationId, "locationId");

  const coords = await locationsRepo.getCoordsById({ locationId: locId });
  if (!coords) throw notFound("Location not found");

  const nowBucket = floorToTenMinutesUtc(new Date());

  /*
   * Guard against repeated upstream calls within the same 10-minute bucket.
   * If we already have a row for this location/bucket, return it as-is.
   */
  const existing = await externalConditionsRepo.getByLocationAndBucket({
    locationId: locId,
    bucketAt: nowBucket,
  });

  if (existing) {
    return existing;
  }

  try {
    const payload = await fetchOpenWeatherOneCall({
      lat: coords.lat,
      lon: coords.lon,
    });

    const args = mapOpenWeatherToUpsertArgs({
      locationId: locId,
      payload,
    });

    return await externalConditionsRepo.upsert(args);
  } catch (e) {
    return await externalConditionsRepo.upsert({
      locationId: locId,
      bucketAt: nowBucket,
      provider: "openweather",
      status: "failed",
      errorMessage: e?.message || "OpenWeather fetch failed",
      temperature: null,
      humidityPct: null,
      precipMm: null,
      windMps: null,
      windGustMps: null,
      pressureHpa: null,
      cloudPct: null,
      rawJson: null,
    });
  }
}

/* ========================================================================== */
/* OpenWeather fetch                                                           */
/* ========================================================================== */

async function fetchOpenWeatherOneCall({ lat, lon }) {
  if (!OPENWEATHER_API_KEY) {
    throw upstream("OPENWEATHER_API_KEY is not set");
  }

  const u = new URL("/data/3.0/onecall", OPENWEATHER_BASE_URL);
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lon", String(lon));
  u.searchParams.set("exclude", "minutely,hourly,daily,alerts");
  u.searchParams.set("units", OPENWEATHER_UNITS);
  u.searchParams.set("appid", OPENWEATHER_API_KEY);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const resp = await fetch(u.toString(), { signal: controller.signal });
    const text = await resp.text();

    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!resp.ok) {
      const msg = json?.message || text || `HTTP ${resp.status}`;
      throw upstream(`OpenWeather error: ${msg}`);
    }

    return json;
  } catch (e) {
    if (e?.name === "AbortError") {
      throw upstream("OpenWeather request timed out");
    }
    if (e?.status) {
      throw e;
    }
    throw upstream(e?.message || "OpenWeather request failed");
  } finally {
    clearTimeout(timeout);
  }
}

/* ========================================================================== */
/* Mapping                                                                     */
/* ========================================================================== */

function mapOpenWeatherToUpsertArgs({ locationId, payload }) {
  const cur = payload?.current || {};

  const dt = normalizeNumber(cur.dt);
  const bucketAt = dt
    ? floorToTenMinutesUtc(new Date(dt * 1000))
    : floorToTenMinutesUtc(new Date());

  /*
   * Temperature is stored exactly as returned by OpenWeather for the selected
   * units mode. We do not convert to Celsius.
   */
  const temperature = normalizeNumber(cur.temp);

  /*
   * OpenWeather returns wind in:
   * - meter/sec for metric
   * - miles/hour for imperial
   *
   * DB stores m/s, so imperial wind values are converted to m/s here.
   */
  let windMps = normalizeNumber(cur.wind_speed);
  let windGustMps = normalizeNumber(cur.wind_gust);

  if (OPENWEATHER_UNITS === "imperial") {
    if (windMps !== null) windMps = mphToMps(windMps);
    if (windGustMps !== null) windGustMps = mphToMps(windGustMps);
  }

  const rain1h = normalizeNumber(cur?.rain?.["1h"]);
  const snow1h = normalizeNumber(cur?.snow?.["1h"]);
  const precipTotal = (rain1h ?? 0) + (snow1h ?? 0);
  const precipMm = precipTotal > 0 ? precipTotal : null;

  return {
    locationId,
    bucketAt,
    provider: "openweather",
    status: "success",
    errorMessage: null,
    temperature,
    humidityPct: normalizeNumber(cur.humidity),
    precipMm,
    windMps,
    windGustMps,
    pressureHpa: normalizeNumber(cur.pressure),
    cloudPct: normalizeNumber(cur.clouds),
    rawJson: payload,
  };
}

/* ========================================================================== */
/* Utilities                                                                   */
/* ========================================================================== */

function toPositiveInt(value, field) {
  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest(`${field} must be a positive integer`);
  }

  return n;
}

function parseDateLike(field, value) {
  if (value === undefined || value === null || value === "") {
    throw badRequest(`${field} is required`);
  }

  const d = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(d.getTime())) {
    throw badRequest(`${field} must be a valid ISO timestamp`);
  }

  return d;
}

function clampLimit(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_LIMIT;
  }

  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest("limit must be a positive integer");
  }

  return Math.min(n, MAX_LIMIT);
}

function normalizeOrder(value) {
  const v = String(value ?? "asc").toLowerCase().trim();

  if (v !== "asc" && v !== "desc") {
    throw badRequest("order must be 'asc' or 'desc'");
  }

  return v;
}

function floorToTenMinutesUtc(date) {
  const ms = date.getTime();
  return new Date(Math.floor(ms / TEN_MIN_MS) * TEN_MIN_MS);
}

function normalizeNumber(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mphToMps(mph) {
  return mph * 0.44704;
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

function notFound(message) {
  return httpError(404, "NOT_FOUND", message);
}

function upstream(message) {
  return httpError(502, "UPSTREAM_ERROR", message);
}