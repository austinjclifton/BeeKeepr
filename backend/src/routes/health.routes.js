"use strict";

const express = require("express");
const router = express.Router();

const { query } = require("../db/pool");

/**
 * GET /health
 * Liveness probe (process is up).
 */
router.get("/", (req, res) => {
  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime_s: Math.floor(process.uptime()),
  });
});

/**
 * GET /health/ready
 * Readiness probe (DB reachable).
 */
router.get("/ready", async (req, res) => {
  try {
    await query("SELECT 1");
    return res.status(200).json({
      status: "ok",
      db: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (_err) {
    return res.status(503).json({
      status: "degraded",
      db: "down",
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
