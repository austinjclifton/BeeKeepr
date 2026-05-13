"use strict";

const analyticsRepo = require("../db/analytics.db.js");
const analyticsExportRepo = require("../db/analyticsExport.db.js");
const hivesRepo = require("../db/hives.db.js");
const locationsRepo = require("../db/locations.db.js");
const { resolveAnalyticsWindow } = require("../utils/analyticsRange.js");
const { classifyTemperature } = require("../utils/alertClassification.js");
const { csvRow } = require("../utils/csv.js");

const MAX_COMPARE_HIVES = 10;
const STALE_READING_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXPORT_BATCH_SIZE = 1000;
const HIVE_READ_LIMIT = Object.freeze({
  defaultValue: 500,
  max: 10000,
});

const CSV_HEADERS = [
  "record_type",
  "hive_id",
  "hive_name",
  "hive_status",
  "device_id",
  "location_id",
  "location_name",
  "bucket_at",
  "received_at",
  "reading_id",
  "internal_temperature_f",
  "rssi",
  "external_condition_id",
  "outside_temperature_f",
  "humidity_pct",
  "precip_mm",
  "wind_mps",
  "wind_gust_mps",
  "pressure_hpa",
  "cloud_pct",
  "alert_id",
  "severity",
  "direction",
  "threshold_value",
  "alert_temperature_f",
  "resolved",
  "resolved_at",
  "created_at",
  "updated_at",
  "hive_installed_at",
  "hive_archived_at",
  "device_installed_at",
  "device_last_seen_at",
  "warning_low_threshold",
  "warning_high_threshold",
  "critical_low_threshold",
  "critical_high_threshold",
  "location_lat",
  "location_lon",
  "provider",
  "external_status",
  "error_message",
];

const CSV_STRING_COLUMNS = new Set([0, 2, 3, 6, 21, 22, 39, 40, 41]);

exports.getLatestHiveReading = async ({ beekeeperId, hiveId }) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const hId = requirePositiveInt("hiveId", hiveId);

  const row = await analyticsRepo.getLatestReadingForHive({
    beekeeperId: bkId,
    hiveId: hId,
  });

  if (!row) throw notFound("Hive not found");

  return mapLatestReading(row);
};

exports.getHiveReadingsSince = async ({
  beekeeperId,
  hiveId,
  since,
  until,
  limit,
  order,
}) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const hId = requirePositiveInt("hiveId", hiveId);
  const sinceDate = requireDate("since", since);
  const untilDate = optionalAfterDate("until", sinceDate, until);
  const readLimit = normalizeLimit(limit, HIVE_READ_LIMIT);
  const readOrder = normalizeOrder(order);

  const rows = await analyticsRepo.getHiveReadingsSince({
    beekeeperId: bkId,
    hiveId: hId,
    since: sinceDate,
    until: untilDate,
    limit: readLimit,
    order: readOrder,
  });

  return {
    hiveId: hId,
    readings: rows.map(mapHistoricalReading),
  };
};

exports.getHivesStatus = async ({ beekeeperId, range, start, end, bucket, locationId }) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const locId = optionalPositiveInt("locationId", locationId);
  const rangeInfo = resolveAnalyticsWindow({ range, start, end, bucket });
  const statusNow = new Date();

  const rows = await analyticsRepo.getHiveStatusRows({
    beekeeperId: bkId,
    startAt: rangeInfo.startAt,
    endAt: rangeInfo.endAt,
    locationId: locId,
  });

  return {
    ...mapWindow(rangeInfo),
    bucketSize: rangeInfo.bucketSize,
    locationId: locId,
    hives: rows.map((row) => mapHiveStatus(row, statusNow)),
  };
};

exports.getHiveSummary = async ({ beekeeperId, hiveId, range, start, end, bucket }) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const hId = requirePositiveInt("hiveId", hiveId);
  const rangeInfo = resolveAnalyticsWindow({ range, start, end, bucket });

  const row = await analyticsRepo.getHiveSummaryRow({
    beekeeperId: bkId,
    hiveId: hId,
    startAt: rangeInfo.startAt,
    endAt: rangeInfo.endAt,
  });

  if (!row) throw notFound("Hive not found");

  return {
    hiveId: hId,
    ...mapWindow(rangeInfo),
    summary: mapSummary(row),
  };
};

