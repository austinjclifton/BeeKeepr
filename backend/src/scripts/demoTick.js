"use strict";

/**
 * Demo tick (`npm run demo:tick`).
 *
 * Generates the latest single 10-minute bucket for the configured
 * demo world: one external condition per location and one reading
 * per hive/device, floored to the configured interval. Critical
 * alerts created during a tick send email (this is the only demo
 * path that does).
 *
 * This is the script the on-host cron should call (e.g. every 5
 * minutes) to keep the demo looking like a live deployment between
 * manual backfills. Idempotent: existing buckets are skipped.
 *
 * `db:seed:demo` is called internally, so the demo topology is
 * guaranteed to exist before the bucket is generated.
 */

require("dotenv").config();

const { pool } = require("../db/pool.js");
const demoDataService = require("../services/demoData.service.js");

async function main() {
    try {
        const result = await demoDataService.runDemoTick();
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