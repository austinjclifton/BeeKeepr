"use strict";
const { query } = require("./pool");

/**
 * Get readings for a hive since a given time, optionally until another time, with limit and order
 */
exports.getHiveReadingsSince = async ({
  beekeeperId,
  hiveId,
  since,
  until = null,
  limit,
  order = "asc",
}) => {
  const orderSql = toOrderSql(order);
  const limitVal = toLimitValue(limit, 5000);

  return query(
    `
    SELECT
      r.id,
      r.device_id,
      r.bucket_at,
      r.received_at,
      r.temperature,
      r.rssi,
      r.created_at
    FROM hive h
    JOIN device d
      ON d.hive_id = h.id
    JOIN reading r
      ON r.device_id = d.id
    WHERE h.beekeeper_id = $1
      AND h.id = $2
      AND r.bucket_at >= $3::timestamptz
      AND ($4::timestamptz IS NULL OR r.bucket_at < $4::timestamptz)
    ORDER BY r.bucket_at ${orderSql}
    LIMIT $5
    `,
    [beekeeperId, hiveId, since, until, limitVal],
  );
};

/**
 * Get the latest reading for a hive
 */
exports.getLatestForHive = async ({ beekeeperId, hiveId }) => {
  const rows = await query(
    `
    SELECT
      h.id AS hive_id,
      r.id,
      r.device_id,
      r.bucket_at,
      r.received_at,
      r.temperature,
      r.rssi,
      r.created_at
    FROM hive h
    LEFT JOIN device d
      ON d.hive_id = h.id
    LEFT JOIN LATERAL (
      SELECT *
      FROM reading
      WHERE device_id = d.id
      ORDER BY bucket_at DESC
      LIMIT 1
    ) r ON d.id IS NOT NULL
    WHERE h.beekeeper_id = $1
      AND h.id = $2
    LIMIT 1
    `,
    [beekeeperId, hiveId],
  );

  return rows[0] ?? null;
};



/* ========================================================================== */
/* Helpers                                                                     */
/* ========================================================================== */

function toOrderSql(order) {
  const o = String(order ?? "asc")
    .toLowerCase()
    .trim();
  if (o === "asc") return "ASC";
  if (o === "desc") return "DESC";
  return "ASC";
}

function toLimitValue(limit, fallback = 5000) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return Math.min(i, 100000);
}
