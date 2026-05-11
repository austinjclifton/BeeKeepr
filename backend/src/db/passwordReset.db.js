"use strict";
const { query } = require("./pool");

/**
 * Create/replace a reset token for a beekeeper
 */
exports.createOrReplace = async ({ beekeeperId, tokenHash, expiresAt }) => {
  const rows = await query(
    `
    INSERT INTO password_reset_token (beekeeper_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (beekeeper_id)
    DO UPDATE SET
      token_hash = EXCLUDED.token_hash,
      expires_at = EXCLUDED.expires_at,
      created_at = now(),
      consumed_at = NULL
    RETURNING beekeeper_id
    `,
    [beekeeperId, tokenHash, expiresAt],
  );

  return rows[0] ?? null;
};

/**
 * Find a reset token row by its token hash
 */
exports.findByTokenHash = async ({ tokenHash }) => {
  const rows = await query(
    `
    SELECT beekeeper_id, token_hash, expires_at, created_at, consumed_at
    FROM password_reset_token
    WHERE token_hash = $1
    LIMIT 1
    `,
    [tokenHash],
  );

  return rows[0] ?? null;
};

/**
 * Mark any reset token for a beekeeper as consumed
 */
exports.markConsumedForBeekeeper = async ({ beekeeperId }) => {
  const rows = await query(
    `
    UPDATE password_reset_token
    SET consumed_at = now()
    WHERE beekeeper_id = $1
      AND consumed_at IS NULL
    RETURNING beekeeper_id
    `,
    [beekeeperId],
  );

  return rows.length > 0;
};

exports.deleteForBeekeeper = exports.markConsumedForBeekeeper;
