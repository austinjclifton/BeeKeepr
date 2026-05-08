"use strict";

const sessionService = require("../services/sessions.service.js");
const { clearSessionCookie } = require("../utils/sessionCookie.js");

/* ========================================================================== */
/* GET                                                                         */
/* ========================================================================== */

/**
 * GET /api/sessions/current
 * Return minimal authenticated session context.
 */
exports.current = async (req, res, next) => {
  try {
    return res.status(200).json({
      user: req.user,
      session: {
        expiresAt: new Date(req.session.expiresAt).toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* POST                                                                        */
/* ========================================================================== */

/* ========================================================================== */
/* PATCH                                                                       */
/* ========================================================================== */

/* ========================================================================== */
/* DELETE                                                                      */
/* ========================================================================== */

/**
 * DELETE /api/sessions/current
 * Invalidate only the current session (log out this device).
 */
exports.destroyCurrent = async (req, res, next) => {
  try {
    const sessionToken = req.session?.sessionToken;

    if (typeof sessionToken === "string" && sessionToken.length) {
      await sessionService.invalidateSession({ sessionToken });
    }

    clearSessionCookie(res);
    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/sessions
 * Invalidate all sessions for the authenticated user (log out everywhere).
 */
exports.destroyAll = async (req, res, next) => {
  try {
    await sessionService.invalidateAllSessionsForUser({
      beekeeperId: authedUserId(req),
    });

    clearSessionCookie(res);
    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
};

/* ========================================================================== */
/* Helpers                                                                     */
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

function authedUserId(req) {
  const n = Number(req.user?.id);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest("Invalid authenticated user");
  }
  return n;
}