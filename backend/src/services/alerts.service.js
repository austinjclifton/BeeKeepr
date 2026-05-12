"use strict";
const alertsRepo = require("../db/alerts.db.js");
const devicesRepo = require("../db/devices.db.js");
const resendClient = require("../utils/resendClient.js");
const { classifyTemperature } = require("../utils/alertClassification.js");

const ALERT_EMAIL_FROM =
  process.env.ALERT_EMAIL_FROM || process.env.EMAIL_FROM || "alerts@beekeepr.example";
const APP_BASE_URL = getAppBaseUrl();

/**
 * Main entry point from ingest to check if a reading is alert-worthy
 */
exports.processReading = async (reading, options = {}) => {
  const sendCriticalEmail = options.sendCriticalEmail !== false;
  const log = options.log !== false;
  const createdAt = options.createdAt ?? null;

  if (!reading || !reading.device_id) {
    return { created: false, skipped: true, reason: "missing_device" };
  }

  const ctx = await devicesRepo.getAlertContextForDevice({
    deviceId: reading.device_id,
  });

  if (!ctx) {
    if (log) {
      console.log("No alert context found", {
        deviceId: reading.device_id,
      });
    }
    return { created: false, skipped: true, reason: "missing_context" };
  }

  if (!ctx.alerts_enabled) {
    return { created: false, skipped: true, reason: "alerts_disabled" };
  }

  if (
    ctx.warning_low_threshold == null ||
    ctx.warning_high_threshold == null ||
    ctx.critical_low_threshold == null ||
    ctx.critical_high_threshold == null
  ) {
    if (log) {
      console.log(
        "Skipping alert processing: incomplete threshold configuration",
        {
          deviceId: reading.device_id,
          beekeeperId: ctx.beekeeper_id,
        },
      );
    }
    return { created: false, skipped: true, reason: "incomplete_thresholds" };
  }

  const classification = classifyTemperature(reading.temperature, ctx);
  if (!classification) {
    return { created: false, skipped: true, reason: "not_alert_worthy" };
  }
  if (log) console.log("NEW READING CLASSIFICATION:", classification);

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
      createdAt,
    });
  } catch (err) {
    // suppress duplicate alerts
    if (err.code === "DUPLICATE_ALERT") {
      if (log) {
        console.log("Duplicate alert suppressed", {
          deviceId: ctx.device_id,
          hiveId: ctx.hive_id,
          severity: classification.severity,
          direction: classification.direction,
        });
      }
      return {
        created: false,
        skipped: true,
        reason: "duplicate_alert",
        classification,
      };
    }
    throw err;
  }

  // if the alert is critical, create an email alert
  if (classification.severity === "critical" && alert && sendCriticalEmail) {
    await handleCriticalEmail({
      alertId: alert.id,
      email: ctx.email,
      hiveId: ctx.hive_id,
      temperature: reading.temperature,
      threshold: classification.threshold,
      direction: classification.direction,
    });
  }

  return { created: Boolean(alert), skipped: !alert, alert, classification };
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

  if (alert.severity !== "warning") {
    throw badRequest("Only warning alerts can be manually resolved");
  }

  if (alert.resolved) return alert;

  return alertsRepo.markResolved({ alertId });
};

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
      from: ALERT_EMAIL_FROM,
      subject: `Critical BeeKeepr Alert for Hive ${hiveId}`,
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
  const loginUrl = APP_BASE_URL ? `\n  ${APP_BASE_URL.replace(/\/+$/, "")}/login` : "";

  return `
  Hive ${hiveId} is in CRITICAL condition.

  The last recorded temperature in Hive ${hiveId} was ${temperature}º,
  and your current critical threshold (${direction}) is ${threshold}º

  Please check your dashboard immediately.${loginUrl}
  `;
}

function getAppBaseUrl() {
  const configured = process.env.APP_BASE_URL || process.env.FRONTEND_URL || null;
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5173";
  }

  return null;
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