exports.getHiveTemperatureSeries = async ({ beekeeperId, hiveId, range, start, end, bucket }) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const hId = requirePositiveInt("hiveId", hiveId);
  const rangeInfo = resolveAnalyticsWindow({ range, start, end, bucket });

  const hive = await hivesRepo.findByIdScoped({
    beekeeperId: bkId,
    hiveId: hId,
  });

  if (!hive) throw notFound("Hive not found");

  const rows = await analyticsRepo.getHiveTemperatureSeries({
    beekeeperId: bkId,
    hiveId: hId,
    startAt: rangeInfo.startAt,
    endAt: rangeInfo.endAt,
    bucketSize: rangeInfo.bucketSize,
  });

  return {
    hiveId: hId,
    ...mapWindow(rangeInfo),
    bucketSize: rangeInfo.bucketSize,
    bucketLabel: rangeInfo.bucketLabel,
    series: rows.map((row) => mapSeriesPoint(row, rangeInfo.bucketSize)),
  };
};

exports.compareHives = async ({ beekeeperId, range, start, end, bucket, hiveIds, locationId }) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const locId = optionalPositiveInt("locationId", locationId);
  const ids = parseOptionalHiveIds(hiveIds);
  const rangeInfo = resolveAnalyticsWindow({ range, start, end, bucket });

  if (!ids.length && !locId) {
    throw badRequest("hiveIds is required");
  }

  if (locId) {
    const ownedLocations = await locationsRepo.listOwnedByBeekeeper({ beekeeperId: bkId });
    if (!ownedLocations.some((row) => Number(row.id) === locId)) {
      throw notFound("Location not found");
    }
  }

  const hives = ids.length
    ? await hivesRepo.findByIdsScoped({
      beekeeperId: bkId,
      hiveIds: ids,
      locationId: locId,
    })
    : [];

  if (ids.length && hives.length !== ids.length) {
    throw notFound("One or more hives not found");
  }

  const [rows, externalRows] = await Promise.all([
    ids.length
      ? analyticsRepo.getCompareTemperatureSeries({
        beekeeperId: bkId,
        hiveIds: ids,
        startAt: rangeInfo.startAt,
        endAt: rangeInfo.endAt,
        bucketSize: rangeInfo.bucketSize,
        locationId: locId,
      })
      : Promise.resolve([]),
    locId
      ? analyticsRepo.getLocationExternalTemperatureSeries({
        locationId: locId,
        startAt: rangeInfo.startAt,
        endAt: rangeInfo.endAt,
        bucketSize: rangeInfo.bucketSize,
      })
      : Promise.resolve([]),
  ]);

  const byHive = new Map();
  for (const hive of hives) {
    byHive.set(Number(hive.id), {
      hiveId: Number(hive.id),
      name: hive.name,
      series: [],
    });
  }

  for (const row of rows) {
    const item = byHive.get(Number(row.hive_id));
    if (item) item.series.push(mapSeriesPoint(row, rangeInfo.bucketSize));
  }

  return {
    ...mapWindow(rangeInfo),
    bucketSize: rangeInfo.bucketSize,
    bucketLabel: rangeInfo.bucketLabel,
    locationId: locId,
    hives: Array.from(byHive.values()),
    externalSeries: externalRows.map((row) => mapExternalSeriesPoint(row, rangeInfo.bucketSize)),
  };
};

exports.listOwnedLocations = async ({ beekeeperId }) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const rows = await locationsRepo.listOwnedByBeekeeper({ beekeeperId: bkId });

  return {
    locations: rows.map((row) => ({
      id: Number(row.id),
      name: row.name ?? null,
      lat: asNumber(row.lat),
      lon: asNumber(row.lon),
      displayName: formatLocationName(row),
    })),
  };
};

