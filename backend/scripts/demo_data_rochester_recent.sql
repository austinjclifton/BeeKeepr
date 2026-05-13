BEGIN;

-- ============================================================
-- EDITABLE SEED SETTINGS
-- ============================================================

CREATE TEMP TABLE demo_seed_config ON COMMIT DROP AS
SELECT
  'demo'::varchar(50) AS username,
  'demo@beekeepr.example'::varchar(254) AS email,
  '$2b$12$a7HAquewV.MToLZFbym3uebWDyY3Tcxx9cvheL6f4it7Z7d.YNTVK'::varchar(255) AS placeholder_password_hash,

  TIMESTAMP '2026-01-01 00:00:00' AS start_local_at,
  TIMESTAMP '2026-12-31 23:00:00' AS end_local_at,
  interval '10 minutes' AS bucket_interval,

  TRUE AS alerts_enabled,
  92::double precision AS warning_low_threshold,
  98::double precision AS warning_high_threshold,
  89::double precision AS critical_low_threshold,
  101::double precision AS critical_high_threshold;

CREATE TEMP TABLE demo_location_config (
  location_code text PRIMARY KEY,
  name varchar(120) NOT NULL,
  city_name text NOT NULL,
  timezone_name text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,

  external_base_temp double precision NOT NULL,
  external_daily_amp double precision NOT NULL,
  external_long_amp double precision NOT NULL,
  external_phase_shift double precision NOT NULL,
  external_warming_trend double precision NOT NULL,

  humidity_base double precision NOT NULL,
  humidity_daily_amp double precision NOT NULL,
  wind_base_mps double precision NOT NULL,
  wind_amp_mps double precision NOT NULL,

  weather_event_start_local timestamp,
  weather_event_end_local timestamp,
  weather_event_delta double precision NOT NULL DEFAULT 0
) ON COMMIT DROP;

INSERT INTO demo_location_config (
  location_code,
  name,
  city_name,
  timezone_name,
  lat,
  lon,
  external_base_temp,
  external_daily_amp,
  external_long_amp,
  external_phase_shift,
  external_warming_trend,
  humidity_base,
  humidity_daily_amp,
  wind_base_mps,
  wind_amp_mps,
  weather_event_start_local,
  weather_event_end_local,
  weather_event_delta
)
VALUES
  (
    'app',
    'Blue Ridge Appalachia Demo Yard',
    'Asheville, NC',
    'America/New_York',
    35.5951,
    -82.5515,
    58.0,
    10.0,
    6.2,
    0.4,
    0.14,
    72.0,
    16.0,
    2.4,
    1.1,
    TIMESTAMP '2026-04-12 05:00:00',
    TIMESTAMP '2026-04-13 18:00:00',
    -5.0
  ),
  (
    'wny',
    'Western New York Demo Yard',
    'Buffalo, NY',
    'America/New_York',
    42.8864,
    -78.8784,
    52.0,
    10.5,
    7.0,
    0.7,
    0.11,
    70.0,
    17.0,
    3.5,
    1.8,
    TIMESTAMP '2026-02-04 03:00:00',
    TIMESTAMP '2026-02-05 15:00:00',
    -6.3
  ),
  (
    'ca',
    'California Central Valley Demo Yard',
    'Davis, CA',
    'America/Los_Angeles',
    38.5449,
    -121.7405,
    64.0,
    14.0,
    5.6,
    1.3,
    0.09,
    58.0,
    12.0,
    2.2,
    1.0,
    TIMESTAMP '2026-09-03 13:00:00',
    TIMESTAMP '2026-09-05 20:00:00',
    6.1
  );

