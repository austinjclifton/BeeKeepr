"use strict";
const { query } = require("./pool");

/**
 * Insert a new alert
 */
exports.insertAlert = async ({
  readingId,
  beekeeperId,
  hiveId,
  deviceId,
  severity,
  direction,
  thresholdValue,
  temperature,
}) => {
  try {
    const rows = await query(
      `
      INSERT INTO alert (
        reading_id,
        beekeeper_id,
        hive_id,
        device_id,
        severity,
        direction,
        threshold_value,
        temperature
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING
        id,
        reading_id,
        severity,
        direction,
        threshold_value,
        temperature,
        email_sent,
        resolved,
        created_at
      `,
      [
        readingId,
        beekeeperId,
        hiveId,
        deviceId,
        severity,
        direction,
        thresholdValue,
        temperature,
      ],
    );

    return rows[0] ?? null;
  } catch (err) {
    throw mapPgError(err) ?? err;
  }
};

/**
 * Mark an alert's email as sent
 */
exports.markEmailSent = async ({ alertId }) => {
  await query(
    `
    UPDATE alert
    SET email_sent = TRUE,
        email_sent_at = now(),
        email_error_message = NULL
    WHERE id = $1
    `,
    [alertId],
  );
};

/**
 * Mark an alert's email as failed (with error message)
 */
exports.markEmailFailed = async ({ alertId, message }) => {
  await query(
    `
    UPDATE alert
    SET email_sent = FALSE,
        email_error_message = $2
    WHERE id = $1
    `,
    [alertId, message],
  );
};

/**
 * List alerts for a beekeeper (optionally filtered by hiveId)
 */
exports.listAlertsByBeekeeper = async ({ beekeeperId, hiveId = null }) => {
  const rows = await query(
    `
    SELECT
      a.id,
      a.reading_id,
      a.beekeeper_id,
      a.hive_id,
      a.device_id,
      a.severity,
      a.direction,
      a.threshold_value,
      a.temperature,
      a.email_sent,
      a.email_sent_at,
      a.email_error_message,
      a.resolved,
      a.resolved_at,
      a.created_at,
      a.updated_at
    FROM alert a
    WHERE a.beekeeper_id = $1
      AND ($2::bigint IS NULL OR a.hive_id = $2)
    ORDER BY a.created_at DESC
    `,
    [beekeeperId, hiveId],
  );

  return rows;
};

/**
 * Find an alert by id (scoped to a beekeeper)
 */
exports.findByIdScoped = async ({ beekeeperId, alertId }) => {
  const rows = await query(
    `
    SELECT
      id,
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
      created_at,
      updated_at
    FROM alert
    WHERE id = $1
      AND beekeeper_id = $2
    LIMIT 1
    `,
    [alertId, beekeeperId],
  );

  return rows[0] ?? null;
};

/**
 * Mark an alert as resolved
 */
exports.markResolved = async ({ alertId }) => {
  const rows = await query(
    `
    UPDATE alert
    SET resolved = TRUE,
        resolved_at = now(),
        updated_at = now()
    WHERE id = $1
    RETURNING
      id,
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
      created_at,
      updated_at
    `,
    [alertId],
  );

  return rows[0] ?? null;
};

/* ========================================================================== */
/* Error mapping                                                               */
/* ========================================================================== */

function mapPgError(err) {
  if (!err?.code) return null;

  // duplicate alert for same reading (shouldn't happen, but safe)
  if (err.code === "23505") {
    const e = new Error("Alert already exists for this reading");
    e.status = 409;
    e.code = "DUPLICATE_ALERT";
    return e;
  }

  // FK issues (reading/device/etc missing)
  if (err.code === "23503") {
    const e = new Error("Invalid alert reference");
    e.status = 400;
    e.code = "INVALID_ALERT_REFERENCE";
    return e;
  }

  return null;
}
