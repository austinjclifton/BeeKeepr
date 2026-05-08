"use strict";

/**
 * Sessions Service
 *
 * Responsibilities
 * - Own session lifecycle such as create, validate, invalidate
 * - Enforce session state rules such as active and not expired
 * - Generate session and CSRF tokens
 *
 * Guarantees
 * - Missing, blank, unknown, inactive, expired, or orphaned tokens return null
 * - Expired or orphaned sessions are invalidated opportunistically
 *
 * Notes
 * - DB failures may throw and these are not auth failures
 */

const crypto = require("crypto");

const sessionsRepo = require("../db/sessions.db");
const usersRepo = require("../db/users.db");

/* ========================================================================== */
/* Config                                                                      */
/* ========================================================================== */

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const TOKEN_BYTES = 32;

/* ========================================================================== */
/* Public API                                                                  */
/* ========================================================================== */

exports.createSession = async ({ beekeeperId, context }) => {
  const id = requirePositiveInt("beekeeperId", beekeeperId);

  const sessionToken = generateToken(TOKEN_BYTES);
  const csrfToken = generateToken(TOKEN_BYTES);
  const expiresAt = computeExpiration();

  const row = await sessionsRepo.create({
    beekeeperId: id,
    sessionToken,
    csrfToken,
    expiresAt,
    context,
  });

  return mapSessionRow(row);
};

exports.validateSession = async ({ sessionToken }) => {
  if (isBlankString(sessionToken)) return null;

  const sessionRow = await sessionsRepo.findByToken({ sessionToken });
  if (!sessionRow) return null;

  if (sessionRow.active !== true) return null;

  if (isExpired(sessionRow.expires_at)) {
    await sessionsRepo.invalidate({ sessionId: sessionRow.id });
    return null;
  }

  const userRow = await usersRepo.findById({ id: sessionRow.beekeeper_id });
  if (!userRow) {
    await sessionsRepo.invalidate({ sessionId: sessionRow.id });
    return null;
  }

  // Touch only after full validation
  await sessionsRepo.touch({ sessionId: sessionRow.id });

  return {
    session: mapSessionRow(sessionRow),
    user: mapUserRow(userRow),
  };
};

exports.invalidateSession = async ({ sessionToken }) => {
  if (isBlankString(sessionToken)) return;

  const sessionRow = await sessionsRepo.findByToken({ sessionToken });
  if (!sessionRow) return;

  await sessionsRepo.invalidate({ sessionId: sessionRow.id });
};

exports.invalidateAllSessionsForUser = async ({ beekeeperId }) => {
  const id = requirePositiveInt("beekeeperId", beekeeperId);
  await sessionsRepo.invalidateAllForBeekeeper({ beekeeperId: id });
};

/* ========================================================================== */
/* Time                                                                        */
/* ========================================================================== */

function now() {
  return new Date();
}

function computeExpiration() {
  return new Date(now().getTime() + SESSION_DURATION_MS);
}

function isExpired(expiresAt) {
  const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isNaN(exp.getTime()) || exp <= now();
}

/* ========================================================================== */
/* Tokens                                                                      */
/* ========================================================================== */

function generateToken(bytes) {
  return crypto.randomBytes(bytes).toString("hex");
}

function isBlankString(v) {
  return typeof v !== "string" || v.trim() === "";
}

/* ========================================================================== */
/* Mapping                                                                     */
/* ========================================================================== */

function mapSessionRow(row) {
  return {
    id: row.id,
    beekeeperId: Number(row.beekeeper_id),
    sessionToken: row.session_token,
    csrfToken: row.csrf_token,
    expiresAt: row.expires_at,
    active: row.active,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
  };
}

function mapUserRow(row) {
  return {
    id: Number(row.id),
    username: row.username,
    email: row.email,
  };
}

/* ========================================================================== */
/* Validation                                                                  */
/* ========================================================================== */

function requirePositiveInt(field, value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest(`${field} must be a positive integer`);
  }
  return n;
}

/* ========================================================================== */
/* Errors                                                                      */
/* ========================================================================== */

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function badRequest(message) {
  return httpError(400, "VALIDATION_ERROR", message);
}