CREATE TEMP TABLE demo_hive_config (
  hive_code text PRIMARY KEY,
  location_code text NOT NULL REFERENCES demo_location_config(location_code),
  name varchar(100) NOT NULL,
  notes text,

  internal_baseline double precision NOT NULL,
  internal_daily_amp double precision NOT NULL,
  internal_long_amp double precision NOT NULL,
  external_sensitivity double precision NOT NULL,
  internal_phase_shift double precision NOT NULL,

  anomaly_start_local timestamp,
  anomaly_end_local timestamp,
  anomaly_delta double precision NOT NULL DEFAULT 0
) ON COMMIT DROP;

INSERT INTO demo_hive_config (
  hive_code,
  location_code,
  name,
  notes,
  internal_baseline,
  internal_daily_amp,
  internal_long_amp,
  external_sensitivity,
  internal_phase_shift,
  anomaly_start_local,
  anomaly_end_local,
  anomaly_delta
)
VALUES
  (
    'app-01',
    'app',
    'Blue Ridge Stable Hive',
    'Appalachia demo hive with a stable brood temperature profile',
    95.2,
    0.35,
    0.28,
    0.024,
    0.2,
    NULL,
    NULL,
    0
  ),
  (
    'app-02',
    'app',
    'Pisgah Orchard Hive',
    'Appalachia orchard hive with a short cold ridge-line disturbance',
    95.0,
    0.52,
    0.40,
    0.030,
    1.0,
    TIMESTAMP '2026-01-22 03:30:00',
    TIMESTAMP '2026-01-22 08:30:00',
    -3.1
  ),
  (
    'wny-01',
    'wny',
    'Lake Erie Stable Hive',
    'Western New York demo hive with steady brood temperatures near the lakeshore',
    95.1,
    0.38,
    0.30,
    0.026,
    0.5,
    TIMESTAMP '2026-05-09 13:00:00',
    TIMESTAMP '2026-05-09 14:00:00',
    2.6
  ),
  (
    'wny-02',
    'wny',
    'Niagara Snowbelt Hive',
    'Western New York demo hive with a brief cold-weather probe disturbance',
    94.6,
    0.60,
    0.45,
    0.034,
    2.2,
    TIMESTAMP '2026-03-06 09:20:00',
    TIMESTAMP '2026-03-06 09:50:00',
    -4.4
  ),
  (
    'ca-01',
    'ca',
    'Yolo Stable Hive',
    'California Central Valley hive with strong brood regulation and dry summer heat',
    95.8,
    0.48,
    0.34,
    0.032,
    0.8,
    TIMESTAMP '2026-07-27 15:30:00',
    TIMESTAMP '2026-07-27 22:30:00',
    3.9
  ),
  (
    'ca-02',
    'ca',
    'Delta Orchard Hive',
    'California orchard hive with a mild midsummer brood regulation dip',
    95.3,
    0.56,
    0.42,
    0.031,
    1.6,
    TIMESTAMP '2026-06-21 15:00:00',
    TIMESTAMP '2026-06-21 23:00:00',
    3.2
  ),
  (
    'ca-03',
    'ca',
    'Solano Variable Hive',
    'California demo hive with wider swings and a short warm probe spike',
    94.8,
    0.72,
    0.50,
    0.036,
    2.4,
    TIMESTAMP '2026-10-09 20:40:00',
    TIMESTAMP '2026-10-09 21:00:00',
    4.1
  );

CREATE TEMP TABLE demo_device_config (
  device_code text PRIMARY KEY,
  hive_code text NOT NULL REFERENCES demo_hive_config(hive_code),
  installed_local_at timestamp NOT NULL,
  rssi_base integer NOT NULL,
  rssi_variability integer NOT NULL,
  received_delay_seconds integer NOT NULL
) ON COMMIT DROP;

