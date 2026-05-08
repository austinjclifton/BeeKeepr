"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth.js");
const { requireCsrf } = require("../middleware/requireCsrf.js");
const hivesController = require("../controllers/hives.controller.js");
const devicesController = require("../controllers/devices.controller.js");

/**
 * GET /api/hives
 * Lists all hives for the authenticated beekeeper
 */
router.get("/", requireAuth, hivesController.list);

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
router.post("/", requireAuth, requireCsrf, hivesController.create);

/**
 * POST /api/hives/:hiveId/devices
 * Create a *DEVICE* under a hive (scoped hence why its in this file)
 */
router.post("/:hiveId/devices", requireAuth, requireCsrf, devicesController.createForHive);

/**
 * PATCH /api/hives/:id
 * Updates hive fields by its Id
 */
router.patch("/:id", requireAuth, requireCsrf, hivesController.update);

/**
 * DELETE /api/hives/:id
 * Deletes a hive by its Id
 */
router.delete("/:id", requireAuth, requireCsrf, hivesController.remove);

module.exports = router;