exports.getDashboardHiveTemperature24h = async ({ beekeeperId, hiveId }) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const hId = requirePositiveInt("hiveId", hiveId);
  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - DAY_MS);

  const rows = await analyticsRepo.getDashboardHiveTemperature24h({
    beekeeperId: bkId,
    hiveId: hId,
    startAt,
    endAt,
  });

  if (!rows.length) throw notFound("Hive not found");

  const first = rows[0];
  return {
    hive: {
      hiveId: Number(first.hive_id),
      name: first.name,
      locationId: first.location_id == null ? null : Number(first.location_id),
      locationName: first.location_name ?? null,
      locationLat: asNumber(first.location_lat),
      locationLon: asNumber(first.location_lon),
    },
    range: "1d",
    mode: "dashboard",
    startAt: toIso(startAt),
    endAt: toIso(endAt),
    bucketSize: "10m",
    bucketLabel: "10-minute",
    points: rows
      .filter((row) => row.bucket_at)
      .map(mapDashboardHivePoint),
  };
};

exports.getDashboardFleetTemperature24h = async ({ beekeeperId, locationId }) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const locId = optionalPositiveInt("locationId", locationId);
  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - DAY_MS);

  const hives = await hivesRepo.listOwnedForScope({
    beekeeperId: bkId,
    locationId: locId,
    limit: MAX_COMPARE_HIVES,
  });
  const hiveIds = hives.map((hive) => Number(hive.id));

  if (!hiveIds.length) {
    return {
      range: "1d",
      mode: "dashboard",
      startAt: toIso(startAt),
      endAt: toIso(endAt),
      bucketSize: "10m",
      bucketLabel: "10-minute",
      hives: [],
    };
  }

  const rows = await analyticsRepo.getDashboardFleetTemperature24h({
    beekeeperId: bkId,
    hiveIds,
    startAt,
    endAt,
  });

  const byHive = new Map();
  for (const hive of hives) {
    byHive.set(Number(hive.id), {
      hiveId: Number(hive.id),
      name: hive.name,
      series: [],
    });
  }

  for (const row of rows) {
    const item = byHive.get(Number(row.hive_id));
    if (!item) continue;
    item.series.push({
      bucketAt: toIso(row.bucket_at),
      temperature: asNumber(row.temperature),
      averageTemperature: asNumber(row.temperature),
    });
  }

  return {
    range: "1d",
    mode: "dashboard",
    startAt: toIso(startAt),
    endAt: toIso(endAt),
    bucketSize: "10m",
    bucketLabel: "10-minute",
    locationId: locId,
    hives: Array.from(byHive.values()),
  };
};

