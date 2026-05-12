"use strict";
const { query } = require("./pool");

/**
 * Create a new external condition record
 */
exports.upsert = async ({
  locationId,
  bucketAt,
  provider,
  status,
  errorMessage = null,
  temperature = null,
  humidityPct = null,
  precipMm = null,
  windMps = null,
  windGustMps = null,
  pressureHpa = null,
  cloudPct = null,
  rawJson = null,
}) => {
  const fetchedAt = status === "pending" ? null : new Date();

  try {
    const rows = await query(
      `
      INSERT INTO external_condition (
        location_id,
        bucket_at,
        fetched_at,
        provider,
        status,
        error_message,
        temperature,
        humidity_pct,
        precip_mm,
        wind_mps,
        wind_gust_mps,
        pressure_hpa,
        cloud_pct,
        raw_json
      )
      VALUES (
        $1,
        $2::timestamptz,
        $3::timestamptz,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14::jsonb
      )
      ON CONFLICT (location_id, bucket_at)
      DO UPDATE SET
        fetched_at     = EXCLUDED.fetched_at,
        provider       = EXCLUDED.provider,
        status         = EXCLUDED.status,
        error_message  = EXCLUDED.error_message,
        temperature    = EXCLUDED.temperature,
        humidity_pct   = EXCLUDED.humidity_pct,
        precip_mm      = EXCLUDED.precip_mm,
        wind_mps       = EXCLUDED.wind_mps,
        wind_gust_mps  = EXCLUDED.wind_gust_mps,
        pressure_hpa   = EXCLUDED.pressure_hpa,
        cloud_pct      = EXCLUDED.cloud_pct,
        raw_json       = EXCLUDED.raw_json
      RETURNING *
      `,
      [
        locationId,
        bucketAt,
        fetchedAt,
        provider,
        status,
        errorMessage,
        temperature,
        humidityPct,
        precipMm,
        windMps,
        windGustMps,
        pressureHpa,
        cloudPct,
        rawJson ? JSON.stringify(rawJson) : null,
      ],
    );

    return rows[0] ?? null;
  } catch (err) {
    throw mapPgError(err) ?? err;
  }
};

exports.createDeduped = async ({
  locationId,
  bucketAt,
  fetchedAt = null,
  provider,
  status,
  errorMessage = null,
  temperature = null,
  humidityPct = null,
  precipMm = null,
  windMps = null,
  windGustMps = null,
  pressureHpa = null,
  cloudPct = null,
  rawJson = null,
}) => {
  const rows = await exports.createManyDeduped({
    conditions: [
      {
        locationId,
        bucketAt,
        fetchedAt,
        provider,
        status,
        errorMessage,
        temperature,
        humidityPct,
        precipMm,
        windMps,
        windGustMps,
        pressureHpa,
        cloudPct,
        rawJson,
      },
    ],
  });

  return rows[0] ?? { inserted: false, condition: null };
};

