"use strict";

/**
 * Prune stale demo data (`npm run demo:prune-stale`).
 *
 * Removes demo records that are no longer represented in
 * `backend/src/scripts/demoData.config.js`:
 *
 *   - Hives whose name is not in the configured hive list (and any
 *     dependent devices, readings, alerts) are deleted.
 *   - Locations that are no longer used by any configured hive AND
 *     that are either "Demo Yard"-named or have demo-simulator
 *     external conditions are removed.
 *
 * Pass `--removeUnusedLocations=true` (the default) to actually
 * delete the orphaned locations. Use `--removeUnusedLocations=false`
 * to dry-run / inspect what would be removed.
 *
 * This is the right script to run after renaming or removing demo
 * locations/hives in the config (for example, after dropping
 * California for Appalachia).
 *
 * `db:seed:demo` already calls this internally, so a routine
 * `db:seed:demo` run will also clean up stale demo topology. Run
 * this script directly when you want a prune pass without re-seeding.
 */

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