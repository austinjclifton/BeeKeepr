"use strict";
const { query } = require("./pool");

/**
 * Create/replace a reset token for a user (1 active token per user)
 */
exports.createOrReplace = async ({ userId, tokenHash, expiresAt }) => {
  const rows = await query(
    `
    INSERT INTO password_reset_token (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id)
    DO UPDATE SET
      token_hash = EXCLUDED.token_hash,
      expires_at = EXCLUDED.expires_at
    RETURNING user_id
    `,
    [userId, tokenHash, expiresAt],
  );

  return rows[0] ?? null;
};

/**
 * Find a reset token row by its token hash
 */
exports.findByTokenHash = async ({ tokenHash }) => {
  const rows = await query(
    `
    SELECT user_id, token_hash, expires_at
    FROM password_reset_token
    WHERE token_hash = $1
    LIMIT 1
    `,
    [tokenHash],
  );

  return rows[0] ?? null;
};

/**
 * Delete any reset token for a user
 */
exports.deleteForUser = async ({ userId }) => {
  const rows = await query(
    `
    DELETE FROM password_reset_token
    WHERE user_id = $1
    RETURNING user_id
    `,
    [userId],
  );

  return rows.length > 0;
};
