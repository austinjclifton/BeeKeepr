"use strict";

/**
 * requireIngestToken
 * - Accepts token via:
 *   - x-ingest-token: <token>
 *   - Authorization: Bearer <token>
 * - If INGEST_SECRET is set, token must match.
 * - Attaches req.ingestToken for downstream usage (optional).
 */

const crypto = require("crypto");

module.exports.requireIngestToken = function requireIngestToken(req, res, next) {
  try {
    const token = extractIngestToken(req);
    if (!token) {
      return next(httpError(401, "UNAUTHORIZED", "ingest token is required"));
    }

    const secret = process.env.INGEST_SECRET || null;
    if (secret && !timingSafeEqualStr(token, secret)) {
      return next(httpError(401, "UNAUTHORIZED", "Invalid ingest token"));
    }

    req.ingestToken = token;
    return next();
  } catch (err) {
    return next(err);
  }
};

function extractIngestToken(req) {
  const headerToken = req.get("x-ingest-token");
  if (typeof headerToken === "string") {
    const t = headerToken.trim();
    if (t) return t;
  }

  const auth = req.get("authorization");
  if (typeof auth === "string") {
    const m = auth.trim().match(/^Bearer\s+(.+)$/i);
    if (m && m[1]) {
      const t = m[1].trim();
      if (t) return t;
    }
  }

  return null;
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}