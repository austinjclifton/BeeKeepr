"use strict";

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth.js");
const locationsController = require("../controllers/locations.controller.js");

/**
 * GET /api/locations
 * Lists all locations
 */
router.get("/", requireAuth, locationsController.listLocations);

/**
 * GET /api/locations/:locationId
 * Gets a location by Id
 */
router.get("/:locationId", requireAuth, locationsController.getById);

/**
 * POST /api/locations
 * Creates a new location
 */
router.post("/", requireAuth, locationsController.create);

/**
 * PATCH /api/locations/:locationId
 * Updates a location by its Id
 */
router.patch("/:locationId", requireAuth, locationsController.update);

/**
 * DELETE /api/locations/:locationId
 * Deletes a location by its Id
 */
router.delete("/:locationId", requireAuth, locationsController.remove);

module.exports = router;