exports.prepareCsvExport = async ({
  beekeeperId,
  scope,
  hiveId,
  locationId,
  start,
  end,
  includeReadings,
  includeExternal,
  includeHiveDevice,
  includeAlerts,
}) => {
  const bkId = requirePositiveInt("beekeeperId", beekeeperId);
  const exportScope = normalizeExportScope(scope);
  const hId = exportScope === "hive" ? requirePositiveInt("hiveId", hiveId) : null;
  const locId =
    exportScope === "location"
      ? requirePositiveInt("locationId", locationId)
      : null;
  const startAt = optionalDate("start", start);
  const endAt = optionalDate("end", end);

  if (startAt && endAt && startAt.getTime() >= endAt.getTime()) {
    throw badRequest("start must be before end");
  }

  const includes = normalizeExportIncludes({
    includeReadings,
    includeExternal,
    includeHiveDevice,
    includeAlerts,
  });

  const hives = await analyticsExportRepo.listHiveScope({
    beekeeperId: bkId,
    scope: exportScope,
    hiveId: hId,
    locationId: locId,
  });

  if (!hives.length) {
    throw notFound("No owned hives found for export scope");
  }

  const hiveIds = hives.map((hive) => Number(hive.hive_id));
  const locationIds = Array.from(
    new Set(
      hives
        .map((hive) => (hive.location_id == null ? null : Number(hive.location_id)))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );

  return {
    filename: buildExportFilename({ scope: exportScope, startAt, endAt }),
    async writeTo(writable) {
      await writeChunk(writable, csvRow(CSV_HEADERS, CSV_STRING_COLUMNS));

      if (includes.includeHiveDevice) {
        for (const hive of hives) {
          await writeChunk(writable, csvRow(mapHiveDeviceExportRow(hive), CSV_STRING_COLUMNS));
        }
      }

      if (includes.includeReadings) {
        await writeReadingRows({ writable, beekeeperId: bkId, hiveIds, startAt, endAt });
      }

      if (includes.includeExternal && locationIds.length) {
        await writeExternalRows({ writable, locationIds, startAt, endAt });
      }

      if (includes.includeAlerts) {
        await writeAlertRows({ writable, beekeeperId: bkId, hiveIds, startAt, endAt });
      }
    },
  };
};

function mapWindow(rangeInfo) {
  return {
    range: rangeInfo.range,
    mode: rangeInfo.mode,
    startAt: toIso(rangeInfo.startAt),
    endAt: toIso(rangeInfo.endAt),
  };
}

function mapLatestReading(row) {
  const hiveId = Number(row.hive_id);

  if (row.id == null) {
    return {
      hiveId,
      reading: null,
    };
  }

  return {
    hiveId,
    reading: {
      id: Number(row.id),
      deviceId: Number(row.device_id),
      temperature: asNumber(row.temperature),
      rssi: row.rssi == null ? null : Number(row.rssi),
      bucketAt: toIso(row.bucket_at),
      receivedAt: toIso(row.received_at),
    },
  };
}

function mapHistoricalReading(row) {
  return {
    id: Number(row.id),
    deviceId: Number(row.device_id),
    temperature: asNumber(row.temperature),
    rssi: row.rssi == null ? null : Number(row.rssi),
    bucketAt: toIso(row.bucket_at),
    receivedAt: toIso(row.received_at),
    createdAt: toIso(row.created_at),
  };
}

function mapHiveStatus(row, now) {
  const latestAt = row.latest_bucket_at;
  const latestTemperature = asNumber(row.latest_temperature);
  const warningCount = asCount(row.warning_count);
  const criticalCount = asCount(row.critical_count);
  const classification =
    latestTemperature == null
      ? null
      : classifyTemperature(latestTemperature, row);

  return {
    hiveId: Number(row.id),
    name: row.name,
    status: row.status,
    locationId: row.location_id == null ? null : Number(row.location_id),
    locationName: row.location_name ?? null,
    latestTemperature,
    latestReadingAt: toIso(latestAt),
    readingCount: asCount(row.reading_count),
    averageTemperature: asNumber(row.average_temperature),
    minTemperature: asNumber(row.min_temperature),
    maxTemperature: asNumber(row.max_temperature),
    temperatureSwing: asNumber(row.temperature_swing),
    warningCount,
    criticalCount,
    latestWarningAt: toIso(row.latest_warning_at),
    latestCriticalAt: toIso(row.latest_critical_at),
    warningLowThreshold: asNumber(row.warning_low_threshold),
    warningHighThreshold: asNumber(row.warning_high_threshold),
    criticalLowThreshold: asNumber(row.critical_low_threshold),
    criticalHighThreshold: asNumber(row.critical_high_threshold),
    externalTemperature: asNumber(row.external_temperature),
    externalHumidityPct: asNumber(row.external_humidity_pct),
    externalWindMps: asNumber(row.external_wind_mps),
    externalWindGustMps: asNumber(row.external_wind_gust_mps),
    externalPressureHpa: asNumber(row.external_pressure_hpa),
    externalPrecipMm: asNumber(row.external_precip_mm),
    externalCloudPct: asNumber(row.external_cloud_pct),
    externalConditionAt: toIso(row.external_bucket_at),
    healthStatus: computeHealthStatus({
      latestAt,
      classification,
      warningCount,
      criticalCount,
      now,
    }),
  };
}

function mapSummary(row) {
  return {
    readingCount: asCount(row.reading_count),
    averageTemperature: asNumber(row.average_temperature),
    minTemperature: asNumber(row.min_temperature),
    maxTemperature: asNumber(row.max_temperature),
    temperatureSwing: asNumber(row.temperature_swing),
    warningCount: asCount(row.warning_count),
    criticalCount: asCount(row.critical_count),
    latestWarningAt: toIso(row.latest_warning_at),
    latestCriticalAt: toIso(row.latest_critical_at),
    latestTemperature: asNumber(row.latest_temperature),
    latestReadingAt: toIso(row.latest_reading_at),
  };
}

function mapSeriesPoint(row, bucketSize) {
  return {
    bucketAt: toIso(row.bucket_at),
    bucketEndAt: toIso(addBucketDuration(row.bucket_at, bucketSize)),
    bucketSize,
    averageTemperature: asNumber(row.average_temperature),
    externalTemperature: asNumber(row.external_temperature),
    minTemperature: asNumber(row.min_temperature),
    maxTemperature: asNumber(row.max_temperature),
    readingCount: asCount(row.reading_count),
  };
}

function mapExternalSeriesPoint(row, bucketSize) {
  const temperature = asNumber(row.external_temperature);

  return {
    bucketAt: toIso(row.bucket_at),
    bucketEndAt: toIso(addBucketDuration(row.bucket_at, bucketSize)),
    bucketSize,
    temperature,
    externalTemperature: temperature,
  };
}

function mapDashboardHivePoint(row) {
  return {
    bucketAt: toIso(row.bucket_at),
    readingId: row.reading_id == null ? null : Number(row.reading_id),
    internalTemperature: asNumber(row.internal_temperature),
    rssi: row.rssi == null ? null : Number(row.rssi),
    receivedAt: toIso(row.received_at),
    externalConditionId:
      row.external_condition_id == null ? null : Number(row.external_condition_id),
    externalConditionAt: toIso(row.bucket_at),
    outsideTemperature: asNumber(row.outside_temperature),
    humidityPct: asNumber(row.humidity_pct),
    precipMm: asNumber(row.precip_mm),
    windMps: asNumber(row.wind_mps),
    windGustMps: asNumber(row.wind_gust_mps),
    pressureHpa: asNumber(row.pressure_hpa),
    cloudPct: asNumber(row.cloud_pct),
    externalStatus: row.external_status ?? null,
  };
}

function computeHealthStatus({
  latestAt,
  classification,
  warningCount,
  criticalCount,
  now,
}) {
  // A hive is online when its latest stored device reading is within the freshness window
  if (!latestAt || isStale(latestAt, now)) return "offline";
  if (criticalCount > 0 || classification?.severity === "critical") {
    return "critical";
  }
  if (warningCount > 0 || classification?.severity === "warning") {
    return "warning";
  }
  return "healthy";
}

function isStale(value, now) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) || now.getTime() - d.getTime() > STALE_READING_MS;
}

