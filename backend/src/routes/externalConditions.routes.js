"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth.js");
const externalConditionsController = require("../controllers/externalConditions.controller.js");

/**
 * GET /api/external-conditions/latest
 * Gets the latest external conditions for a hive
 * Query: hiveId=123
 */
router.get("/latest", requireAuth, externalConditionsController.latestForHive);

/**
 * GET /api/external-conditions/since
 * Gets external conditions for a hive since a timestamp
 * Query: hiveId=123&since=...&until=... (optional)
 */
router.get("/since", requireAuth, externalConditionsController.sinceForHive);

/**
 * POST /api/external-conditions/fetch
 * Triggers an external fetch+upsert for a hive on a successful ingest
 * Query: hiveId=123
 */
router.post("/fetch", requireAuth, externalConditionsController.fetchForHive);

module.exports = router;