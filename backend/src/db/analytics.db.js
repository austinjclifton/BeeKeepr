"use strict";
const { query } = require("./pool");

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

exports.getLatestReadingForHive = async ({ beekeeperId, hiveId }) => {
  const rows = await query(
    `
    SELECT
      h.id AS hive_id,
      r.id,
      r.device_id,
      r.temperature,
      r.rssi,
      r.bucket_at,
      r.received_at,
      r.created_at
    FROM hive h
    LEFT JOIN device d
      ON d.hive_id = h.id
    LEFT JOIN LATERAL (
      SELECT id, device_id, temperature, rssi, bucket_at, received_at, created_at
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

exports.getHiveStatusRows = async ({ beekeeperId, startAt, endAt, locationId = null }) => {
  return query(
    `
    WITH owned_hives AS (
      SELECT
        h.id,
        h.name,
        h.status,
        h.location_id,
        l.name AS location_name,
        COALESCE(h.warning_low_threshold, b.warning_low_threshold) AS warning_low_threshold,
        COALESCE(h.warning_high_threshold, b.warning_high_threshold) AS warning_high_threshold,
        COALESCE(h.critical_low_threshold, b.critical_low_threshold) AS critical_low_threshold,
        COALESCE(h.critical_high_threshold, b.critical_high_threshold) AS critical_high_threshold
      FROM hive h
      JOIN beekeeper b
        ON b.id = h.beekeeper_id
      LEFT JOIN location l
        ON l.id = h.location_id
      WHERE h.beekeeper_id = $1
        AND ($4::bigint IS NULL OR h.location_id = $4)
    ),
    latest_reading AS (
      SELECT
        oh.id AS hive_id,
        r.id AS latest_reading_id,
        r.temperature AS latest_temperature,
        r.rssi AS latest_rssi,
        r.bucket_at AS latest_bucket_at,
        r.received_at AS latest_received_at
      FROM owned_hives oh
      LEFT JOIN device d
        ON d.hive_id = oh.id
      LEFT JOIN LATERAL (
        SELECT id, temperature, rssi, bucket_at, received_at
        FROM reading
        WHERE device_id = d.id
        ORDER BY bucket_at DESC
        LIMIT 1
      ) r ON d.id IS NOT NULL
    ),
    reading_stats AS (
      SELECT
        oh.id AS hive_id,
        COUNT(r.id)::int AS reading_count,
        AVG(r.temperature)::double precision AS average_temperature,
        MIN(r.temperature)::double precision AS min_temperature,
        MAX(r.temperature)::double precision AS max_temperature,
        (MAX(r.temperature) - MIN(r.temperature))::double precision AS temperature_swing
      FROM owned_hives oh
      LEFT JOIN device d
        ON d.hive_id = oh.id
      LEFT JOIN reading r
        ON r.device_id = d.id
       AND r.bucket_at >= $2::timestamptz
       AND r.bucket_at < $3::timestamptz
      GROUP BY oh.id
    ),
    alert_counts AS (
      SELECT
        oh.id AS hive_id,
        COUNT(a.id) FILTER (WHERE a.severity = 'warning')::int AS warning_count,
        COUNT(a.id) FILTER (WHERE a.severity = 'critical')::int AS critical_count,
        MAX(a.created_at) FILTER (WHERE a.severity = 'warning') AS latest_warning_at,
        MAX(a.created_at) FILTER (WHERE a.severity = 'critical') AS latest_critical_at
      FROM owned_hives oh
      LEFT JOIN alert a
        ON a.hive_id = oh.id
       AND a.created_at >= $2::timestamptz
       AND a.created_at < $3::timestamptz
      GROUP BY oh.id
    ),
    latest_external AS (
      SELECT
        oh.id AS hive_id,
        ec.temperature AS external_temperature,
        ec.humidity_pct AS external_humidity_pct,
        ec.wind_mps AS external_wind_mps,
        ec.wind_gust_mps AS external_wind_gust_mps,
        ec.pressure_hpa AS external_pressure_hpa,
        ec.precip_mm AS external_precip_mm,
        ec.cloud_pct AS external_cloud_pct,
        ec.bucket_at AS external_bucket_at
      FROM owned_hives oh
      LEFT JOIN LATERAL (
        SELECT
          temperature,
          humidity_pct,
          wind_mps,
          wind_gust_mps,
          pressure_hpa,
          precip_mm,
          cloud_pct,
          bucket_at
        FROM external_condition
        WHERE location_id = oh.location_id
          AND status = 'success'
        ORDER BY bucket_at DESC
        LIMIT 1
      ) ec ON oh.location_id IS NOT NULL
    )
    SELECT
      oh.*,
      lr.latest_reading_id,
      lr.latest_temperature,
      lr.latest_rssi,
      lr.latest_bucket_at,
      lr.latest_received_at,
      rs.reading_count,
      rs.average_temperature,
      rs.min_temperature,
      rs.max_temperature,
      rs.temperature_swing,
      ac.warning_count,
      ac.critical_count,
      ac.latest_warning_at,
      ac.latest_critical_at,
      le.external_temperature,
      le.external_humidity_pct,
      le.external_wind_mps,
      le.external_wind_gust_mps,
      le.external_pressure_hpa,
      le.external_precip_mm,
      le.external_cloud_pct,
      le.external_bucket_at
    FROM owned_hives oh
    JOIN latest_reading lr
      ON lr.hive_id = oh.id
    JOIN reading_stats rs
      ON rs.hive_id = oh.id
    JOIN alert_counts ac
      ON ac.hive_id = oh.id
    JOIN latest_external le
      ON le.hive_id = oh.id
    ORDER BY oh.name ASC, oh.id ASC
    `,
    [beekeeperId, startAt, endAt, locationId],
  );
};

exports.getHiveSummaryRow = async ({ beekeeperId, hiveId, startAt, endAt }) => {
  const rows = await query(
    `
    WITH owned_hive AS (
      SELECT h.id
      FROM hive h
      WHERE h.beekeeper_id = $1
        AND h.id = $2
    ),
    reading_stats AS (
      SELECT
        oh.id AS hive_id,
        COUNT(r.id)::int AS reading_count,
        AVG(r.temperature)::double precision AS average_temperature,
        MIN(r.temperature)::double precision AS min_temperature,
        MAX(r.temperature)::double precision AS max_temperature,
        (MAX(r.temperature) - MIN(r.temperature))::double precision AS temperature_swing
      FROM owned_hive oh
      LEFT JOIN device d
        ON d.hive_id = oh.id
      LEFT JOIN reading r
        ON r.device_id = d.id
       AND r.bucket_at >= $3::timestamptz
       AND r.bucket_at < $4::timestamptz
      GROUP BY oh.id
    ),
    latest_reading AS (
      SELECT
        oh.id AS hive_id,
        r.temperature AS latest_temperature,
        r.bucket_at AS latest_reading_at
      FROM owned_hive oh
      LEFT JOIN device d
        ON d.hive_id = oh.id
      LEFT JOIN LATERAL (
        SELECT temperature, bucket_at
        FROM reading
        WHERE device_id = d.id
          AND bucket_at >= $3::timestamptz
          AND bucket_at < $4::timestamptz
        ORDER BY bucket_at DESC
        LIMIT 1
      ) r ON d.id IS NOT NULL
    ),
    alert_counts AS (
      SELECT
        oh.id AS hive_id,
        COUNT(a.id) FILTER (WHERE a.severity = 'warning')::int AS warning_count,
        COUNT(a.id) FILTER (WHERE a.severity = 'critical')::int AS critical_count,
        MAX(a.created_at) FILTER (WHERE a.severity = 'warning') AS latest_warning_at,
        MAX(a.created_at) FILTER (WHERE a.severity = 'critical') AS latest_critical_at
      FROM owned_hive oh
      LEFT JOIN alert a
        ON a.hive_id = oh.id
       AND a.created_at >= $3::timestamptz
       AND a.created_at < $4::timestamptz
      GROUP BY oh.id
    )
    SELECT
      oh.id AS hive_id,
      rs.reading_count,
      rs.average_temperature,
      rs.min_temperature,
      rs.max_temperature,
      rs.temperature_swing,
      ac.warning_count,
      ac.critical_count,
      ac.latest_warning_at,
      ac.latest_critical_at,
      lr.latest_temperature,
      lr.latest_reading_at
    FROM owned_hive oh
    JOIN reading_stats rs
      ON rs.hive_id = oh.id
    JOIN alert_counts ac
      ON ac.hive_id = oh.id
    JOIN latest_reading lr
      ON lr.hive_id = oh.id
    LIMIT 1
    `,
    [beekeeperId, hiveId, startAt, endAt],
  );

  return rows[0] ?? null;
};

exports.getHiveTemperatureSeries = async ({
  beekeeperId,
  hiveId,
  startAt,
  endAt,
  bucketSize,
}) => {
  const rows = await query(
    `
    WITH owned_hive AS (
      SELECT
        h.id,
        h.location_id
      FROM hive h
      WHERE h.beekeeper_id = $1
        AND h.id = $2
      LIMIT 1
    ),
    internal_points AS (
      SELECT
        ${bucketExpression("r.bucket_at", bucketSize)} AS bucket_at,
        AVG(r.temperature)::double precision AS average_temperature,
        MIN(r.temperature)::double precision AS min_temperature,
        MAX(r.temperature)::double precision AS max_temperature,
        COUNT(r.id)::int AS reading_count
      FROM owned_hive oh
      JOIN device d
        ON d.hive_id = oh.id
      JOIN reading r
        ON r.device_id = d.id
       AND r.bucket_at >= $3::timestamptz
       AND r.bucket_at < $4::timestamptz
      GROUP BY 1
    ),
    external_points AS (
      SELECT
        ${bucketExpression("ec.bucket_at", bucketSize)} AS bucket_at,
        AVG(ec.temperature)::double precision AS external_temperature
      FROM owned_hive oh
      JOIN external_condition ec
        ON ec.location_id = oh.location_id
       AND ec.status = 'success'
       AND ec.temperature IS NOT NULL
       AND ec.bucket_at >= $3::timestamptz
       AND ec.bucket_at < $4::timestamptz
      GROUP BY 1
    ),
    buckets AS (
      SELECT bucket_at FROM internal_points
      UNION
      SELECT bucket_at FROM external_points
    )
    SELECT
      b.bucket_at,
      ip.average_temperature,
      ip.min_temperature,
      ip.max_temperature,
      ip.reading_count,
      ep.external_temperature
    FROM buckets b
    LEFT JOIN internal_points ip
      ON ip.bucket_at = b.bucket_at
    LEFT JOIN external_points ep
      ON ep.bucket_at = b.bucket_at
    ORDER BY b.bucket_at ASC
    `,
    [beekeeperId, hiveId, startAt, endAt],
  );

  return rows;
};

exports.getCompareTemperatureSeries = async ({
  beekeeperId,
  hiveIds,
  startAt,
  endAt,
  bucketSize,
  locationId = null,
}) => {
  return query(
    `
    SELECT
      h.id AS hive_id,
      ${bucketExpression("r.bucket_at", bucketSize)} AS bucket_at,
      AVG(r.temperature)::double precision AS average_temperature,
      MIN(r.temperature)::double precision AS min_temperature,
      MAX(r.temperature)::double precision AS max_temperature,
      COUNT(r.id)::int AS reading_count
    FROM hive h
    JOIN device d
      ON d.hive_id = h.id
    JOIN reading r
      ON r.device_id = d.id
    WHERE h.beekeeper_id = $1
      AND h.id = ANY($2::bigint[])
      AND r.bucket_at >= $3::timestamptz
      AND r.bucket_at < $4::timestamptz
      AND ($5::bigint IS NULL OR h.location_id = $5)
    GROUP BY h.id, 2
    ORDER BY h.id ASC, 2 ASC
    `,
    [beekeeperId, hiveIds, startAt, endAt, locationId],
  );
};

exports.getLocationExternalTemperatureSeries = async ({
  locationId,
  startAt,
  endAt,
  bucketSize,
}) => {
  return query(
    `
    SELECT
      ${bucketExpression("ec.bucket_at", bucketSize)} AS bucket_at,
      AVG(ec.temperature)::double precision AS external_temperature
    FROM external_condition ec
    WHERE ec.location_id = $1
      AND ec.status = 'success'
      AND ec.temperature IS NOT NULL
      AND ec.bucket_at >= $2::timestamptz
      AND ec.bucket_at < $3::timestamptz
    GROUP BY 1
    ORDER BY 1 ASC
    `,
    [locationId, startAt, endAt],
  );
};

exports.getDashboardHiveTemperature24h = async ({
  beekeeperId,
  hiveId,
  startAt,
  endAt,
}) => {
  return query(
    `
    WITH owned_hive AS (
      SELECT
        h.id,
        h.name,
        h.location_id,
        l.name AS location_name,
        l.lat AS location_lat,
        l.lon AS location_lon
      FROM hive h
      LEFT JOIN location l
        ON l.id = h.location_id
      WHERE h.beekeeper_id = $1
        AND h.id = $2
      LIMIT 1
    ),
    internal_points AS (
      SELECT
        r.bucket_at,
        r.id AS reading_id,
        r.temperature AS internal_temperature,
        r.rssi,
        r.received_at
      FROM owned_hive oh
      JOIN device d
        ON d.hive_id = oh.id
      JOIN reading r
        ON r.device_id = d.id
       AND r.bucket_at >= $3::timestamptz
       AND r.bucket_at < $4::timestamptz
    ),
    external_points AS (
      SELECT
        ec.bucket_at,
        ec.id AS external_condition_id,
        ec.temperature AS outside_temperature,
        ec.humidity_pct,
        ec.precip_mm,
        ec.wind_mps,
        ec.wind_gust_mps,
        ec.pressure_hpa,
        ec.cloud_pct,
        ec.status AS external_status
      FROM owned_hive oh
      JOIN external_condition ec
        ON ec.location_id = oh.location_id
       AND ec.status = 'success'
       AND ec.bucket_at >= $3::timestamptz
       AND ec.bucket_at < $4::timestamptz
    ),
    buckets AS (
      SELECT bucket_at FROM internal_points
      UNION
      SELECT bucket_at FROM external_points
    )
    SELECT
      oh.id AS hive_id,
      oh.name,
      oh.location_id,
      oh.location_name,
      oh.location_lat,
      oh.location_lon,
      b.bucket_at,
      ip.reading_id,
      ip.internal_temperature,
      ip.rssi,
      ip.received_at,
      ep.external_condition_id,
      ep.outside_temperature,
      ep.humidity_pct,
      ep.precip_mm,
      ep.wind_mps,
      ep.wind_gust_mps,
      ep.pressure_hpa,
      ep.cloud_pct,
      ep.external_status
    FROM owned_hive oh
    LEFT JOIN buckets b
      ON TRUE
    LEFT JOIN internal_points ip
      ON ip.bucket_at = b.bucket_at
    LEFT JOIN external_points ep
      ON ep.bucket_at = b.bucket_at
    ORDER BY b.bucket_at ASC
    `,
    [beekeeperId, hiveId, startAt, endAt],
  );
};

exports.getDashboardFleetTemperature24h = async ({
  beekeeperId,
  hiveIds,
  startAt,
  endAt,
}) => {
  return query(
    `
    SELECT
      h.id AS hive_id,
      h.name,
      r.bucket_at,
      r.temperature
    FROM hive h
    JOIN device d
      ON d.hive_id = h.id
    JOIN reading r
      ON r.device_id = d.id
    WHERE h.beekeeper_id = $1
      AND h.id = ANY($2::bigint[])
      AND r.bucket_at >= $3::timestamptz
      AND r.bucket_at < $4::timestamptz
    ORDER BY h.name ASC, h.id ASC, r.bucket_at ASC
    `,
    [beekeeperId, hiveIds, startAt, endAt],
  );
};

function bucketExpression(column, bucketSize) {
  if (bucketSize === "10m") {
    return `
      date_trunc('hour', ${column})
      + floor(extract(minute from ${column}) / 10)::int * interval '10 minutes'
    `;
  }

  if (bucketSize === "30m") {
    return `
      date_trunc('hour', ${column})
      + floor(extract(minute from ${column}) / 30)::int * interval '30 minutes'
    `;
  }

  if (bucketSize === "hour") {
    return `date_trunc('hour', ${column})`;
  }

  if (bucketSize === "6h") {
    return `
      date_trunc('day', ${column})
      + floor(extract(hour from ${column}) / 6)::int * interval '6 hours'
    `;
  }

  if (bucketSize === "day") {
    return `date_trunc('day', ${column})`;
  }

  throw new Error("Unsupported analytics bucket size");
}

function toOrderSql(order) {
  const normalizedOrder = String(order ?? "asc")
    .toLowerCase()
    .trim();

  if (normalizedOrder === "asc") return "ASC";
  if (normalizedOrder === "desc") return "DESC";
  return "ASC";
}

function toLimitValue(limit, fallback = 5000) {
  const numberLimit = Number(limit);
  if (!Number.isFinite(numberLimit)) return fallback;

  const integerLimit = Math.floor(numberLimit);
  if (integerLimit <= 0) return fallback;

  return Math.min(integerLimit, 100000);
}
