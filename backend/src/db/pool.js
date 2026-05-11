"use strict";
const { Pool } = require("pg");

/* ========================================================================== */
/* Config                                                                      */
/* ========================================================================== */

function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function parsePort(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0 || i > 65535) return fallback;
  return i;
}

function buildPoolConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (typeof databaseUrl === "string" && databaseUrl.trim()) {
    return {
      connectionString: databaseUrl,
      ...poolDefaults(),
    };
  }

  return {
    host: requireEnv("DB_HOST"),
    port: parsePort(process.env.DB_PORT, 5432),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    ...poolDefaults(),
  };
}

function poolDefaults() {
  return {
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };
}

const pool = new Pool(buildPoolConfig());

/* ========================================================================== */
/* Public API                                                                  */
/* ========================================================================== */

/**
 * Run a query and return rows (repositories should use this).
 */
async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

/**
 * Acquire a dedicated client for explicit transactions.
 */
async function getClient() {
  return pool.connect();
}

/**
 * Run a unit of work inside a transaction.
 * The callback receives a pg client with `query`.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // ignore rollback failures; original error is more important
    }
    throw err;
  } finally {
    client.release();
  }
}

/* ========================================================================== */
/* Shutdown hygiene                                                            */
/* ========================================================================== */

let poolEnded = false;

async function safeEndPool() {
  if (poolEnded) return;
  poolEnded = true;
  await pool.end();
}

function onSignal(signal) {
  return () => {
    safeEndPool()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };
}

process.on("SIGTERM", onSignal("SIGTERM"));
process.on("SIGINT", onSignal("SIGINT"));

module.exports = { pool, query, getClient, withTransaction };