exports.createManyDeduped = async ({ conditions }) => {
  if (!Array.isArray(conditions) || conditions.length === 0) return [];

  const payload = conditions.map((condition) => ({
    location_id: condition.locationId,
    bucket_at: condition.bucketAt,
    fetched_at:
      condition.fetchedAt ??
      (condition.status === "pending" ? null : new Date().toISOString()),
    provider: condition.provider,
    status: condition.status,
    error_message: condition.errorMessage ?? null,
    temperature: condition.temperature ?? null,
    humidity_pct: condition.humidityPct ?? null,
    precip_mm: condition.precipMm ?? null,
    wind_mps: condition.windMps ?? null,
    wind_gust_mps: condition.windGustMps ?? null,
    pressure_hpa: condition.pressureHpa ?? null,
    cloud_pct: condition.cloudPct ?? null,
    raw_json: condition.rawJson ?? null,
  }));

  try {
    const rows = await query(
      `
      WITH input AS (
        SELECT DISTINCT ON (location_id, bucket_at)
          location_id,
          bucket_at,
          fetched_at,
          provider,
          status,
          error_message,
          temperature,
          humidity_pct,
          precip_mm,
          wind_mps,
          wind_gust_mps,
          pressure_hpa,
          cloud_pct,
          raw_json
        FROM jsonb_to_recordset($1::jsonb) AS i(
          location_id bigint,
          bucket_at timestamptz,
          fetched_at timestamptz,
          provider varchar(40),
          status varchar(16),
          error_message text,
          temperature double precision,
          humidity_pct double precision,
          precip_mm double precision,
          wind_mps double precision,
          wind_gust_mps double precision,
          pressure_hpa double precision,
          cloud_pct double precision,
          raw_json jsonb
        )
        ORDER BY location_id, bucket_at
      ),
      ins AS (
        INSERT INTO external_condition (
          location_id,
          bucket_at,
          fetched_at,
          provider,
          status,
          error_message,
          temperature,
          humidity_pct,
          precip_mm,
          wind_mps,
          wind_gust_mps,
          pressure_hpa,
          cloud_pct,
          raw_json
        )
        SELECT
          location_id,
          bucket_at,
          fetched_at,
          provider,
          status,
          error_message,
          temperature,
          humidity_pct,
          precip_mm,
          wind_mps,
          wind_gust_mps,
          pressure_hpa,
          cloud_pct,
          raw_json
        FROM input
        ON CONFLICT (location_id, bucket_at) DO NOTHING
        RETURNING *
      )
      SELECT true AS inserted, ins.*
      FROM ins

      UNION ALL

      SELECT false AS inserted, ec.*
      FROM input i
      JOIN external_condition ec
        ON ec.location_id = i.location_id
       AND ec.bucket_at = i.bucket_at
      WHERE NOT EXISTS (
        SELECT 1
        FROM ins
        WHERE ins.location_id = i.location_id
          AND ins.bucket_at = i.bucket_at
      )
      `,
      [JSON.stringify(payload)],
    );

    return rows.map((row) => ({
      inserted: row?.inserted === true,
      condition: row,
    }));
  } catch (err) {
    throw mapPgError(err) ?? err;
  }
};

/**
 * Get an external condition record by locationId and bucketAt
 */
exports.getByLocationAndBucket = async ({ locationId, bucketAt }) => {
  const rows = await query(
    `
    SELECT *
    FROM external_condition
    WHERE location_id = $1
      AND bucket_at = $2::timestamptz
    LIMIT 1
    `,
    [locationId, bucketAt],
  );

  return rows[0] ?? null;
};

/**
 * Get the latest external condition by locationId
 */
exports.getLatestByLocationId = async ({ locationId }) => {
  const rows = await query(
    `
    SELECT *
    FROM external_condition
    WHERE location_id = $1
    ORDER BY bucket_at DESC
    LIMIT 1
    `,
    [locationId],
  );

  return rows[0] ?? null;
};

/**
 * List external condition records by locationId since a given time
 */
exports.listByLocationSince = async ({
  locationId,
  since,
  until = null,
  limit,
  order = "asc",
}) => {
  const orderSql = toOrderSql(order);
  const limitVal = toLimitValue(limit, 5000);

  return query(
    `
    SELECT *
    FROM external_condition
    WHERE location_id = $1
      AND bucket_at >= $2::timestamptz
      AND ($3::timestamptz IS NULL OR bucket_at < $3::timestamptz)
    ORDER BY bucket_at ${orderSql}
    LIMIT $4
    `,
    [locationId, since, until, limitVal],
  );
};



/* ========================================================================== */
/* Helpers                                                                     */
/* ========================================================================== */

function toOrderSql(order) {
  const o = String(order ?? "asc").toLowerCase().trim();
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

function mapPgError(err) {
  if (!err?.code) return null;

  if (err.code === "23503") {
    const e = new Error("Location does not exist");
    e.status = 400;
    e.code = "LOCATION_NOT_FOUND";
    return e;
  }

  if (err.code === "23514" || err.code === "22003" || err.code === "22P02") {
    const e = new Error("Invalid external condition values");
    e.status = 400;
    e.code = "INVALID_EXTERNAL_CONDITION";
    return e;
  }

  return null;
}
