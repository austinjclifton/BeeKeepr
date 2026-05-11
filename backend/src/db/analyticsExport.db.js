"use strict";

const { query } = require("./pool");

exports.listHiveScope = async ({ beekeeperId, scope, hiveId = null, locationId = null }) => {
  const rows = await query(
    `
    SELECT
      h.id AS hive_id,
      h.name AS hive_name,
      h.status AS hive_status,
      h.installed_at AS hive_installed_at,
      h.archived_at AS hive_archived_at,
      h.warning_low_threshold,
      h.warning_high_threshold,
      h.critical_low_threshold,
      h.critical_high_threshold,
      d.id AS device_id,
      d.installed_at AS device_installed_at,
      d.last_seen_at AS device_last_seen_at,
      l.id AS location_id,
      l.name AS location_name,
      l.lat AS location_lat,
      l.lon AS location_lon
    FROM hive h
    LEFT JOIN device d
      ON d.hive_id = h.id
    LEFT JOIN location l
      ON l.id = h.location_id
    WHERE h.beekeeper_id = $1
      AND (
        $2 = 'user'
        OR ($2 = 'hive' AND h.id = $3::bigint)
        OR ($2 = 'location' AND h.location_id = $4::bigint)
      )
    ORDER BY h.name ASC, h.id ASC
    `,
    [beekeeperId, scope, hiveId, locationId],
  );

  return rows;
};

exports.listReadingsBatch = async ({
  beekeeperId,
  hiveIds,
  startAt = null,
  endAt = null,
  afterBucketAt = null,
  afterReadingId = 0,
  limit,
}) => {
  return query(
    `
    SELECT
      r.id AS reading_id,
      r.bucket_at,
      r.received_at,
      r.temperature AS internal_temperature,
      r.rssi,
      h.id AS hive_id,
      h.name AS hive_name,
      d.id AS device_id,
      l.id AS location_id,
      l.name AS location_name
    FROM hive h
    JOIN device d
      ON d.hive_id = h.id
    JOIN reading r
      ON r.device_id = d.id
    LEFT JOIN location l
      ON l.id = h.location_id
    WHERE h.beekeeper_id = $1
      AND h.id = ANY($2::bigint[])
      AND ($3::timestamptz IS NULL OR r.bucket_at >= $3)
      AND ($4::timestamptz IS NULL OR r.bucket_at < $4)
      AND (
        $5::timestamptz IS NULL
        OR r.bucket_at > $5
        OR (r.bucket_at = $5 AND r.id > $6::bigint)
      )
    ORDER BY r.bucket_at ASC, r.id ASC
    LIMIT $7
    `,
    [
      beekeeperId,
      hiveIds,
      startAt,
      endAt,
      afterBucketAt,
      afterReadingId,
      limit,
    ],
  );
};

exports.listExternalBatch = async ({
  locationIds,
  startAt = null,
  endAt = null,
  afterBucketAt = null,
  afterExternalId = 0,
  limit,
}) => {
  return query(
    `
    SELECT
      ec.id AS external_condition_id,
      ec.location_id,
      l.name AS location_name,
      ec.bucket_at,
      ec.fetched_at,
      ec.provider,
      ec.status,
      ec.error_message,
      ec.temperature AS outside_temperature,
      ec.humidity_pct,
      ec.precip_mm,
      ec.wind_mps,
      ec.wind_gust_mps,
      ec.pressure_hpa,
      ec.cloud_pct
    FROM external_condition ec
    JOIN location l
      ON l.id = ec.location_id
    WHERE ec.location_id = ANY($1::bigint[])
      AND ($2::timestamptz IS NULL OR ec.bucket_at >= $2)
      AND ($3::timestamptz IS NULL OR ec.bucket_at < $3)
      AND (
        $4::timestamptz IS NULL
        OR ec.bucket_at > $4
        OR (ec.bucket_at = $4 AND ec.id > $5::bigint)
      )
    ORDER BY ec.bucket_at ASC, ec.id ASC
    LIMIT $6
    `,
    [locationIds, startAt, endAt, afterBucketAt, afterExternalId, limit],
  );
};

exports.listAlertsBatch = async ({
  beekeeperId,
  hiveIds,
  startAt = null,
  endAt = null,
  afterCreatedAt = null,
  afterAlertId = 0,
  limit,
}) => {
  return query(
    `
    SELECT
      a.id AS alert_id,
      a.reading_id,
      a.beekeeper_id,
      a.hive_id,
      h.name AS hive_name,
      a.device_id,
      a.severity,
      a.direction,
      a.threshold_value,
      a.temperature AS alert_temperature,
      a.resolved,
      a.resolved_at,
      a.created_at,
      a.updated_at
    FROM alert a
    JOIN hive h
      ON h.id = a.hive_id
     AND h.beekeeper_id = $1
    WHERE a.beekeeper_id = $1
      AND a.hive_id = ANY($2::bigint[])
      AND ($3::timestamptz IS NULL OR a.created_at >= $3)
      AND ($4::timestamptz IS NULL OR a.created_at < $4)
      AND (
        $5::timestamptz IS NULL
        OR a.created_at > $5
        OR (a.created_at = $5 AND a.id > $6::bigint)
      )
    ORDER BY a.created_at ASC, a.id ASC
    LIMIT $7
    `,
    [
      beekeeperId,
      hiveIds,
      startAt,
      endAt,
      afterCreatedAt,
      afterAlertId,
      limit,
    ],
  );
};
