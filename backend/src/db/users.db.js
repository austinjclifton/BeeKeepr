"use strict";
const { query } = require("./pool");

/**
 * Find a beekeeper by id
 */
exports.findById = async ({ id }) => {
  const rows = await query(
    `
    SELECT
      id,
      username,
      email,
      password_hash,
      phone,
      created_at,
      updated_at
    FROM beekeeper
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  );

  return rows[0] ?? null;
};

/**
 * Find a beekeeper by email
 */
exports.findByEmail = async ({ email }) => {
  const rows = await query(
    `
    SELECT
      id,
      username,
      email,
      password_hash,
      phone,
      created_at,
      updated_at
    FROM beekeeper
    WHERE email = $1
    LIMIT 1
    `,
    [email],
  );

  return rows[0] ?? null;
};

/**
 * Find a beekeeper by username
 */
exports.findByUsername = async ({ username }) => {
  const rows = await query(
    `
    SELECT
      id,
      username,
      email,
      password_hash,
      phone,
      created_at,
      updated_at
    FROM beekeeper
    WHERE username = $1
    LIMIT 1
    `,
    [username],
  );

  return rows[0] ?? null;
};

/**
 * Create a new beekeeper record
 */
exports.create = async ({ username, email, passwordHash }) => {
  const rows = await query(
    `
    INSERT INTO beekeeper (username, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING
      id,
      username,
      email,
      phone,
      created_at,
      updated_at
    `,
    [username, email, passwordHash],
  );

  return rows[0] ?? null;
};

/**
 * Update password hash for a beekeeper
 */
exports.updatePasswordHash = async ({ id, passwordHash }) => {
  const rows = await query(
    `
    UPDATE beekeeper
    SET password_hash = $2,
        updated_at = now()
    WHERE id = $1
    RETURNING id
    `,
    [id, passwordHash],
  );

  return rows.length === 1;
};

/**
 * Delete a beekeeper by its id
 */
exports.deleteBeekeeperById = async ({ id }) => {
  const rows = await query(
    `
    DELETE FROM beekeeper
    WHERE id = $1
    RETURNING id
    `,
    [id],
  );

  return rows.length === 1;
};

/**
 * Update beekeeper alert settings (thresholds + toggles)
 */
exports.updateBeekeeperAlertSettings = async ({
  beekeeperId,
  alertsEnabled,
  warningLow,
  warningHigh,
  criticalLow,
  criticalHigh,
}) => {
  const rows = await query(
    `
    UPDATE beekeeper
    SET
      alerts_enabled = COALESCE($2, alerts_enabled),
      warning_low_threshold = COALESCE($3, warning_low_threshold),
      warning_high_threshold = COALESCE($4, warning_high_threshold),
      critical_low_threshold = COALESCE($5, critical_low_threshold),
      critical_high_threshold = COALESCE($6, critical_high_threshold),
      updated_at = now()
    WHERE id = $1
    RETURNING
      id,
      alerts_enabled,
      warning_low_threshold,
      warning_high_threshold,
      critical_low_threshold,
      critical_high_threshold,
      updated_at
    `,
    [
      beekeeperId,
      alertsEnabled ?? null,
      warningLow ?? null,
      warningHigh ?? null,
      criticalLow ?? null,
      criticalHigh ?? null,
    ],
  );

  return rows[0] ?? null;
};