INSERT INTO demo_device_config (
  device_code,
  hive_code,
  installed_local_at,
  rssi_base,
  rssi_variability,
  received_delay_seconds
)
VALUES
  ('dev-app-01', 'app-01', TIMESTAMP '2026-04-01 09:00:00', -60, 16, 3),
  ('dev-app-02', 'app-02', TIMESTAMP '2026-04-01 09:15:00', -65, 18, 4),
  ('dev-wny-01', 'wny-01', TIMESTAMP '2026-04-01 09:00:00', -62, 17, 3),
  ('dev-wny-02', 'wny-02', TIMESTAMP '2026-04-01 09:15:00', -70, 20, 5),
  ('dev-ca-01', 'ca-01', TIMESTAMP '2026-04-01 09:00:00', -59, 15, 3),
  ('dev-ca-02', 'ca-02', TIMESTAMP '2026-04-01 09:15:00', -65, 17, 4),
  ('dev-ca-03', 'ca-03', TIMESTAMP '2026-04-01 09:30:00', -69, 19, 4);

-- ============================================================
-- BEEKEEPER
-- ============================================================

CREATE TEMP TABLE demo_beekeeper ON COMMIT DROP AS
WITH upsert AS (
  INSERT INTO beekeeper (
    username,
    email,
    password_hash,
    alerts_enabled,
    warning_low_threshold,
    warning_high_threshold,
    critical_low_threshold,
    critical_high_threshold
  )
  SELECT
    username,
    email,
    placeholder_password_hash,
    alerts_enabled,
    warning_low_threshold,
    warning_high_threshold,
    critical_low_threshold,
    critical_high_threshold
  FROM demo_seed_config
  ON CONFLICT (username)
  DO UPDATE SET
    email = EXCLUDED.email,
    alerts_enabled = EXCLUDED.alerts_enabled,
    warning_low_threshold = EXCLUDED.warning_low_threshold,
    warning_high_threshold = EXCLUDED.warning_high_threshold,
    critical_low_threshold = EXCLUDED.critical_low_threshold,
    critical_high_threshold = EXCLUDED.critical_high_threshold
  RETURNING id
)
SELECT id FROM upsert;

-- ============================================================
-- LOCATIONS
-- ============================================================

CREATE TEMP TABLE demo_locations ON COMMIT DROP AS
WITH upsert AS (
  INSERT INTO location (name, lat, lon)
  SELECT
    name,
    lat,
    lon
  FROM demo_location_config
  ON CONFLICT (lat_e6, lon_e6)
  DO UPDATE SET
    name = EXCLUDED.name
  RETURNING id, name, lat, lon
)
SELECT
  c.*,
  u.id AS location_id
FROM demo_location_config c
JOIN upsert u
  ON u.lat = c.lat
 AND u.lon = c.lon;

CREATE TEMP TABLE demo_location_windows ON COMMIT DROP AS
SELECT
  l.*,
  s.start_local_at,
  s.end_local_at,
  s.bucket_interval,
  s.start_local_at AT TIME ZONE l.timezone_name AS start_at,
  s.end_local_at AT TIME ZONE l.timezone_name AS end_at
FROM demo_locations l
CROSS JOIN demo_seed_config s;

-- ============================================================
-- HIVES
-- ============================================================

INSERT INTO hive (
  beekeeper_id,
  location_id,
  name,
  notes,
  status,
  installed_at,
  warning_low_threshold,
  warning_high_threshold,
  critical_low_threshold,
  critical_high_threshold
)
SELECT
  b.id,
  lw.location_id,
  h.name,
  h.notes,
  'active',
  dc.installed_local_at AT TIME ZONE lw.timezone_name,
  s.warning_low_threshold,
  s.warning_high_threshold,
  s.critical_low_threshold,
  s.critical_high_threshold
FROM demo_hive_config h
JOIN demo_location_windows lw
  ON lw.location_code = h.location_code
JOIN demo_device_config dc
  ON dc.hive_code = h.hive_code
CROSS JOIN demo_beekeeper b
CROSS JOIN demo_seed_config s
WHERE NOT EXISTS (
  SELECT 1
  FROM hive existing
  WHERE existing.beekeeper_id = b.id
    AND existing.name = h.name
);

