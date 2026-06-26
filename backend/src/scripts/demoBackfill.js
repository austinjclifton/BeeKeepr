"use strict";

/**
 * Demo backfill (`npm run demo:backfill`).
 *
 * Generates historical external conditions, internal hive readings,
 * RSSI values, and (optionally) alerts for the configured demo world
 * in `backend/src/scripts/demoData.config.js`. The history window,
 * bucket interval, and per-bucket dedupe behavior are all driven by
 * that config.
 *
 * Useful flags (passed through to demoData.service.runDemoBackfill):
 *   --days=30                  Backfill window length in days. Takes
 *                              precedence over --months if both are set.
 *   --months=18                Backfill window length in months. Used
 *                              only when --days is not provided.
 *   --intervalMinutes=10       Bucket size in minutes.
 *   --withAlerts               Also create alert rows from readings
 *                              that cross the configured thresholds.
 *   --start=ISO --end=ISO      Explicit window; clamped to "now".
 *
 * Idempotent: existing buckets are skipped (uniqueness-aware), so
 * re-running is safe. To regenerate values after a config change,
 * run `npm run demo:reset-readings` first.
 */

require("dotenv").config();

const { pool } = require("../db/pool.js");
const demoDataService = require("../services/demoData.service.js");

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await demoDataService.runDemoBackfill(options);
    console.log(JSON.stringify({ status: "ok", ...result }, null, 2));
  } finally {
    await pool.end();
  }
}

function parseArgs(args) {
  const parsed = {};

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      throw new Error(`Unsupported argument ${arg}`);
    }

    const [name, rawValue] = arg.slice(2).split("=", 2);
    const value = rawValue ?? "true";

    if (name === "start") {
      parsed.start = value;
    } else if (name === "end") {
      parsed.end = value;
    } else if (name === "days") {
      parsed.days = toNumber(value, name);
    } else if (name === "months") {
      parsed.months = toNumber(value, name);
    } else if (name === "intervalMinutes") {
      parsed.intervalMinutes = toNumber(value, name);
    } else if (name === "withAlerts") {
      parsed.withAlerts = value === "true";
    } else {
      throw new Error(`Unsupported argument --${name}`);
    }
  }

  return parsed;
}

function toNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`--${name} must be a number`);
  }

  return number;
}

main().catch(async (error) => {
  console.error(error.message || error);

  try {
    await pool.end();
  } catch {
    // ignore shutdown failures
  }

  process.exit(1);
});
