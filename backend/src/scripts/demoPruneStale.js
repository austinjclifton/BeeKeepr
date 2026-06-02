"use strict";

require("dotenv").config();

const { pool } = require("../db/pool.js");
const demoDataService = require("../services/demoData.service.js");

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await demoDataService.pruneStaleDemoData(options);
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

    if (name === "removeUnusedLocations") {
      parsed.removeUnusedLocations = parseBoolean(value, name);
    } else {
      throw new Error(`Unsupported argument --${name}`);
    }
  }

  return parsed;
}

function parseBoolean(value, name) {
  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(`--${name} must be true or false`);
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