UPDATE hive existing
SET
  location_id = lw.location_id,
  notes = h.notes,
  status = 'active',
  archived_at = NULL,
  warning_low_threshold = s.warning_low_threshold,
  warning_high_threshold = s.warning_high_threshold,
  critical_low_threshold = s.critical_low_threshold,
  critical_high_threshold = s.critical_high_threshold
FROM demo_hive_config h
JOIN demo_location_windows lw
  ON lw.location_code = h.location_code
CROSS JOIN demo_beekeeper b
CROSS JOIN demo_seed_config s
WHERE existing.beekeeper_id = b.id
  AND existing.name = h.name;

CREATE TEMP TABLE demo_hives ON COMMIT DROP AS
SELECT
  h.id AS hive_id,
  h.beekeeper_id,
  hc.hive_code,
  hc.location_code,
  hc.name,
  hc.internal_baseline,
  hc.internal_daily_amp,
  hc.internal_long_amp,
  hc.external_sensitivity,
  hc.internal_phase_shift,
  hc.anomaly_start_local,
  hc.anomaly_end_local,
  hc.anomaly_delta,
  h.warning_low_threshold,
  h.warning_high_threshold,
  h.critical_low_threshold,
  h.critical_high_threshold
FROM hive h
JOIN demo_beekeeper b
  ON b.id = h.beekeeper_id
JOIN demo_hive_config hc
  ON hc.name = h.name;

-- ============================================================
-- DEVICES
-- ============================================================

INSERT INTO device (
  hive_id,
  installed_at,
  last_seen_at
)
SELECT
  h.hive_id,
  dc.installed_local_at AT TIME ZONE lw.timezone_name,
  lw.end_at
FROM demo_hives h
JOIN demo_device_config dc
  ON dc.hive_code = h.hive_code
JOIN demo_location_windows lw
  ON lw.location_code = h.location_code
WHERE NOT EXISTS (
  SELECT 1
  FROM device existing
  WHERE existing.hive_id = h.hive_id
);

UPDATE device existing
SET
  last_seen_at = lw.end_at
FROM demo_hives h
JOIN demo_location_windows lw
  ON lw.location_code = h.location_code
WHERE existing.hive_id = h.hive_id;

CREATE TEMP TABLE demo_devices ON COMMIT DROP AS
SELECT
  d.id AS device_id,
  h.*,
  dc.device_code,
  dc.rssi_base,
  dc.rssi_variability,
  dc.received_delay_seconds
FROM device d
JOIN demo_hives h
  ON h.hive_id = d.hive_id
JOIN demo_device_config dc
  ON dc.hive_code = h.hive_code;

-- ============================================================
-- EXTERNAL WEATHER BUCKETS
-- ============================================================

