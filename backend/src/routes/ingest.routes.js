"use strict";

const express = require("express");
const router = express.Router();

const { requireIngestToken } = require("../middleware/requireIngestToken.js");
const ingestController = require("../controllers/ingest.controller.js");

/**
 * POST /ingest/readings
 * Accepts telemetry payload from a device
 */
router.post("/readings", requireIngestToken, ingestController.create);

module.exports = router;