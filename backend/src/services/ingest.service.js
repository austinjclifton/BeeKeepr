"use strict";

const ingestRepo = require("../db/ingest.db.js");
const externalConditionsService = require("./externalConditions.service.js");
const alertsService = require("./alerts.service.js");

const TEN_MIN_MS = 10 * 60 * 1000;
const TEMP_MIN = -100;
const TEMP_MAX = 999;
const RSSI_MIN = -200;
const RSSI_MAX = 0;

const TRIGGER_EXTERNAL_ON_INGEST =
  String(process.env.TRIGGER_EXTERNAL_ON_INGEST ?? "true")
    .toLowerCase()
    .trim() === "true";

exports.createReading = async ({ deviceId, temperature, rssi }) => {
  if (temperature <= TEMP_MIN || temperature >= TEMP_MAX) {
    throw badRequest(`temperature must be between ${TEMP_MIN} and ${TEMP_MAX}`);
  }

  if (rssi < RSSI_MIN || rssi > RSSI_MAX) {
    throw badRequest(`rssi must be between ${RSSI_MIN} and ${RSSI_MAX}`);
  }

  // Keep this nearby for when bucketed ingest dedupe is restored
  //const bucketAt = floorToTenMinutes(new Date()).toISOString();

  // For now each request uses its own timestamp as bucket_at
  const bucketAt = new Date().toISOString();

  const { inserted, reading } = await ingestRepo.createReadingDeduped10m({
    deviceId: deviceId,
    bucketAt,
    temperature: temperature,
    rssiDbm: rssi,
  });

  // check if the inserted reading is alert-worthy
  if (inserted && reading) {
    try {
      await alertsService.processReading(reading);
    } catch (e) {
      console.error("Alert processing failed:", e?.message || e);
    }
  }

  // external conditions (secondary side effect)
  if (inserted && TRIGGER_EXTERNAL_ON_INGEST) {
    try {
      await externalConditionsService.fetchCurrentForDevice({
        deviceId: deviceId,
      });
    } catch (e) {
      console.error("External condition ingest failed:", e?.message || e);
    }
  }

  return { inserted, reading };
};

// Error helpers
function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function badRequest(message) {
  return httpError(400, "VALIDATION_ERROR", message);
}

// Floors a date to the nearest 10-minute mark
function floorToTenMinutes(date) {
  const ms = date.getTime();
  return new Date(Math.floor(ms / TEN_MIN_MS) * TEN_MIN_MS);
}