CREATE TEMP TABLE demo_weather_buckets ON COMMIT DROP AS
WITH buckets AS (
  SELECT
    lw.location_code,
    lw.location_id,
    lw.name AS location_name,
    lw.city_name,
    lw.timezone_name,
    gs.bucket_at,
    EXTRACT(EPOCH FROM (gs.bucket_at - lw.start_at)) / 3600.0 AS hours_since_start,
    EXTRACT(EPOCH FROM (gs.bucket_at - lw.start_at)) / 86400.0 AS days_since_start
  FROM demo_location_windows lw
  CROSS JOIN LATERAL generate_series(
    lw.start_at,
    lw.end_at,
    lw.bucket_interval
  ) AS gs(bucket_at)
),
prepared AS (
  SELECT
    b.bucket_at,
    b.location_code,
    b.location_id,
    b.location_name,
    b.city_name,
    b.timezone_name,
    b.hours_since_start,
    b.days_since_start,
    EXTRACT(HOUR FROM b.bucket_at AT TIME ZONE b.timezone_name)
      + EXTRACT(MINUTE FROM b.bucket_at AT TIME ZONE b.timezone_name) / 60.0 AS local_hour,

    (
      lw.external_base_temp
      + lw.external_daily_amp
        * sin(2 * pi() * (
            (
              EXTRACT(HOUR FROM b.bucket_at AT TIME ZONE b.timezone_name)
              + EXTRACT(MINUTE FROM b.bucket_at AT TIME ZONE b.timezone_name) / 60.0
            ) - 15
          ) / 24)
      + lw.external_long_amp
        * sin(2 * pi() * b.days_since_start / 7 + lw.external_phase_shift)
      + lw.external_warming_trend * b.days_since_start
      + CASE
          WHEN lw.weather_event_start_local IS NOT NULL
           AND lw.weather_event_end_local IS NOT NULL
           AND b.bucket_at >= lw.weather_event_start_local AT TIME ZONE b.timezone_name
           AND b.bucket_at <= lw.weather_event_end_local AT TIME ZONE b.timezone_name
            THEN lw.weather_event_delta
          ELSE 0
        END
    ) AS temperature,

    GREATEST(
      30,
      LEAST(
        96,
        lw.humidity_base
        + lw.humidity_daily_amp
          * sin(2 * pi() * (
              (
                EXTRACT(HOUR FROM b.bucket_at AT TIME ZONE b.timezone_name)
                + EXTRACT(MINUTE FROM b.bucket_at AT TIME ZONE b.timezone_name) / 60.0
              ) + 5
            ) / 24)
        + 8 * sin(2 * pi() * b.days_since_start / 5 + lw.external_phase_shift)
      )
    ) AS humidity_pct,

    GREATEST(
      0.5,
      lw.wind_base_mps
      + lw.wind_amp_mps * sin(2 * pi() * b.days_since_start / 3 + lw.external_phase_shift)
      + 0.8 * abs(sin(2 * pi() * b.hours_since_start / 18))
    ) AS wind_mps,

    GREATEST(
      8,
      LEAST(
        98,
        52
        + 28 * sin(2 * pi() * b.days_since_start / 6 + lw.external_phase_shift)
        + 14 * abs(sin(2 * pi() * b.hours_since_start / 12))
      )
    ) AS cloud_pct,

    1013
      + 7 * sin(2 * pi() * b.days_since_start / 9 + lw.external_phase_shift) AS pressure_hpa
  FROM buckets b
  JOIN demo_location_windows lw
    ON lw.location_code = b.location_code
)
SELECT
  location_code,
  location_id,
  location_name,
  city_name,
  timezone_name,
  bucket_at,
  hours_since_start,
  days_since_start,
  local_hour,
  ROUND(temperature::numeric, 2)::double precision AS temperature,
  ROUND(humidity_pct::numeric, 1)::double precision AS humidity_pct,
  CASE
    WHEN location_code = 'app'
     AND MOD(FLOOR(days_since_start)::int, 9) IN (2, 3, 4)
      THEN ROUND((0.10 + 0.18 * abs(sin(2 * pi() * local_hour / 24)))::numeric, 2)::double precision
    WHEN location_code = 'wny'
     AND MOD(FLOOR(days_since_start)::int, 7) IN (4, 5)
      THEN ROUND((0.09 + 0.14 * abs(sin(2 * pi() * local_hour / 24)))::numeric, 2)::double precision
    WHEN location_code = 'ca'
     AND EXTRACT(MONTH FROM bucket_at AT TIME ZONE timezone_name) IN (1, 2, 3, 11, 12)
     AND MOD(FLOOR(days_since_start)::int, 11) IN (5, 6)
      THEN ROUND((0.04 + 0.09 * abs(sin(2 * pi() * local_hour / 24)))::numeric, 2)::double precision
    ELSE NULL
  END AS precip_mm,
  ROUND(wind_mps::numeric, 2)::double precision AS wind_mps,
  ROUND((wind_mps + 1.4 + 1.1 * abs(sin(2 * pi() * hours_since_start / 6)))::numeric, 2)::double precision AS wind_gust_mps,
  ROUND(pressure_hpa::numeric, 1)::double precision AS pressure_hpa,
  ROUND(cloud_pct::numeric, 1)::double precision AS cloud_pct
