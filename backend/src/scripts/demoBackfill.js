"use strict";

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
