"use strict";

/**
 * Reset demo runtime data (`npm run demo:reset-readings`).
 *
 * Clears the generated runtime data for the configured demo world
 * so it can be rebuilt cleanly:
 *
 *   - All alert rows for the demo beekeeper.
 *   - All reading rows for the demo beekeeper's devices.
 *   - All external_condition rows for the configured demo locations
 *     (only if no other beekeeper's hive is using that location).
 *
 * The demo beekeeper, locations, hives, devices, and thresholds are
 * left in place. Use this when you want to re-run
 * `npm run demo:backfill` from scratch (e.g. after changing climate
 * parameters or scenarios in demoData.config.js) without rebuilding
 * the topology.
 *
 * Pair with `npm run demo:prune-stale` to also clean up hives and
 * locations that were removed from the config.
 */

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