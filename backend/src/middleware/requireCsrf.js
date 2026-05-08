"use strict";

/**
 * requireCsrf
 *
 * Purpose:
 * - Protect authenticated, state-changing routes against CSRF.
 *
 * Assumptions:
 * - requireAuth already ran and populated req.session
 *
 * How it works:
 * - Reads token from the `x-csrf-token` request header
 * - Compares it to the per-session CSRF token stored on req.session
 *
 * Failure behavior:
 * - 401 if authentication context is missing
 * - 403 if the CSRF token is missing or does not match
 */

const crypto = require("crypto");

exports.requireCsrf = (req, res, next) => {
  if (!req.session) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const headerToken = req.get("x-csrf-token");
  const sessionToken = req.session.csrfToken;

  if (typeof headerToken !== "string" || typeof sessionToken !== "string") {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  // Check lengths first so the timing-safe comparison can run safely
  if (
    headerToken.length !== sessionToken.length ||
    !crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(sessionToken))
  ) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  return next();
};