FROM prepared;

-- ============================================================
-- EXTERNAL CONDITIONS
-- ============================================================

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
  bucket_at + interval '2 seconds',
  'demo',
  'success',
  NULL,
  temperature,
  humidity_pct,
  precip_mm,
  wind_mps,
  wind_gust_mps,
  pressure_hpa,
  cloud_pct,
  jsonb_build_object(
    'source', 'beekeepr-demo',
    'city', city_name,
    'locationCode', location_code
  )
FROM demo_weather_buckets
ON CONFLICT (location_id, bucket_at)
DO UPDATE SET
  fetched_at = EXCLUDED.fetched_at,
  provider = EXCLUDED.provider,
  status = EXCLUDED.status,
  error_message = EXCLUDED.error_message,
  temperature = EXCLUDED.temperature,
  humidity_pct = EXCLUDED.humidity_pct,
  precip_mm = EXCLUDED.precip_mm,
  wind_mps = EXCLUDED.wind_mps,
  wind_gust_mps = EXCLUDED.wind_gust_mps,
  pressure_hpa = EXCLUDED.pressure_hpa,
  cloud_pct = EXCLUDED.cloud_pct,
  raw_json = EXCLUDED.raw_json;

-- ============================================================
-- INTERNAL HIVE READINGS
-- ============================================================

WITH prepared AS (
  SELECT
    d.device_id,
    d.hive_id,
    d.hive_code,
    d.location_code,
    w.bucket_at,

    (
      d.internal_baseline
      + d.internal_daily_amp
        * sin(2 * pi() * (w.local_hour - 14) / 24)
      + d.internal_long_amp
        * sin(2 * pi() * w.days_since_start / 8 + d.internal_phase_shift)
      + d.external_sensitivity
        * (
            w.temperature
            - CASE
                WHEN d.location_code = 'ca' THEN 68
                WHEN d.location_code = 'app' THEN 60
                ELSE 57
              END
          )
      + CASE
          WHEN d.anomaly_start_local IS NOT NULL
           AND d.anomaly_end_local IS NOT NULL
           AND w.bucket_at >= d.anomaly_start_local AT TIME ZONE w.timezone_name
           AND w.bucket_at <= d.anomaly_end_local AT TIME ZONE w.timezone_name
            THEN d.anomaly_delta
          ELSE 0
        END
    ) AS internal_temperature,

    GREATEST(
      -110,
      LEAST(
        -45,
        ROUND(
          d.rssi_base
          - ABS(d.rssi_variability * sin(2 * pi() * w.hours_since_start / 18 + d.internal_phase_shift))
          - MOD(FLOOR(w.days_since_start)::int, 5)
        )::int
      )
    )::smallint AS rssi,

    d.received_delay_seconds
  FROM demo_devices d
  JOIN demo_weather_buckets w
    ON w.location_code = d.location_code
)
INSERT INTO reading (
  device_id,
  bucket_at,
  received_at,
  temperature,
  rssi
)
SELECT
  device_id,
  bucket_at,
  bucket_at + make_interval(secs => received_delay_seconds),
  ROUND(internal_temperature::numeric, 2)::double precision,
  rssi
FROM prepared
ON CONFLICT (device_id, bucket_at)
DO UPDATE SET
  received_at = EXCLUDED.received_at,
  temperature = EXCLUDED.temperature,
  rssi = EXCLUDED.rssi;

-- ============================================================
-- ALERTS
-- ============================================================

