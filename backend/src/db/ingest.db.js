"use strict";
const { query } = require("./pool");

/**
 * Insert a new internal hive reading (WITH dedupe semantics)
 */
exports.createReadingDeduped10m = async ({
  deviceId,
  bucketAt,
  temperature,
  rssiDbm = null,
}) => {
  try {
    const rows = await query(
      `
      WITH ins AS (
        INSERT INTO reading (device_id, bucket_at, temperature, rssi)
        VALUES ($1, $2::timestamptz, $3, $4)
        ON CONFLICT (device_id, bucket_at) DO NOTHING
        RETURNING
          id,
          device_id,
          bucket_at,
          received_at,
          temperature,
          rssi,
          created_at
      )
      SELECT
        true AS inserted,
        id,
        device_id,
        bucket_at,
        received_at,
        temperature,
        rssi,
        created_at
      FROM ins

      UNION ALL

      SELECT
        false AS inserted,
        r.id,
        r.device_id,
        r.bucket_at,
        r.received_at,
        r.temperature,
        r.rssi,
        r.created_at
      FROM reading r
      WHERE r.device_id = $1
        AND r.bucket_at = $2::timestamptz

      LIMIT 1
      `,
      [deviceId, bucketAt, temperature, rssiDbm],
    );

    const row = rows[0] ?? null;

    return {
      inserted: row?.inserted === true,
      reading: row,
    };
  } catch (err) {
    throw mapPgError(err) ?? err;
  }
};

exports.createReadingsDeduped10mBatch = async ({ readings }) => {
  if (!Array.isArray(readings) || readings.length === 0) return [];

  const payload = readings.map((reading) => ({
    device_id: reading.deviceId,
    bucket_at: reading.bucketAt,
    temperature: reading.temperature,
    rssi_dbm: reading.rssiDbm ?? null,
  }));

  try {
    const rows = await query(
      `
      WITH input AS (
        SELECT DISTINCT ON (device_id, bucket_at)
          device_id,
          bucket_at,
          temperature,
          rssi_dbm
        FROM jsonb_to_recordset($1::jsonb) AS i(
          device_id bigint,
          bucket_at timestamptz,
          temperature double precision,
          rssi_dbm smallint
        )
        ORDER BY device_id, bucket_at
      ),
      ins AS (
        INSERT INTO reading (device_id, bucket_at, temperature, rssi)
        SELECT device_id, bucket_at, temperature, rssi_dbm
        FROM input
        ON CONFLICT (device_id, bucket_at) DO NOTHING
        RETURNING
          id,
          device_id,
          bucket_at,
          received_at,
          temperature,
          rssi,
          created_at
      )
      SELECT
        true AS inserted,
        id,
        device_id,
        bucket_at,
        received_at,
        temperature,
        rssi,
        created_at
      FROM ins

      UNION ALL

      SELECT
        false AS inserted,
        r.id,
        r.device_id,
        r.bucket_at,
        r.received_at,
        r.temperature,
        r.rssi,
        r.created_at
      FROM input i
      JOIN reading r
        ON r.device_id = i.device_id
       AND r.bucket_at = i.bucket_at
      WHERE NOT EXISTS (
        SELECT 1
        FROM ins
        WHERE ins.device_id = i.device_id
          AND ins.bucket_at = i.bucket_at
      )
      `,
      [JSON.stringify(payload)],
    );

    return rows.map((row) => ({
      inserted: row?.inserted === true,
      reading: row,
    }));
  } catch (err) {
    throw mapPgError(err) ?? err;
  }
};

/* ========================================================================== */
/* Helpers                                                                     */
/* ========================================================================== */

function mapPgError(err) {
  if (!err?.code) return null;

  if (err.code === "23505") {
    const e = new Error("Duplicate reading");
    e.status = 409;
    e.code = "DUPLICATE_READING";
    return e;
  }

  if (err.code === "23503") {
    const e = new Error("Device does not exist");
    e.status = 400;
    e.code = "DEVICE_NOT_FOUND";
    return e;
  }

  if (err.code === "23514" || err.code === "22003" || err.code === "22P02") {
    const e = new Error("Invalid reading values");
    e.status = 400;
    e.code = "INVALID_READING";
    return e;
  }

  return null;
}