function parseHiveIds(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.trim() === "") {
    throw badRequest("hiveIds is required");
  }

  const ids = [];
  const seen = new Set();
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || n <= 0) {
      throw badRequest("hiveIds must be comma-separated positive integers");
    }
    if (!seen.has(n)) {
      seen.add(n);
      ids.push(n);
    }
  }

  if (ids.length === 0) {
    throw badRequest("hiveIds is required");
  }

  if (ids.length > MAX_COMPARE_HIVES) {
    throw badRequest(`hiveIds cannot include more than ${MAX_COMPARE_HIVES} hives`);
  }

  return ids;
}

function parseOptionalHiveIds(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return [];
  }

  return parseHiveIds(raw);
}

function optionalPositiveInt(name, value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  return requirePositiveInt(name, value);
}

function requireDate(name, value) {
  if (value === undefined || value === null || value === "") {
    throw badRequest(`${name} is required`);
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`Invalid ${name}`);
  }

  return parsed;
}

function optionalAfterDate(name, startDate, value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = requireDate(name, value);
  if (parsed.getTime() <= startDate.getTime()) {
    throw badRequest(`Invalid ${name}`);
  }

  return parsed;
}

function requirePositiveInt(name, value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest(`${name} must be a positive integer`);
  }
  return n;
}

function normalizeLimit(limit, { max, defaultValue }) {
  if (limit === undefined || limit === null || limit === "") {
    return defaultValue;
  }

  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest("Invalid limit");
  }

  return Math.min(parsed, max);
}

