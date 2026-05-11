"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth.js");
const { requireCsrf } = require("../middleware/requireCsrf.js");
const {
  requireWritableAccount,
} = require("../middleware/requireWritableAccount.js");
const alertsController = require("../controllers/alerts.controller.js");

/**
 * GET /api/alerts
 * List alerts for a beekeeper (optionally filtered by hive)
 */
router.get("/", requireAuth, alertsController.list);

/**
 * PATCH /api/alerts/:alertId/resolve
 * Resolve a warning alert
 */
router.patch(
  "/:alertId/resolve",
  requireAuth,
  requireCsrf,
  requireWritableAccount,
  alertsController.resolve,
);

module.exports = router;
