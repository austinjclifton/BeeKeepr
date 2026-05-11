"use strict";

const analyticsService = require("../services/analytics.service.js");

exports.hiveReadingsSince = async (req, res, next) => {
  try {
    const q = safeQuery(req);
    const result = await analyticsService.getHiveReadingsSince({
      beekeeperId: authedUserId(req),
      hiveId: toPositiveInt(req.params.hiveId, "hiveId"),
      since: q.since,
      until: q.until,
      limit: q.limit,
      order: q.order,
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

exports.latestHiveReading = async (req, res, next) => {
  try {
    const result = await analyticsService.getLatestHiveReading({
      beekeeperId: authedUserId(req),
      hiveId: toPositiveInt(req.params.hiveId, "hiveId"),
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

exports.hivesStatus = async (req, res, next) => {
  try {
    const q = safeQuery(req);
    const result = await analyticsService.getHivesStatus({
      beekeeperId: authedUserId(req),
      range: q.range,
      start: q.start,
      end: q.end,
      bucket: q.bucket,
      locationId: q.locationId,
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

exports.hiveSummary = async (req, res, next) => {
  try {
    const q = safeQuery(req);
    const result = await analyticsService.getHiveSummary({
      beekeeperId: authedUserId(req),
      hiveId: toPositiveInt(req.params.hiveId, "hiveId"),
      range: q.range,
      start: q.start,
      end: q.end,
      bucket: q.bucket,
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

exports.hiveTemperature = async (req, res, next) => {
  try {
    const q = safeQuery(req);
    const result = await analyticsService.getHiveTemperatureSeries({
      beekeeperId: authedUserId(req),
      hiveId: toPositiveInt(req.params.hiveId, "hiveId"),
      range: q.range,
      start: q.start,
      end: q.end,
      bucket: q.bucket,
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

exports.compareHives = async (req, res, next) => {
  try {
    const q = safeQuery(req);

    const result = await analyticsService.compareHives({
      beekeeperId: authedUserId(req),
      range: q.range,
      start: q.start,
      end: q.end,
      bucket: q.bucket,
      hiveIds: q.hiveIds,
      locationId: q.locationId,
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

exports.listLocations = async (req, res, next) => {
  try {
    const result = await analyticsService.listOwnedLocations({
      beekeeperId: authedUserId(req),
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

exports.dashboardHiveTemperature24h = async (req, res, next) => {
  try {
    const result = await analyticsService.getDashboardHiveTemperature24h({
      beekeeperId: authedUserId(req),
      hiveId: toPositiveInt(req.params.hiveId, "hiveId"),
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

exports.dashboardFleetTemperature24h = async (req, res, next) => {
  try {
    const q = safeQuery(req);
    const result = await analyticsService.getDashboardFleetTemperature24h({
      beekeeperId: authedUserId(req),
      locationId: q.locationId,
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

exports.exportCsv = async (req, res, next) => {
  try {
    const q = safeQuery(req);
    const csvExport = await analyticsService.prepareCsvExport({
      beekeeperId: authedUserId(req),
      scope: q.scope,
      hiveId: q.hiveId,
      locationId: q.locationId,
      start: q.start,
      end: q.end,
      includeReadings: q.includeReadings,
      includeExternal: q.includeExternal,
      includeHiveDevice: q.includeHiveDevice,
      includeAlerts: q.includeAlerts,
    });

    res.status(200);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${csvExport.filename}"`,
    );

    await csvExport.writeTo(res);
    return res.end();
  } catch (err) {
    return next(err);
  }
};

function safeQuery(req) {
  return req.query ?? {};
}

function authedUserId(req) {
  const id = Number(req.user?.id);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("Unauthorized");
    err.status = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }
  return id;
}

function toPositiveInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error(`${field} must be a positive integer`);
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return n;
}