function normalizeOrder(order) {
  if (order === undefined || order === null || order === "") {
    return "desc";
  }

  const normalized = String(order).toLowerCase().trim();
  if (normalized !== "asc" && normalized !== "desc") {
    throw badRequest("Invalid order");
  }

  return normalized;
}

function addBucketDuration(value, bucketSize) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const durations = {
    "10m": 10 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    hour: 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    day: DAY_MS,
  };
  const ms = durations[bucketSize];
  return ms ? new Date(d.getTime() + ms) : null;
}

function formatLocationName(row) {
  if (row.name) return row.name;
  const lat = asNumber(row.lat);
  const lon = asNumber(row.lon);
  if (lat == null || lon == null) return `Location ${row.id}`;
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function normalizeExportScope(value) {
  const scope = String(value || "user").trim().toLowerCase();
  if (scope === "user" || scope === "hive" || scope === "location") {
    return scope;
  }
  throw badRequest("scope must be user, hive, or location");
}

function normalizeExportIncludes(input) {
  const includes = {
    includeReadings: parseBoolean(input.includeReadings, true),
    includeExternal: parseBoolean(input.includeExternal, false),
    includeHiveDevice: parseBoolean(input.includeHiveDevice, false),
    includeAlerts: parseBoolean(input.includeAlerts, false),
  };

  if (!Object.values(includes).some(Boolean)) {
    throw badRequest("Select at least one dataset to export");
  }

  return includes;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw badRequest("include flags must be true or false");
}

function optionalDate(field, value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`${field} must be a valid ISO date string`);
  }
  return d;
}

function buildExportFilename({ scope, startAt, endAt }) {
  const parts = ["beekeepr", scope, "export"];
  if (startAt && endAt) {
    parts.push(startAt.toISOString().slice(0, 10));
    parts.push(endAt.toISOString().slice(0, 10));
  } else {
    parts.push("all-data");
  }
  return `${parts.join("-")}.csv`;
}

async function writeReadingRows({ writable, beekeeperId, hiveIds, startAt, endAt }) {
  let afterBucketAt = null;
  let afterReadingId = 0;

  for (; ;) {
    const rows = await analyticsExportRepo.listReadingsBatch({
      beekeeperId,
      hiveIds,
      startAt,
      endAt,
      afterBucketAt,
      afterReadingId,
      limit: EXPORT_BATCH_SIZE,
    });

    if (!rows.length) return;

    for (const row of rows) {
      await writeChunk(writable, csvRow(mapReadingExportRow(row), CSV_STRING_COLUMNS));
    }

    const last = rows[rows.length - 1];
    afterBucketAt = last.bucket_at;
    afterReadingId = Number(last.reading_id);
  }
}

async function writeExternalRows({ writable, locationIds, startAt, endAt }) {
  let afterBucketAt = null;
  let afterExternalId = 0;

  for (; ;) {
    const rows = await analyticsExportRepo.listExternalBatch({
      locationIds,
      startAt,
      endAt,
      afterBucketAt,
      afterExternalId,
      limit: EXPORT_BATCH_SIZE,
    });

    if (!rows.length) return;

    for (const row of rows) {
      await writeChunk(writable, csvRow(mapExternalExportRow(row), CSV_STRING_COLUMNS));
    }

    const last = rows[rows.length - 1];
    afterBucketAt = last.bucket_at;
    afterExternalId = Number(last.external_condition_id);
  }
}

async function writeAlertRows({ writable, beekeeperId, hiveIds, startAt, endAt }) {
  let afterCreatedAt = null;
  let afterAlertId = 0;

  for (; ;) {
    const rows = await analyticsExportRepo.listAlertsBatch({
      beekeeperId,
      hiveIds,
      startAt,
      endAt,
      afterCreatedAt,
      afterAlertId,
      limit: EXPORT_BATCH_SIZE,
    });

    if (!rows.length) return;

    for (const row of rows) {
      await writeChunk(writable, csvRow(mapAlertExportRow(row), CSV_STRING_COLUMNS));
    }

    const last = rows[rows.length - 1];
    afterCreatedAt = last.created_at;
    afterAlertId = Number(last.alert_id);
  }
}

