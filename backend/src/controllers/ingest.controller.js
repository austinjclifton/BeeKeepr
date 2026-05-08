"use strict";

const ingestService = require("../services/ingest.service.js");

/**
 * POST /ingest/readings
 *
 * Header (handled by middleware):
 * - x-ingest-token: <token>
 *
 * Body:
 * - { deviceId, temperature, rssi }
 *
 * Rules:
 * - deviceId, temperature, rssi are required
 * - recordedAt is NOT accepted from clients; server computes bucket_at
 * - Returns 409 when the service reports an existing reading for the computed bucket_at value
 */
exports.create = async (req, res, next) => {
  try {
    const payload = req.body;
    const { deviceId, temperature, rssi } = payload;

    const result = await ingestService.createReading({
      deviceId,
      temperature,
      rssi,
    });

    // Return 409 when the computed bucket_at already exists for this device
    if (!result.inserted) {
      return res.status(409).json({
        success: false,
        inserted: false,
        error: "Reading already exists for this 10-minute bucket",
      });
    }

    // Return 201 when the reading is inserted
    return res.status(201).json({
      success: true,
      inserted: true,
      reading: result.reading ?? undefined,
    });
  } catch (err) {
    return next(err);
  }
};
