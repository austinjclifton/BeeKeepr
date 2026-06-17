"use strict";

/**
 * Schema bootstrap (`npm run db:migrate`).
 *
 * Applies `backend/docs/schema.sql` to an empty BeeKeepr database so
 * the rest of the demo and runtime code paths have the tables they
 * expect. This is intentionally NOT a migration tool:
 *
 *   - If NONE of the required tables exist, it applies schema.sql.
 *   - If ALL of the required tables already exist, it exits cleanly.
 *   - If only SOME of the required tables exist (a partial schema),
 *     it refuses to run and asks for a manual migration. Run this
 *     only on a fresh database or one that has been manually
 *     reconciled.
 *
 * Use this once when provisioning a new local or test database. For
 * ongoing schema changes, write an explicit migration in
 * `backend/docs/` and apply it directly.
 */

require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");

const { getClient, pool } = require("../db/pool.js");

const REQUIRED_TABLES = Object.freeze([
    "beekeeper",
    "location",
    "hive",
    "device",
    "reading",
    "alert",
    "external_condition",
    "session",
    "password_reset_token",
]);

async function main() {
    const client = await getClient();

    try {
        const existing = await client.query(
            `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = ANY($1::text[])
      `,
            [REQUIRED_TABLES],
        );

        if (existing.rowCount === REQUIRED_TABLES.length) {
            console.log("BeeKeepr schema already applied");
            return;
        }

        if (existing.rowCount > 0) {
            throw new Error(
                "Detected a partial BeeKeepr schema. Apply a manual migration before rerunning the baseline bootstrap",
            );
        }

        const schemaPath = path.resolve(__dirname, "../../docs/schema.sql");
        const schemaSql = await fs.readFile(schemaPath, "utf8");
        await client.query(schemaSql);
        console.log("BeeKeepr schema applied");
    } finally {
        client.release();
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