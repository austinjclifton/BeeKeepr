"use strict";
const alertsRepo = require("../db/alerts.db.js");
const devicesRepo = require("../db/devices.db.js");
const resendClient = require("../utils/resendClient.js");

/**
 * Main entry point from ingest to check if a reading is alert-worthy
 */
exports.processReading = async (reading) => {
  if (!reading || !reading.device_id) return;

  const ctx = await devicesRepo.getAlertContextForDevice({
    deviceId: reading.device_id,
  });

  if (!ctx) {
    console.log("No alert context found", {
      deviceId: reading.device_id,
    });
    return;
  }

  if (!ctx.alerts_enabled) return;

  if (
    ctx.warning_low_threshold == null ||
    ctx.warning_high_threshold == null ||
    ctx.critical_low_threshold == null ||
    ctx.critical_high_threshold == null
  ) {
    console.log(
      "Skipping alert processing: incomplete threshold configuration",
      {
        deviceId: reading.device_id,
        beekeeperId: ctx.beekeeper_id,
      },
    );
    return;
  }

  const classification = classify(reading.temperature, ctx);
  if (!classification) return;
  console.log("NEW READING CLASSIFICATION:", classification);

  // create alert object + store that in DB
  let alert;
  try {
    alert = await alertsRepo.insertAlert({
      readingId: reading.id,
      beekeeperId: ctx.beekeeper_id,
      hiveId: ctx.hive_id,
      deviceId: ctx.device_id,
      severity: classification.severity,
      direction: classification.direction,
      thresholdValue: classification.threshold,
      temperature: reading.temperature,
    });
  } catch (err) {
    // suppress duplicate alerts
    if (err.code === "DUPLICATE_ALERT") {
      console.log("Duplicate alert suppressed", {
        deviceId: ctx.device_id,
        hiveId: ctx.hive_id,
        severity: classification.severity,
        direction: classification.direction,
      });
      return;
    }
    throw err;
  }

  // if the alert is critical, create an email alert
  if (classification.severity === "critical" && alert) {
    await handleCriticalEmail({
      alertId: alert.id,
      email: ctx.email,
      hiveId: ctx.hive_id,
      temperature: reading.temperature,
      threshold: classification.threshold,
      direction: classification.direction,
    });
  }
};

/**
 * Function to list all alerts
 */
exports.listAlerts = async ({ beekeeperId, hiveId }) => {
  return alertsRepo.listAlertsByBeekeeper({ beekeeperId, hiveId });
};

/**
 * Function to resolve an alert
 */
exports.resolveAlert = async ({ beekeeperId, alertId }) => {
  const alert = await alertsRepo.findByIdScoped({
    beekeeperId,
    alertId,
  });

  if (!alert) throw notFound("Alert not found");

  if (alert.severity !== "critical") {
    throw badRequest("Only critical alerts can be resolved");
  }

  if (alert.resolved) return alert;

  return alertsRepo.markResolved({ alertId });
};

/* ========================================================================== */
/* Classification                                                             */
/* ========================================================================== */

function classify(temp, ctx) {
  if (temp <= ctx.critical_low_threshold) {
    return {
      severity: "critical",
      direction: "low",
      threshold: ctx.critical_low_threshold,
    };
  }

  if (temp >= ctx.critical_high_threshold) {
    return {
      severity: "critical",
      direction: "high",
      threshold: ctx.critical_high_threshold,
    };
  }

  if (temp <= ctx.warning_low_threshold) {
    return {
      severity: "warning",
      direction: "low",
      threshold: ctx.warning_low_threshold,
    };
  }

  if (temp >= ctx.warning_high_threshold) {
    return {
      severity: "warning",
      direction: "high",
      threshold: ctx.warning_high_threshold,
    };
  }

  return null;
}

/* ========================================================================== */
/* Email handling                                                             */
/* ========================================================================== */

async function handleCriticalEmail({
  alertId,
  email,
  hiveId,
  temperature,
  threshold,
  direction,
}) {
  if (!email) {
    console.log("Skipping critical alert email: missing beekeeper email", {
      alertId,
      hiveId,
    });

    await alertsRepo.markEmailFailed({
      alertId,
      message: "missing_email",
    });
    return;
  }

  try {
    console.log("SENDING EMAIL:", {
      alertId,
      to: email,
      hiveId,
      temperature,
      threshold,
      direction,
    });

    const result = await resendClient.emails.send({
      to: email,
      from: "alerts@asheville.pokergame.studio",
      subject: `CRITICAL Hive Alert For Hive ${hiveId}`,
      text: buildEmailText({
        hiveId,
        temperature,
        threshold,
        direction,
      }),
    });

    if (result?.error) {
      console.error("EMAIL SEND FAILED:", result.error);

      await alertsRepo.markEmailFailed({
        alertId,
        message: result.error.message || "email_failed",
      });
      return;
    }

    // mark the alert email as sent
    console.log("EMAIL SENT:", result);
    await alertsRepo.markEmailSent({ alertId });
  } catch (err) {
    // mark the email as failed
    console.error("EMAIL SEND FAILED:", err);
    await alertsRepo.markEmailFailed({
      alertId,
      message: err?.message || "email_failed",
    });
  }
}

function buildEmailText({ hiveId, temperature, threshold, direction }) {
  return `
  Hive ${hiveId} is in CRITICAL condition.

  The last recorded temperature in Hive ${hiveId} was ${temperature}º,
  and your current critical threshold (${direction}) is ${threshold}º

  Please check your dashboard immediately.
  https://asheville.webdev.gccis.rit.edu/login
  `;
}

/* ========================================================================== */
/* Errors                                                                     */
/* ========================================================================== */

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function badRequest(message) {
  return httpError(400, "VALIDATION_ERROR", message);
}

function notFound(message) {
  return httpError(404, "NOT_FOUND", message);
}
