"use strict";

const crypto = require("crypto");

const usersRepo = require("../db/users.db.js");
const passwordResetRepo = require("../db/passwordReset.db.js");

/* ========================================================================== */
/* Config                                                                      */
/* ========================================================================== */

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

/* ========================================================================== */
/* Public API                                                                  */
/* ========================================================================== */

exports.requestResetForEmail = async ({ email }) => {
  // Ignore non-string or blank inputs to preserve non-enumeration behavior
  if (typeof email !== "string") return;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const user = await usersRepo.findByEmail({ email: normalizedEmail });
  if (!user) {
    // Intentional non-response to prevent account enumeration
    return;
  }

  const rawToken = await createResetToken({ userId: Number(user.id) });

  // Non-production convenience to test flows without email delivery
  if (process.env.NODE_ENV !== "production") {
    console.log("Password reset token:", rawToken);
  }

  // Future: send email or SMS here
};

exports.verifyResetToken = async ({ rawToken }) => {
  if (typeof rawToken !== "string" || rawToken.trim() === "") {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const row = await passwordResetRepo.findByTokenHash({ tokenHash });

  if (!row) return null;
  if (isExpired(row.expires_at)) return null;

  return { userId: Number(row.user_id) };
};

exports.consumeResetTokenForUser = async ({ userId }) => {
  assertPositiveInt(userId, "userId");
  await passwordResetRepo.deleteForUser({ userId });
};

/* ========================================================================== */
/* Token lifecycle                                                             */
/* ========================================================================== */

async function createResetToken({ userId }) {
  assertPositiveInt(userId, "userId");

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(now().getTime() + TOKEN_TTL_MS);

  await passwordResetRepo.createOrReplace({
    userId,
    tokenHash,
    expiresAt,
  });

  return rawToken;
}

/* ========================================================================== */
/* Crypto                                                                      */
/* ========================================================================== */

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/* ========================================================================== */
/* Time                                                                        */
/* ========================================================================== */

function now() {
  return new Date();
}

function isExpired(expiresAt) {
  return new Date(expiresAt) <= now();
}

/* ========================================================================== */
/* Validation                                                                  */
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

function assertPositiveInt(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw badRequest(`Invalid ${field}`);
  }
}
