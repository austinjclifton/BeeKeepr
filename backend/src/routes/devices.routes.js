"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth.js");
const { requireCsrf } = require("../middleware/requireCsrf.js");
const devicesController = require("../controllers/devices.controller.js");

/**
 * GET /api/devices
 * Lists all devices for the authenticated beekeeper
 */
router.get("/", requireAuth, devicesController.list);

/**
 * GET /api/devices/:id
 * Gets a single device by its Id
 */
router.get("/:id", requireAuth, devicesController.getById);

/**
 * POST /api/devices/:id/last-seen
 * Updates the last-seen timestamp for a device by its Id
 */
router.post("/:id/last-seen", requireAuth, devicesController.touchLastSeen);

/**
 * DELETE /api/devices/:id
 * Deletes a device by its Id
 */
router.delete("/:id", requireAuth, requireCsrf, devicesController.remove);

module.exports = router;