WITH candidates AS (
  SELECT
    r.id AS reading_id,
    h.beekeeper_id,
    h.hive_id,
    d.device_id,
    r.temperature,
    h.warning_low_threshold,
    h.warning_high_threshold,
    h.critical_low_threshold,
    h.critical_high_threshold,
    r.bucket_at,
    lw.end_at,

    CASE
      WHEN r.temperature < h.critical_low_threshold
        OR r.temperature > h.critical_high_threshold
        THEN 'critical'
      WHEN r.temperature < h.warning_low_threshold
        OR r.temperature > h.warning_high_threshold
        THEN 'warning'
      ELSE NULL
    END AS severity,

    CASE
      WHEN r.temperature < h.warning_low_threshold
        THEN 'low'
      WHEN r.temperature > h.warning_high_threshold
        THEN 'high'
      ELSE NULL
    END AS direction,

    CASE
      WHEN r.temperature < h.critical_low_threshold
        THEN h.critical_low_threshold
      WHEN r.temperature > h.critical_high_threshold
        THEN h.critical_high_threshold
      WHEN r.temperature < h.warning_low_threshold
        THEN h.warning_low_threshold
      WHEN r.temperature > h.warning_high_threshold
        THEN h.warning_high_threshold
      ELSE NULL
    END AS threshold_value
  FROM demo_hives h
  JOIN demo_devices d
    ON d.hive_id = h.hive_id
  JOIN demo_location_windows lw
    ON lw.location_code = h.location_code
  JOIN reading r
    ON r.device_id = d.device_id
  WHERE r.bucket_at >= lw.start_at
    AND r.bucket_at <= lw.end_at
)
INSERT INTO alert (
  reading_id,
  beekeeper_id,
  hive_id,
  device_id,
  severity,
  direction,
  threshold_value,
  temperature,
  email_sent,
  email_sent_at,
  email_error_message,
  resolved,
  resolved_at,
  created_at
)
SELECT
  reading_id,
  beekeeper_id,
  hive_id,
  device_id,
  severity,
  direction,
  threshold_value,
  temperature,
  FALSE,
  NULL,
  NULL,
  bucket_at < end_at - interval '24 hours',
  CASE
    WHEN bucket_at < end_at - interval '24 hours'
      THEN bucket_at + interval '90 minutes'
    ELSE NULL
  END,
  bucket_at + interval '4 seconds'
FROM candidates
WHERE severity IS NOT NULL
ON CONFLICT (reading_id)
DO UPDATE SET
  severity = EXCLUDED.severity,
  direction = EXCLUDED.direction,
  threshold_value = EXCLUDED.threshold_value,
  temperature = EXCLUDED.temperature,
  email_sent = FALSE,
  email_sent_at = NULL,
  email_error_message = NULL,
  resolved = EXCLUDED.resolved,
  resolved_at = EXCLUDED.resolved_at,
  created_at = EXCLUDED.created_at;

-- ============================================================
-- SEED SUMMARY
-- ============================================================

SELECT
  'seed complete' AS status,
  (SELECT COUNT(*) FROM demo_locations) AS locations_seeded,
  (SELECT COUNT(*) FROM demo_hives) AS hives_seeded,
  (SELECT COUNT(*) FROM demo_devices) AS devices_seeded,
  (
    SELECT COUNT(*)
    FROM reading r
    JOIN demo_devices d
      ON d.device_id = r.device_id
    JOIN demo_location_windows lw
      ON lw.location_code = d.location_code
    WHERE r.bucket_at >= lw.start_at
      AND r.bucket_at <= lw.end_at
  ) AS readings_seeded,
  (
    SELECT COUNT(*)
    FROM external_condition ec
    JOIN demo_location_windows lw
      ON lw.location_id = ec.location_id
    WHERE ec.bucket_at >= lw.start_at
      AND ec.bucket_at <= lw.end_at
  ) AS external_conditions_seeded,
  (
    SELECT COUNT(*)
    FROM alert a
    JOIN demo_hives h
      ON h.hive_id = a.hive_id
    JOIN demo_location_windows lw
      ON lw.location_code = h.location_code
    WHERE a.created_at >= lw.start_at
      AND a.created_at <= lw.end_at + interval '1 hour'
  ) AS alerts_seeded;

COMMIT;