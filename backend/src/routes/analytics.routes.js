"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth.js");
const analyticsController = require("../controllers/analytics.controller.js");

/**
 * GET /api/analytics/locations
 * List locations that contain hives owned by the authenticated beekeeper
 */
router.get("/locations", requireAuth, analyticsController.listLocations);

/**
 * GET /api/analytics/dashboard/fleet-temperature-24h
 * Returns operational 10-minute internal readings for dashboard fleet chart
 */
router.get(
  "/dashboard/fleet-temperature-24h",
  requireAuth,
  analyticsController.dashboardFleetTemperature24h,
);

/**
 * GET /api/analytics/export.csv
 * Streams owned readings, metadata, external conditions, or alerts as CSV
 */
router.get("/export.csv", requireAuth, analyticsController.exportCsv);

/**
 * GET /api/analytics/hives/compare
 * Compare temperature series across selected hives
 */
router.get("/hives/compare", requireAuth, analyticsController.compareHives);

module.exports = router;
