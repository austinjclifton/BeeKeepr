"use strict";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CUSTOM_WINDOW_MS = 366 * DAY_MS;
const MAX_CHART_POINTS = 1500;

const BUCKETS = Object.freeze({
  "10m": { durationMs: 10 * 60 * 1000, label: "10-minute" },
  "30m": { durationMs: 30 * 60 * 1000, label: "30-minute" },
  hour: { durationMs: 60 * 60 * 1000, label: "1-hour" },
  "6h": { durationMs: 6 * 60 * 60 * 1000, label: "6-hour" },
  day: { durationMs: DAY_MS, label: "1-day" },
});

const RANGE_CONFIG = Object.freeze({
  "1d": { durationMs: DAY_MS, bucketSize: "10m" },
  "3d": { durationMs: 3 * DAY_MS, bucketSize: "hour" },
  "7d": { durationMs: 7 * DAY_MS, bucketSize: "hour" },
  "1m": { durationMs: 30 * DAY_MS, bucketSize: "6h" },
});

function normalizeAnalyticsRange(value, bucket, now = new Date()) {
  const range =
    value === undefined || value === null || value === ""
      ? "1d"
      : String(value).trim().toLowerCase();

  const config = RANGE_CONFIG[range];
  if (!config) {
    throw badRequest("range must be one of 1d, 3d, 7d, or 1m");
  }

  const startAt = new Date(now.getTime() - config.durationMs);
  const bucketSize = resolveBucketSize({
    requestedBucket: bucket,
    defaultBucket: config.bucketSize,
    durationMs: config.durationMs,
  });

  return {
    range,
    mode: "range",
    bucketSize,
    bucketLabel: BUCKETS[bucketSize].label,
    startAt,
    endAt: now,
  };
}

function resolveAnalyticsWindow({ range, start, end, bucket } = {}, now = new Date()) {
  const hasStart = hasValue(start);
  const hasEnd = hasValue(end);

  if (hasStart || hasEnd) {
    if (hasValue(range)) {
      throw badRequest("Provide either range or start/end, not both");
    }
    if (!hasStart || !hasEnd) {
      throw badRequest("start and end are required together");
    }

    const startAt = parseDate("start", start);
    const endAt = parseDate("end", end);
    const durationMs = endAt.getTime() - startAt.getTime();

    if (durationMs <= 0) {
      throw badRequest("start must be before end");
    }
    if (durationMs > MAX_CUSTOM_WINDOW_MS) {
      throw badRequest("date range cannot exceed 366 days");
    }

    const defaultBucket = bucketSizeForDuration(durationMs);
    const bucketSize = resolveBucketSize({
      requestedBucket: bucket,
      defaultBucket,
      durationMs,
    });

    return {
      range: "custom",
      mode: "custom",
      bucketSize,
      bucketLabel: BUCKETS[bucketSize].label,
      startAt,
      endAt,
    };
  }

  return normalizeAnalyticsRange(range, bucket, now);
}

function bucketSizeForDuration(durationMs) {
  if (durationMs <= 2 * DAY_MS) return "10m";
  if (durationMs <= 7 * DAY_MS) return "hour";
  if (durationMs <= 31 * DAY_MS) return "6h";
  return "day";
}

function normalizeBucket(value) {
  if (!hasValue(value) || String(value).trim().toLowerCase() === "auto") {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "1h") return "hour";
  if (normalized === "1d") return "day";

  if (!BUCKETS[normalized]) {
    throw badRequest("bucket must be auto, 10m, 30m, hour, 6h, or day");
  }

  return normalized;
}

function resolveBucketSize({ requestedBucket, defaultBucket, durationMs }) {
  const bucketSize = normalizeBucket(requestedBucket) ?? defaultBucket;
  const bucket = BUCKETS[bucketSize];
  const estimatedPoints = Math.ceil(durationMs / bucket.durationMs);

  if (estimatedPoints > MAX_CHART_POINTS) {
    throw badRequest(
      `bucket ${bucketSize} is too small for this range; choose a larger bucket`,
    );
  }

  return bucketSize;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function parseDate(field, value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid ISO date string`);
  }
  return date;
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

module.exports = {
  BUCKETS,
  MAX_CHART_POINTS,
  normalizeAnalyticsRange,
  resolveAnalyticsWindow,
};
