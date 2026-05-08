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
