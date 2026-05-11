"use strict";
const { query } = require("./pool");

/**
 * Insert/create a device for a hive
 */
exports.createScoped = async ({
  beekeeperId,
  hiveId,
  installedAt,
  lastSeenAt,
}) => {
  const hasInstalled = installedAt !== undefined;
  const hasSeen = lastSeenAt !== undefined;

  // Build dynamic insert column/value lists
  const cols = ["hive_id"];
  const vals = ["h.id"];
  const params = [];
  let p = 1;

  if (hasInstalled) {
    cols.push("installed_at");
    vals.push(`$${p++}`);
    params.push(installedAt);
  }

  if (hasSeen) {
    cols.push("last_seen_at");
    vals.push(`$${p++}`);
    params.push(lastSeenAt);
  }

  // scoping params
  const hiveIdParam = p++;
  const beekeeperIdParam = p++;
  params.push(hiveId, beekeeperId);

  try {
    const rows = await query(
      `
      INSERT INTO device (${cols.join(", ")})
      SELECT ${vals.join(", ")}
      FROM hive h
      WHERE h.id = $${hiveIdParam}
        AND h.beekeeper_id = $${beekeeperIdParam}
      RETURNING *
      `,
      params,
    );

    return rows[0] ?? null;
  } catch (err) {
    throw mapPgError(err) ?? err;
  }
};

/**
 * List all devices for a beekeeper
 */
exports.listDevicesByBeekeeper = async ({ beekeeperId }) => {
  return query(
    `
    SELECT d.*
    FROM device d
    JOIN hive h ON h.id = d.hive_id
    WHERE h.beekeeper_id = $1
    ORDER BY d.id DESC
    `,
    [beekeeperId],
  );
};

/**
 * List devices for a hive (scoped)
 */
exports.listDevicesByHiveScoped = async ({ beekeeperId, hiveId }) => {
  return query(
    `
    SELECT d.*
    FROM device d
    JOIN hive h ON h.id = d.hive_id
    WHERE d.hive_id = $1
      AND h.beekeeper_id = $2
    ORDER BY d.id DESC
    `,
    [hiveId, beekeeperId],
  );
};

/**
 * Find a device by hiveId (scoped)
 */
exports.findDeviceByHiveScoped = async ({ beekeeperId, hiveId }) => {
  const rows = await query(
    `
    SELECT d.*
    FROM device d
    JOIN hive h ON h.id = d.hive_id
    WHERE d.hive_id = $1
      AND h.beekeeper_id = $2
    LIMIT 1
    `,
    [hiveId, beekeeperId],
  );

  return rows[0] ?? null;
};

/**
 * Find a device by deviceId (scoped)
 */
exports.findDeviceByIdScoped = async ({ beekeeperId, deviceId }) => {
  const rows = await query(
    `
    SELECT d.*
    FROM device d
    JOIN hive h ON h.id = d.hive_id
    WHERE d.id = $1
      AND h.beekeeper_id = $2
    LIMIT 1
    `,
    [deviceId, beekeeperId],
  );

  return rows[0] ?? null;
};

/**
 * Check device existence (scoped)
 */
exports.existsDeviceScoped = async ({ beekeeperId, deviceId }) => {
  const rows = await query(
    `
    SELECT 1
    FROM device d
    JOIN hive h ON h.id = d.hive_id
    WHERE d.id = $1
      AND h.beekeeper_id = $2
    LIMIT 1
    `,
    [deviceId, beekeeperId],
  );

  return rows.length > 0;
};

/**
 * Update device info (scoped)
 */
exports.updateScoped = async ({
  beekeeperId,
  deviceId,
  installedAt,
  lastSeenAt,
}) => {
  const set = [];
  const values = [];
  let i = 1;

  if (installedAt !== undefined) {
    set.push(`installed_at = $${i++}`);
    values.push(installedAt);
  }

  if (lastSeenAt !== undefined) {
    set.push(`last_seen_at = $${i++}`);
    values.push(lastSeenAt);
  }

  if (set.length === 0) {
    return exports.findDeviceByIdScoped({ beekeeperId, deviceId });
  }

  values.push(deviceId, beekeeperId);

  const rows = await query(
    `
    UPDATE device d
    SET ${set.join(", ")}
    FROM hive h
    WHERE d.id = $${i++}
      AND d.hive_id = h.id
      AND h.beekeeper_id = $${i++}
    RETURNING d.*
    `,
    values,
  );

  return rows[0] ?? null;
};

/**
 * Update last_seen_at for a device (scoped)
 */
exports.touchLastSeen = async ({ deviceId, seenAt }) => {
  const rows = await query(
    `
    UPDATE device
    SET last_seen_at = COALESCE($1, now())
    WHERE id = $2
    RETURNING *
    `,
    [seenAt ?? null, deviceId],
  );

  return rows[0] ?? null;
};

