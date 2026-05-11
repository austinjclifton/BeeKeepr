BEGIN;

-- ============================================================
-- EDITABLE SEED SETTINGS
-- ============================================================

CREATE TEMP TABLE demo_seed_config ON COMMIT DROP AS
SELECT
  'demo'::varchar(50) AS username,
  'demo@beekeepr.example'::varchar(254) AS email,
  '$2b$12$Us5JuS4kq..lLaMCW7SAheF9zIIz1YAXtjEPaUSPIWf7Jg0Dipm3q'::varchar(255) AS placeholder_password_hash,

  'America/New_York'::text AS seed_timezone,

  (TIMESTAMP '2026-04-20 00:00:00' AT TIME ZONE 'America/New_York') AS start_at,
  (TIMESTAMP '2026-05-10 18:00:00' AT TIME ZONE 'America/New_York') AS end_at,
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
    'roc',
    'Rochester, NY Demo Yard',
    'Rochester, NY',
    'America/New_York',
    43.1566,
    -77.6088,
    54.0,
    11.0,
    6.5,
    0.3,
    0.18,
    67.0,
    18.0,
    3.0,
    1.5,
    TIMESTAMP '2026-04-24 06:00:00',
    TIMESTAMP '2026-04-25 18:00:00',
    -5.5
  ),
  (
    'atl',
    'Atlanta, GA Demo Yard',
    'Atlanta, GA',
    'America/New_York',
    33.7490,
    -84.3880,
    66.0,
    12.0,
    5.5,
    1.1,
    0.15,
    64.0,
    16.0,
    2.4,
    1.2,
    TIMESTAMP '2026-05-03 12:00:00',
    TIMESTAMP '2026-05-04 20:00:00',
    -3.0
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
    'roc-01',
    'roc',
    'Highland Stable Hive',
    'Rochester demo hive with a stable brood temperature profile',
    95.0,
    0.35,
    0.30,
    0.025,
    0.0,
    NULL,
    NULL,
    0
  ),
  (
    'roc-02',
    'roc',
    'Genesee Production Hive',
    'Rochester demo hive with a short warm ventilation event',
    95.7,
    0.55,
    0.45,
    0.030,
    1.1,
    TIMESTAMP '2026-05-03 13:00:00',
    TIMESTAMP '2026-05-03 18:30:00',
    3.3
  ),
  (
    'roc-03',
    'roc',
    'Cobbs Hill Cool Hive',
    'Rochester demo hive with a short overnight cooling event',
    94.2,
    0.50,
    0.40,
    0.035,
    2.0,
    TIMESTAMP '2026-04-29 04:00:00',
    TIMESTAMP '2026-04-29 09:00:00',
    -3.4
  ),
  (
    'atl-01',
    'atl',
    'Piedmont Warm Hive',
    'Atlanta demo hive with stronger afternoon heat pressure',
    95.6,
    0.65,
    0.45,
    0.040,
    0.7,
    TIMESTAMP '2026-05-08 12:00:00',
    TIMESTAMP '2026-05-08 17:00:00',
    4.1
  ),
  (
    'atl-02',
    'atl',
    'Grant Park Variable Hive',
    'Atlanta demo hive with a short low-temperature disturbance',
    94.8,
    0.75,
    0.55,
    0.038,
    2.7,
    TIMESTAMP '2026-05-05 02:00:00',
    TIMESTAMP '2026-05-05 07:00:00',
    -4.0
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
  ('dev-roc-01', 'roc-01', TIMESTAMP '2026-04-01 09:00:00', -58, 16, 3),
  ('dev-roc-02', 'roc-02', TIMESTAMP '2026-04-01 09:15:00', -64, 18, 4),
  ('dev-roc-03', 'roc-03', TIMESTAMP '2026-04-01 09:30:00', -72, 20, 5),
  ('dev-atl-01', 'atl-01', TIMESTAMP '2026-04-01 10:00:00', -61, 17, 3),
  ('dev-atl-02', 'atl-02', TIMESTAMP '2026-04-01 10:15:00', -69, 19, 4);

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
  l.location_id,
  h.name,
  h.notes,
  'active',
  dc.installed_local_at AT TIME ZONE s.seed_timezone,
  s.warning_low_threshold,
  s.warning_high_threshold,
  s.critical_low_threshold,
  s.critical_high_threshold
FROM demo_hive_config h
JOIN demo_location_config lc
  ON lc.location_code = h.location_code
JOIN demo_locations l
  ON l.location_code = h.location_code
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
  location_id = l.location_id,
  notes = h.notes,
  status = 'active',
  archived_at = NULL,
  warning_low_threshold = s.warning_low_threshold,
  warning_high_threshold = s.warning_high_threshold,
  critical_low_threshold = s.critical_low_threshold,
  critical_high_threshold = s.critical_high_threshold
FROM demo_hive_config h
JOIN demo_locations l
  ON l.location_code = h.location_code
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
  dc.installed_local_at AT TIME ZONE s.seed_timezone,
  s.end_at
FROM demo_hives h
JOIN demo_device_config dc
  ON dc.hive_code = h.hive_code
CROSS JOIN demo_seed_config s
WHERE NOT EXISTS (
  SELECT 1
  FROM device existing
  WHERE existing.hive_id = h.hive_id
);

UPDATE device existing
SET
  last_seen_at = s.end_at
FROM demo_hives h
CROSS JOIN demo_seed_config s
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
    gs.bucket_at,
    s.start_at,
    s.end_at,
    EXTRACT(EPOCH FROM (gs.bucket_at - s.start_at)) / 3600.0 AS hours_since_start,
    EXTRACT(EPOCH FROM (gs.bucket_at - s.start_at)) / 86400.0 AS days_since_start
  FROM demo_seed_config s
  CROSS JOIN LATERAL generate_series(
    s.start_at,
    s.end_at,
    s.bucket_interval
  ) AS gs(bucket_at)
),
prepared AS (
  SELECT
    l.location_code,
    l.location_id,
    l.name AS location_name,
    l.city_name,
    l.timezone_name,
    b.bucket_at,
    b.hours_since_start,
    b.days_since_start,
    EXTRACT(HOUR FROM b.bucket_at AT TIME ZONE l.timezone_name)
      + EXTRACT(MINUTE FROM b.bucket_at AT TIME ZONE l.timezone_name) / 60.0 AS local_hour,

    (
      l.external_base_temp
      + l.external_daily_amp
        * sin(2 * pi() * (
            (
              EXTRACT(HOUR FROM b.bucket_at AT TIME ZONE l.timezone_name)
              + EXTRACT(MINUTE FROM b.bucket_at AT TIME ZONE l.timezone_name) / 60.0
            ) - 15
          ) / 24)
      + l.external_long_amp
        * sin(2 * pi() * b.days_since_start / 7 + l.external_phase_shift)
      + l.external_warming_trend * b.days_since_start
      + CASE
          WHEN l.weather_event_start_local IS NOT NULL
           AND l.weather_event_end_local IS NOT NULL
           AND b.bucket_at >= l.weather_event_start_local AT TIME ZONE l.timezone_name
           AND b.bucket_at <= l.weather_event_end_local AT TIME ZONE l.timezone_name
            THEN l.weather_event_delta
          ELSE 0
        END
    ) AS temperature,

    GREATEST(
      30,
      LEAST(
        96,
        l.humidity_base
        + l.humidity_daily_amp
          * sin(2 * pi() * (
              (
                EXTRACT(HOUR FROM b.bucket_at AT TIME ZONE l.timezone_name)
                + EXTRACT(MINUTE FROM b.bucket_at AT TIME ZONE l.timezone_name) / 60.0
              ) + 5
            ) / 24)
        + 8 * sin(2 * pi() * b.days_since_start / 5 + l.external_phase_shift)
      )
    ) AS humidity_pct,

    GREATEST(
      0.5,
      l.wind_base_mps
      + l.wind_amp_mps * sin(2 * pi() * b.days_since_start / 3 + l.external_phase_shift)
      + 0.8 * abs(sin(2 * pi() * b.hours_since_start / 18))
    ) AS wind_mps,

    GREATEST(
      8,
      LEAST(
        98,
        52
        + 28 * sin(2 * pi() * b.days_since_start / 6 + l.external_phase_shift)
        + 14 * abs(sin(2 * pi() * b.hours_since_start / 12))
      )
    ) AS cloud_pct,

    1013
      + 7 * sin(2 * pi() * b.days_since_start / 9 + l.external_phase_shift) AS pressure_hpa
  FROM buckets b
  JOIN demo_locations l
    ON TRUE
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
    WHEN location_code = 'roc'
     AND MOD(FLOOR(days_since_start)::int, 8) IN (3, 4)
      THEN ROUND((0.08 + 0.16 * abs(sin(2 * pi() * local_hour / 24)))::numeric, 2)::double precision
    WHEN location_code = 'atl'
     AND MOD(FLOOR(days_since_start)::int, 7) IN (1, 2)
      THEN ROUND((0.12 + 0.22 * abs(sin(2 * pi() * local_hour / 24)))::numeric, 2)::double precision
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
                WHEN d.location_code = 'atl' THEN 68
                ELSE 58
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
    s.end_at,

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
  JOIN reading r
    ON r.device_id = d.device_id
  CROSS JOIN demo_seed_config s
  WHERE r.bucket_at >= s.start_at
    AND r.bucket_at <= s.end_at
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
    CROSS JOIN demo_seed_config s
    WHERE r.bucket_at >= s.start_at
      AND r.bucket_at <= s.end_at
  ) AS readings_seeded,
  (
    SELECT COUNT(*)
    FROM external_condition ec
    JOIN demo_locations l
      ON l.location_id = ec.location_id
    CROSS JOIN demo_seed_config s
    WHERE ec.bucket_at >= s.start_at
      AND ec.bucket_at <= s.end_at
  ) AS external_conditions_seeded,
  (
    SELECT COUNT(*)
    FROM alert a
    JOIN demo_hives h
      ON h.hive_id = a.hive_id
    CROSS JOIN demo_seed_config s
    WHERE a.created_at >= s.start_at
      AND a.created_at <= s.end_at + interval '1 hour'
  ) AS alerts_seeded;

COMMIT;