"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth.js");
const { requireCsrf } = require("../middleware/requireCsrf.js");
const {
  requireWritableAccount,
} = require("../middleware/requireWritableAccount.js");
const hivesController = require("../controllers/hives.controller.js");
const devicesController = require("../controllers/devices.controller.js");
const analyticsController = require("../controllers/analytics.controller.js");

/**
 * GET /api/hives
 * Lists all hives for the authenticated beekeeper
 */
router.get("/", requireAuth, hivesController.list);

/**
 * GET /api/hives/status
 * Lists dashboard status for all hives owned by the authenticated beekeeper
 */
router.get("/status", requireAuth, analyticsController.hivesStatus);

/**
 * GET /api/hives/:hiveId/dashboard/temperature-24h
 * Returns selected-hive operational 10-minute internal and outside temperature
 */
router.get(
  "/:hiveId/dashboard/temperature-24h",
  requireAuth,
  analyticsController.dashboardHiveTemperature24h,
);

/**
 * GET /api/hives/:hiveId/readings/since
 * Returns readings for a hive since an ISO timestamp with optional until, limit, and order
 */
router.get(
  "/:hiveId/readings/since",
  requireAuth,
  analyticsController.hiveReadingsSince,
);

/**
 * GET /api/hives/:hiveId/readings/latest
 * Returns latest reading for a hive owned by the authenticated beekeeper
 */
router.get(
  "/:hiveId/readings/latest",
  requireAuth,
  analyticsController.latestHiveReading,
);

/**
 * GET /api/hives/:hiveId/analytics/summary
 * Returns dashboard summary analytics for one hive
 */
router.get(
  "/:hiveId/analytics/summary",
  requireAuth,
  analyticsController.hiveSummary,
);

/**
 * GET /api/hives/:hiveId/analytics/temperature
 * Returns bucketed temperature series analytics for one hive
 */
router.get(
  "/:hiveId/analytics/temperature",
  requireAuth,
  analyticsController.hiveTemperature,
);

/**
 * GET /api/hives/:id
 * Gets a single hive by its Id
 */
router.get("/:id", requireAuth, hivesController.getById);

/**
 * GET /api/hives/:hiveId/devices
 * Lists all *DEVICES* that belong to a hive
 */
router.get("/:hiveId/devices", requireAuth, devicesController.listForHive);

/**
 * POST /api/hives
 * Creates a hive for the authenticated beekeeper
 */
router.post("/", requireAuth, requireCsrf, requireWritableAccount, hivesController.create);

/**
 * POST /api/hives/:hiveId/devices
 * Create a *DEVICE* under a hive (scoped hence why its in this file)
 */
router.post(
  "/:hiveId/devices",
  requireAuth,
  requireCsrf,
  requireWritableAccount,
  devicesController.createForHive,
);

/**
 * PATCH /api/hives/:id
 * Updates hive fields by its Id
 */
router.patch("/:id", requireAuth, requireCsrf, requireWritableAccount, hivesController.update);

/**
 * DELETE /api/hives/:id
 * Deletes a hive by its Id
 */
router.delete("/:id", requireAuth, requireCsrf, requireWritableAccount, hivesController.remove);

module.exports = router;