function mapHiveDeviceExportRow(row) {
  return exportRow({
    recordType: "hive_device",
    hiveId: row.hive_id,
    hiveName: row.hive_name,
    hiveStatus: row.hive_status,
    deviceId: row.device_id,
    locationId: row.location_id,
    locationName: row.location_name,
    hiveInstalledAt: row.hive_installed_at,
    hiveArchivedAt: row.hive_archived_at,
    deviceInstalledAt: row.device_installed_at,
    deviceLastSeenAt: row.device_last_seen_at,
    warningLowThreshold: row.warning_low_threshold,
    warningHighThreshold: row.warning_high_threshold,
    criticalLowThreshold: row.critical_low_threshold,
    criticalHighThreshold: row.critical_high_threshold,
    locationLat: row.location_lat,
    locationLon: row.location_lon,
  });
}

function mapReadingExportRow(row) {
  return exportRow({
    recordType: "reading",
    hiveId: row.hive_id,
    hiveName: row.hive_name,
    deviceId: row.device_id,
    locationId: row.location_id,
    locationName: row.location_name,
    bucketAt: row.bucket_at,
    receivedAt: row.received_at,
    readingId: row.reading_id,
    internalTemperature: row.internal_temperature,
    rssi: row.rssi,
  });
}

function mapExternalExportRow(row) {
  return exportRow({
    recordType: "external_condition",
    locationId: row.location_id,
    locationName: row.location_name,
    bucketAt: row.bucket_at,
    externalConditionId: row.external_condition_id,
    outsideTemperature: row.outside_temperature,
    humidityPct: row.humidity_pct,
    precipMm: row.precip_mm,
    windMps: row.wind_mps,
    windGustMps: row.wind_gust_mps,
    pressureHpa: row.pressure_hpa,
    cloudPct: row.cloud_pct,
    provider: row.provider,
    externalStatus: row.status,
    errorMessage: row.error_message,
    createdAt: row.fetched_at,
  });
}

function mapAlertExportRow(row) {
  return exportRow({
    recordType: "alert",
    hiveId: row.hive_id,
    hiveName: row.hive_name,
    deviceId: row.device_id,
    bucketAt: row.created_at,
    readingId: row.reading_id,
    alertId: row.alert_id,
    severity: row.severity,
    direction: row.direction,
    thresholdValue: row.threshold_value,
    alertTemperature: row.alert_temperature,
    resolved: row.resolved,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function exportRow(values) {
  return [
    values.recordType,
    values.hiveId,
    values.hiveName,
    values.hiveStatus,
    values.deviceId,
    values.locationId,
    values.locationName,
    toIso(values.bucketAt),
    toIso(values.receivedAt),
    values.readingId,
    values.internalTemperature,
    values.rssi,
    values.externalConditionId,
    values.outsideTemperature,
    values.humidityPct,
    values.precipMm,
    values.windMps,
    values.windGustMps,
    values.pressureHpa,
    values.cloudPct,
    values.alertId,
    values.severity,
    values.direction,
    values.thresholdValue,
    values.alertTemperature,
    values.resolved,
    toIso(values.resolvedAt),
    toIso(values.createdAt),
    toIso(values.updatedAt),
    toIso(values.hiveInstalledAt),
    toIso(values.hiveArchivedAt),
    toIso(values.deviceInstalledAt),
    toIso(values.deviceLastSeenAt),
    values.warningLowThreshold,
    values.warningHighThreshold,
    values.criticalLowThreshold,
    values.criticalHighThreshold,
    values.locationLat,
    values.locationLon,
    values.provider,
    values.externalStatus,
    values.errorMessage,
  ];
}

function writeChunk(writable, chunk) {
  if (writable.write(chunk)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    writable.once("drain", resolve);
    writable.once("error", reject);
  });
}

function asNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function badRequest(message) {
  return httpError(400, "VALIDATION_ERROR", message);
}

function notFound(message) {
  return httpError(404, "NOT_FOUND", message);
}
