"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth.js");
const { requireCsrf } = require("../middleware/requireCsrf.js");
const {
  requireWritableAccount,
} = require("../middleware/requireWritableAccount.js");
const authController = require("../controllers/auth.controller.js");

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile (Auth)
 */
router.get("/me", requireAuth, authController.me);

/**
 * GET /api/auth/csrf
 * Returns the CSRF token for the current session (Auth)
 */
router.get("/csrf", requireAuth, authController.csrf);

/**
 * POST /api/auth/register
 * Creates a new user and starts a session
 */
router.post("/register", authController.register);

/**
 * POST /api/auth/login
 * Authenticates and starts a session
 */
router.post("/login", authController.login);

/**
 * POST /api/auth/reset-password/request
 * Requests a password reset token (always returns success)
 */
router.post("/reset-password/request", authController.requestPasswordReset);

/**
 * POST /api/auth/reset-password/confirm
 * Confirms a password reset using a one-time token
 */
router.post("/reset-password/confirm", authController.confirmPasswordReset);

/**
 * POST /api/auth/logout
 * Invalidates the current session (Auth + CSRF)
 */
router.post("/logout", requireAuth, requireCsrf, authController.logout);

/**
 * PATCH /api/auth/change-password
 * Changes the authenticated user's password (Auth + CSRF)
 */
router.patch(
  "/change-password",
  requireAuth,
  requireCsrf,
  requireWritableAccount,
  authController.changePassword,
);

/**
 * PATCH /api/auth/alert-settings
 * Updates the authenticated user's alert thresholds and toggles (Auth + CSRF)
 */
router.patch(
  "/alert-settings",
  requireAuth,
  requireCsrf,
  requireWritableAccount,
  authController.updateBeekeeperAlertSettings,
);

/**
 * DELETE /api/auth/me
 * Deletes the authenticated user and all sessions (Auth + CSRF)
 */
router.delete(
  "/me",
  requireAuth,
  requireCsrf,
  requireWritableAccount,
  authController.deleteUser,
);

module.exports = router;
