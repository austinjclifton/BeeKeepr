"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth.js");
const { requireCsrf } = require("../middleware/requireCsrf.js");
const sessionController = require("../controllers/session.controller.js");

/**
 * GET /api/sessions/current
 * Returns the current session context (Auth)
 */
router.get("/current", requireAuth, sessionController.current);

/**
 * DELETE /api/sessions/current
 * Invalidates only the current session (log out this device) (Auth + CSRF)
 */
router.delete(
  "/current",
  requireAuth,
  requireCsrf,
  sessionController.destroyCurrent,
);

/**
 * DELETE /api/sessions
 * Invalidates all sessions for the authenticated user (Auth + CSRF)
 */
router.delete("/", requireAuth, requireCsrf, sessionController.destroyAll);

module.exports = router;
