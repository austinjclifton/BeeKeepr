"use strict";

require("dotenv").config();

const { pool } = require("../db/pool.js");
const demoDataService = require("../services/demoData.service.js");

async function main() {
  try {
    const result = await demoDataService.resetDemoRuntimeData();
    console.log(JSON.stringify({ status: "ok", ...result }, null, 2));
  } finally {
    await pool.end();
  }
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