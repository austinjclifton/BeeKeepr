"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth.js");
const readingsController = require("../controllers/readings.controller.js");

/**
 * GET /api/readings/latest
 * Returns the most recent reading for a hive
 */
router.get("/latest", requireAuth, readingsController.latest);

/**
 * GET /api/readings/since
 * Returns readings for a hive since an ISO timestamp (optional until/limit/order)
 * Query: hiveId=123&since=...&until=... (optional)
 */
router.get("/since", requireAuth, readingsController.since);

module.exports = router;