/**
 * Update last_seen_at for a device (scoped)
 */
exports.touchLastSeenScoped = async ({ beekeeperId, deviceId, seenAt }) => {
  const rows = await query(
    `
    UPDATE device d
    SET last_seen_at = COALESCE($1, now())
    FROM hive h
    WHERE d.id = $2
      AND d.hive_id = h.id
      AND h.beekeeper_id = $3
    RETURNING d.*
    `,
    [seenAt ?? null, deviceId, beekeeperId],
  );

  return rows[0] ?? null;
};

/**
 * Delete a device by its id (scoped)
 */
exports.removeScoped = async ({ beekeeperId, deviceId }) => {
  const rows = await query(
    `
    DELETE FROM device d
    USING hive h
    WHERE d.id = $1
      AND d.hive_id = h.id
      AND h.beekeeper_id = $2
    RETURNING d.id
    `,
    [deviceId, beekeeperId],
  );

  return rows.length > 0;
};



/* ========================================================================== */
/* External Conditions support                                                */
/* ========================================================================== */

/**
 * Get the device's location_id by deviceId
 */
exports.getLocationIdForDevice = async ({ deviceId }) => {
  const rows = await query(
    `
    SELECT h.location_id
    FROM device d
    JOIN hive h ON h.id = d.hive_id
    WHERE d.id = $1
    LIMIT 1
    `,
    [deviceId],
  );

  return rows[0] ?? null;
};



/* ========================================================================== */
/* Email Alerting support                                                     */
/* ========================================================================== */

/**
 * Resolve full alert context for a device.
 * Returns:
 * {
 *   device_id,
 *   hive_id,
 *   beekeeper_id,
 *   email,
 *   alerts_enabled,
 *   warning_low_threshold,
 *   warning_high_threshold,
 *   critical_low_threshold,
 *   critical_high_threshold
 * }
 */
exports.getAlertContextForDevice = async ({ deviceId }) => {
  const rows = await query(
    `
    SELECT
      d.id AS device_id,
      h.id AS hive_id,
      b.id AS beekeeper_id,
      b.email,
      b.alerts_enabled,
      CASE
        WHEN h.warning_low_threshold IS NOT NULL
          AND h.warning_high_threshold IS NOT NULL
          AND h.critical_low_threshold IS NOT NULL
          AND h.critical_high_threshold IS NOT NULL
        THEN h.warning_low_threshold
        ELSE b.warning_low_threshold
      END AS warning_low_threshold,
      CASE
        WHEN h.warning_low_threshold IS NOT NULL
          AND h.warning_high_threshold IS NOT NULL
          AND h.critical_low_threshold IS NOT NULL
          AND h.critical_high_threshold IS NOT NULL
        THEN h.warning_high_threshold
        ELSE b.warning_high_threshold
      END AS warning_high_threshold,
      CASE
        WHEN h.warning_low_threshold IS NOT NULL
          AND h.warning_high_threshold IS NOT NULL
          AND h.critical_low_threshold IS NOT NULL
          AND h.critical_high_threshold IS NOT NULL
        THEN h.critical_low_threshold
        ELSE b.critical_low_threshold
      END AS critical_low_threshold,
      CASE
        WHEN h.warning_low_threshold IS NOT NULL
          AND h.warning_high_threshold IS NOT NULL
          AND h.critical_low_threshold IS NOT NULL
          AND h.critical_high_threshold IS NOT NULL
        THEN h.critical_high_threshold
        ELSE b.critical_high_threshold
      END AS critical_high_threshold
    FROM device d
    JOIN hive h ON h.id = d.hive_id
    JOIN beekeeper b ON b.id = h.beekeeper_id
    WHERE d.id = $1
    LIMIT 1
    `,
    [deviceId],
  );

  return rows[0] ?? null;
};



/* ========================================================================== */
/* Error mapping                                                               */
/* ========================================================================== */

function mapPgError(err) {
  if (!err?.code) return null;

  if (err.code === "23505") {
    const constraint = err.constraint || err.detail || "";
    const e = new Error("Device already exists for this hive");
    e.status = 409;
    e.code = "DUPLICATE_DEVICE";
    e.meta = { constraint };
    return e;
  }

  if (err.code === "23503") {
    const e = new Error("Hive does not exist");
    e.status = 400;
    e.code = "HIVE_NOT_FOUND";
    return e;
  }

  if (err.code === "22003" || err.code === "22P02") {
    const e = new Error("Invalid device values");
    e.status = 400;
    e.code = "INVALID_DEVICE";
    return e;
  }

  return null;
}
