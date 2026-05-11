"use strict";

function hasCompleteThresholds(thresholds) {
  return (
    thresholds?.warning_low_threshold != null &&
    thresholds?.warning_high_threshold != null &&
    thresholds?.critical_low_threshold != null &&
    thresholds?.critical_high_threshold != null
  );
}

function classifyTemperature(temp, thresholds) {
  if (!hasCompleteThresholds(thresholds)) return null;

  if (temp <= thresholds.critical_low_threshold) {
    return {
      severity: "critical",
      direction: "low",
      threshold: thresholds.critical_low_threshold,
    };
  }

  if (temp >= thresholds.critical_high_threshold) {
    return {
      severity: "critical",
      direction: "high",
      threshold: thresholds.critical_high_threshold,
    };
  }

  if (temp <= thresholds.warning_low_threshold) {
    return {
      severity: "warning",
      direction: "low",
      threshold: thresholds.warning_low_threshold,
    };
  }

  if (temp >= thresholds.warning_high_threshold) {
    return {
      severity: "warning",
      direction: "high",
      threshold: thresholds.warning_high_threshold,
    };
  }

  return null;
}

module.exports = {
  classifyTemperature,
  hasCompleteThresholds,
};
