"use strict";
const { query } = require("./pool");

/**
 * Create a new session record
 */
exports.create = async ({
  beekeeperId,
  sessionToken,
  csrfToken,
  expiresAt,
}) => {
  const rows = await query(
    `
    INSERT INTO "session" (
      beekeeper_id,
      session_token,
      csrf_token,
      expires_at,
      active,
      created_at,
      last_activity_at
    )
    VALUES ($1, $2, $3, $4, TRUE, now(), now())
    RETURNING
      id,
      beekeeper_id,
      expires_at,
      active,
      created_at,
      last_activity_at,
      session_token,
      csrf_token
    `,
    [beekeeperId, sessionToken, csrfToken, expiresAt],
  );

  return rows[0] ?? null;
};

/**
 * Look up a session by its id
 */
exports.findById = async ({ sessionId }) => {
  const rows = await query(
    `
    SELECT
      id,
      beekeeper_id,
      expires_at,
      active,
      created_at,
      last_activity_at
    FROM "session"
    WHERE id = $1
    LIMIT 1
    `,
    [sessionId],
  );

  return rows[0] ?? null;
};

/**
 * Look up a session by its token
 */
exports.findByToken = async ({ sessionToken }) => {
  const rows = await query(
    `
    SELECT
      id,
      beekeeper_id,
      expires_at,
      active,
      created_at,
      last_activity_at,
      session_token,
      csrf_token
    FROM "session"
    WHERE session_token = $1
    LIMIT 1
    `,
    [sessionToken],
  );

  return rows[0] ?? null;
};

/**
 * Update last-activity timestamp for a session
 */
exports.touch = async ({ sessionId }) => {
  const rows = await query(
    `
    UPDATE "session"
    SET last_activity_at = now()
    WHERE id = $1
    RETURNING id
    `,
    [sessionId],
  );

  return rows.length === 1;
};

/**
 * Soft-invalidate a session (active=false)
 */
exports.invalidate = async ({ sessionId }) => {
  const rows = await query(
    `
    UPDATE "session"
    SET active = FALSE
    WHERE id = $1
    RETURNING id
    `,
    [sessionId],
  );

  return rows.length === 1;
};

/**
 * Soft-invalidate all sessions for a beekeeper
 */
exports.invalidateAllForBeekeeper = async ({ beekeeperId }) => {
  const rows = await query(
    `
    UPDATE "session"
    SET active = FALSE
    WHERE beekeeper_id = $1
    RETURNING id
    `,
    [beekeeperId],
  );

  return rows.length > 0;
};

/**
 * Hard-delete all sessions for a beekeeper
 */
exports.deleteAllForBeekeeper = async ({ beekeeperId }) => {
  const rows = await query(
    `
    DELETE FROM "session"
    WHERE beekeeper_id = $1
    RETURNING id
    `,
    [beekeeperId],
  );

  return rows.length > 0;
};
