"use strict";

/**
 * requireAuth
 *
 * Purpose:
 * - Enforce session-based authentication for /api/* routes.
 *
 * Guarantees (on success):
 * - req.user: authenticated user context
 * - req.session: active session context for this request (includes sessionToken)
 *
 * Failure behavior:
 * - 401 if session cookie missing
 * - 401 if session invalid/expired
 */

const sessionService = require("../services/sessions.service.js");
const { SESSION_COOKIE_NAME } = require("../utils/sessionCookie.js");

exports.requireAuth = async (req, res, next) => {
  try {
    const sessionToken =
      req.signedCookies?.[SESSION_COOKIE_NAME] ??
      req.cookies?.[SESSION_COOKIE_NAME];
    if (!sessionToken) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const context = await sessionService.validateSession({ sessionToken });
    if (!context) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    req.user = context.user;

    // Ensure downstream always has token available (controllers should not read cookies)
    req.session = {
      ...context.session,
      sessionToken: context.session.sessionToken,
    };

    return next();
  } catch (err) {
    return next(err);
  }
};
