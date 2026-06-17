"use strict";

/**
 * Demo seed (`npm run db:seed:demo`).
 *
 * Creates or updates the demo beekeeper account, the configured demo
 * locations, hives, devices, and per-hive alert thresholds from
 * `backend/src/scripts/demoData.config.js`. Hive names that no longer
 * appear in the config are pruned first, so this script is also the
 * "rename a hive" tool.
 *
 * Important: this script only ensures the topology. It does NOT
 * generate historical readings, external conditions, or alerts by
 * itself. To populate history, run `npm run demo:backfill` afterwards.
 *
 * Idempotent: safe to re-run on an existing demo database.
 */

require("dotenv").config();

const { pool } = require("../db/pool.js");
const demoDataService = require("../services/demoData.service.js");

async function main() {
    try {
        const result = await demoDataService.ensureDemoSeed();

        console.log(
            JSON.stringify(
                {
                    status: "ok",
                    beekeeper: result.beekeeper,
                    locations: result.locations.length,
                    hives: result.hives.length,
                    devices: result.hives.length,
                },
                null,
                2,
            ),
        );
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