"use strict";
const { query, withTransaction } = require("./pool");

const AUTH_USER_SELECT = `
  SELECT
    id,
    username,
    email,
    password_hash,
    phone,
    alerts_enabled,
    warning_low_threshold,
    warning_high_threshold,
    critical_low_threshold,
    critical_high_threshold,
    created_at,
    updated_at
  FROM beekeeper
`;

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
      alerts_enabled,
      warning_low_threshold,
      warning_high_threshold,
      critical_low_threshold,
      critical_high_threshold,
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
    ${AUTH_USER_SELECT}
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
    ${AUTH_USER_SELECT}
    WHERE username = $1
    LIMIT 1
    `,
    [username],
  );

  return rows[0] ?? null;
};

/**
 * Find a beekeeper by username or email for login
 */
exports.findByLoginIdentifier = async ({ identifier, email }) => {
  const rows = await query(
    `
    ${AUTH_USER_SELECT}
    WHERE username = $1 OR email = $2
    ORDER BY CASE WHEN username = $1 THEN 0 ELSE 1 END
    LIMIT 1
    `,
    [identifier, email],
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
  return withTransaction(async (client) => {
    const rows = await client.query(
      `
      UPDATE beekeeper
      SET
        alerts_enabled = CASE WHEN $2::boolean THEN $3 ELSE alerts_enabled END,
        warning_low_threshold = CASE WHEN $4::boolean THEN $5 ELSE warning_low_threshold END,
        warning_high_threshold = CASE WHEN $6::boolean THEN $7 ELSE warning_high_threshold END,
        critical_low_threshold = CASE WHEN $8::boolean THEN $9 ELSE critical_low_threshold END,
        critical_high_threshold = CASE WHEN $10::boolean THEN $11 ELSE critical_high_threshold END,
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
        alertsEnabled !== undefined,
        alertsEnabled ?? null,
        warningLow !== undefined,
        warningLow ?? null,
        warningHigh !== undefined,
        warningHigh ?? null,
        criticalLow !== undefined,
        criticalLow ?? null,
        criticalHigh !== undefined,
        criticalHigh ?? null,
      ],
    );

    const updated = rows.rows[0] ?? null;
    if (!updated) return null;

    let propagatedHiveCount = 0;
    const hasThresholds =
      warningLow !== undefined &&
      warningHigh !== undefined &&
      criticalLow !== undefined &&
      criticalHigh !== undefined;

    if (hasThresholds) {
      const hiveRows = await client.query(
        `
        UPDATE hive
        SET
          warning_low_threshold = $2,
          warning_high_threshold = $3,
          critical_low_threshold = $4,
          critical_high_threshold = $5
        WHERE beekeeper_id = $1
          AND status = 'active'
        RETURNING id
        `,
        [beekeeperId, warningLow, warningHigh, criticalLow, criticalHigh],
      );
      propagatedHiveCount = hiveRows.rowCount;
    }

    return {
      ...updated,
      propagated_hive_count: propagatedHiveCount,
    };
  });
};
