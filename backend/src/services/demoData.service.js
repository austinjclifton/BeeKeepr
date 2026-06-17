"use strict";

const bcrypt = require("bcrypt");

const demoConfig = require("../scripts/demoData.config.js");
const demoDataRepo = require("../db/demoData.db.js");
const usersRepo = require("../db/users.db.js");
const ingestRepo = require("../db/ingest.db.js");
const externalConditionsRepo = require("../db/externalConditions.db.js");
const alertsService = require("./alerts.service.js");
const locationsService = require("./locations.service.js");
const hivesService = require("./hives.service.js");
const devicesService = require("./devices.service.js");
const {
  buildExternalCondition,
  buildReadingInput,
  floorToInterval,
  subtractUtcMonths,
  toIntervalMs,
} = require("../utils/demoSimulation.js");
const { classifyTemperature } = require("../utils/alertClassification.js");

const BCRYPT_ROUNDS = 12;
const DEFAULT_BATCH_SIZE = 2500;

validateDemoConfig(demoConfig);

exports.ensureDemoSeed = async function ensureDemoSeed() {
  await exports.pruneStaleDemoData();

  const beekeeper = await ensureDemoBeekeeper();
  const beekeeperId = toEntityId(beekeeper.id, "beekeeperId");
  const locations = await ensureDemoLocations();
  const locationMap = new Map(locations.map((location) => [location.key, location]));

  const existingHives = await hivesService.listHives({ beekeeperId });
  const hiveMap = new Map(existingHives.map((hive) => [hive.name, hive]));
  const topology = [];

  for (const hiveConfig of demoConfig.hives) {
    const location = locationMap.get(hiveConfig.locationKey);
    if (!location) {
      throw new Error(`Missing demo location for ${hiveConfig.locationKey}`);
    }

    const existingHive = hiveMap.get(hiveConfig.name);
    const hivePayload = {
      beekeeperId,
      name: hiveConfig.name,
      notes: hiveConfig.notes,
      locationId: location.locationId,
      status: "active",
      installedAt: hiveConfig.installedAt,
      archivedAt: null,
      warningLowThreshold: demoConfig.thresholds.warningLowThreshold,
      warningHighThreshold: demoConfig.thresholds.warningHighThreshold,
      criticalLowThreshold: demoConfig.thresholds.criticalLowThreshold,
      criticalHighThreshold: demoConfig.thresholds.criticalHighThreshold,
    };

    const hive = existingHive
      ? await hivesService.updateHive({
        hiveId: toEntityId(existingHive.id, "hiveId"),
        ...hivePayload,
      })
      : await hivesService.createHive(hivePayload);

    if (!hive) {
      throw new Error(`Unable to ensure demo hive ${hiveConfig.name}`);
    }

    const hiveId = toEntityId(hive.id, "hiveId");
    const devices = await devicesService.listDevicesForHive({ beekeeperId, hiveId });
    let device = devices?.[0] ?? null;

    if (!device) {
      device = await devicesService.createDevice({
        beekeeperId,
        hiveId,
        installedAt: hiveConfig.deviceInstalledAt,
      });
    }

    if (!device) {
      throw new Error(`Unable to ensure a device for demo hive ${hiveConfig.name}`);
    }

    topology.push({
      ...hiveConfig,
      beekeeperId,
      hiveId,
      deviceId: toEntityId(device.id, "deviceId"),
      location,
    });
  }

  return {
    beekeeper: {
      id: beekeeperId,
      username: beekeeper.username,
    },
    locations: locations.map((location) => ({
      key: location.key,
      locationId: location.locationId,
      name: location.name,
      cityName: location.cityName,
    })),
    hives: topology.map((item) => ({
      key: item.key,
      hiveId: item.hiveId,
      deviceId: item.deviceId,
      locationKey: item.location.key,
      name: item.name,
    })),
  };
};

exports.pruneStaleDemoData = async function pruneStaleDemoData({
  removeUnusedLocations = true,
} = {}) {
  const beekeeper = await findExistingDemoBeekeeper();
  const configuredHives = getConfiguredDemoHives();
  const configuredLocations = getConfiguredDemoLocations();

  if (!beekeeper) {
    return {
      beekeeper: null,
      configuredHives,
      configuredLocations,
      removeUnusedLocations,
      staleHives: [],
      deletedLocations: [],
      prunableLocations: [],
      deleted: createDeleteSummary(),
    };
  }

  const beekeeperId = toEntityId(beekeeper.id, "beekeeperId");
  const result = await demoDataRepo.pruneStaleDemoData({
    beekeeperId,
    configuredHiveNames: configuredHives.map((hive) => hive.name),
    configuredLocations,
    provider: demoConfig.provider,
    removeUnusedLocations,
  });

  return {
    beekeeper: {
      id: beekeeperId,
      username: beekeeper.username,
    },
    configuredHives,
    configuredLocations: configuredLocations.map((location) => ({
      key: location.key,
      name: location.name,
      cityName: location.cityName,
    })),
    removeUnusedLocations,
    ...result,
  };
};

exports.resetDemoRuntimeData = async function resetDemoRuntimeData() {
  const beekeeper = await findExistingDemoBeekeeper();
  const configuredHives = getConfiguredDemoHives();
  const configuredLocations = getConfiguredDemoLocations();

  if (!beekeeper) {
    return {
      beekeeper: null,
      configuredHives,
      configuredLocations: configuredLocations.map((location) => ({
        key: location.key,
        name: location.name,
        cityName: location.cityName,
      })),
      resetLocations: [],
      sharedLocationsSkipped: [],
      deleted: createDeleteSummary(),
    };
  }

  const beekeeperId = toEntityId(beekeeper.id, "beekeeperId");
  const result = await demoDataRepo.resetDemoRuntimeData({
    beekeeperId,
    configuredLocations,
    provider: demoConfig.provider,
  });

  return {
    beekeeper: {
      id: beekeeperId,
      username: beekeeper.username,
    },
    configuredHives,
    configuredLocations: configuredLocations.map((location) => ({
      key: location.key,
      name: location.name,
      cityName: location.cityName,
    })),
    ...result,
  };
};

exports.runDemoTick = async function runDemoTick({ now = new Date() } = {}) {
  const intervalMinutes = demoConfig.history.intervalMinutes;
  const bucketAtDate = floorToInterval(toDate(now, "now"), intervalMinutes);
  const result = await runDemoRange({
    startAt: bucketAtDate,
    endAt: bucketAtDate,
    intervalMinutes,
    withAlerts: true,
    sendCriticalEmails: true,
    touchLastSeen: true,
    batchSize: demoConfig.hives.length,
  });

  return {
    bucketAt: bucketAtDate.toISOString(),
    beekeeper: result.beekeeper,
    externalConditionsInserted: result.tables.external_condition.inserted,
    externalConditionsSkipped: result.tables.external_condition.skipped,
    externalConditionsUpserted:
      result.tables.external_condition.inserted +
      result.tables.external_condition.skipped,
    readingsInserted: result.tables.reading.inserted,
    readingsSkipped: result.tables.reading.skipped,
    alertsCreated: result.tables.alert.created,
    alertsSkipped: result.tables.alert.skipped,
    locations: result.locations.map((location) => ({
      key: location.key,
      locationId: location.locationId,
      cityName: location.cityName,
      temperature: location.latestTemperature,
      inserted: location.inserted > 0,
    })),
    hives: result.hives.map((hive) => ({
      key: hive.key,
      hiveId: hive.hiveId,
      deviceId: hive.deviceId,
      locationKey: hive.locationKey,
      temperature: hive.latestTemperature,
      rssi: hive.latestRssi,
      inserted: hive.inserted > 0,
      scenarios: hive.latestScenarios,
    })),
  };
};

exports.runDemoBackfill = async function runDemoBackfill({
  start = null,
  end = null,
  months = demoConfig.history.months,
  intervalMinutes = demoConfig.history.intervalMinutes,
  withAlerts = false,
  now = new Date(),
  batchSize = DEFAULT_BATCH_SIZE,
} = {}) {
  const window = resolveBackfillWindow({
    start,
    end,
    months,
    intervalMinutes,
    now,
  });

  return runDemoRange({
    startAt: window.startAt,
    endAt: window.endAt,
    intervalMinutes: window.intervalMinutes,
    withAlerts,
    sendCriticalEmails: false,
    touchLastSeen: true,
    batchSize,
    requestedEndAt: window.requestedEndAt,
    futureBucketsSkipped: window.futureBucketsSkipped,
  });
};

async function runDemoRange({
  startAt,
  endAt,
  intervalMinutes,
  withAlerts,
  sendCriticalEmails,
  touchLastSeen,
  batchSize,
  requestedEndAt = endAt,
  futureBucketsSkipped = 0,
}) {
  const seed = await exports.ensureDemoSeed();
  const topology = await buildDemoTopology(seed);
  const intervalMs = toIntervalMs(intervalMinutes);
  const summary = createRangeSummary({
    seed,
    topology,
    startAt,
    endAt,
    requestedEndAt,
    intervalMinutes,
    futureBucketsSkipped,
    withAlerts,
  });
  const locationByKey = new Map(topology.locations.map((location) => [location.key, location]));
  const externalBatch = [];
  const readingBatch = [];

  for (let atMs = startAt.getTime(); atMs <= endAt.getTime(); atMs += intervalMs) {
    const bucketAtDate = new Date(atMs);
    const bucketAt = bucketAtDate.toISOString();
    const externalByLocationKey = new Map();

    for (const location of topology.locations) {
      const external = buildExternalCondition(location, bucketAtDate);
      externalByLocationKey.set(location.key, external);
      externalBatch.push({
        locationKey: location.key,
        locationId: location.locationId,
        bucketAt,
        fetchedAt: bucketAt,
        provider: demoConfig.provider,
        status: "success",
        temperature: external.temperature,
        humidityPct: external.humidityPct,
        precipMm: external.precipMm,
        windMps: external.windMps,
        windGustMps: external.windGustMps,
        pressureHpa: external.pressureHpa,
        cloudPct: external.cloudPct,
        rawJson: {
          source: demoConfig.provider,
          cityName: location.cityName,
          bucketAt,
          climateProfile: location.key,
        },
      });

      const locationSummary = summary.locationsByKey.get(location.key);
      locationSummary.latestTemperature = external.temperature;
    }

    for (const hive of topology.hives) {
      const location = locationByKey.get(hive.location.key);
      const externalCondition = externalByLocationKey.get(hive.location.key);
      const readingInput = buildReadingInput({
        hive,
        location,
        bucketAtDate,
        externalCondition,
      });
      const classification = classifyTemperature(
        readingInput.temperature,
        getDemoThresholdsForClassification(hive),
      );

      readingBatch.push({
        hiveKey: hive.key,
        hiveId: hive.hiveId,
        locationKey: hive.location.key,
        deviceId: hive.deviceId,
        bucketAt,
        temperature: readingInput.temperature,
        rssiDbm: readingInput.rssi,
        scenarios: readingInput.scenarios,
        alertCandidate: classification !== null,
      });

      const hiveSummary = summary.hivesByKey.get(hive.key);
      hiveSummary.latestTemperature = readingInput.temperature;
      hiveSummary.latestRssi = readingInput.rssi;
      hiveSummary.latestScenarios = readingInput.scenarios;
      hiveSummary.minTemperature = minValue(
        hiveSummary.minTemperature,
        readingInput.temperature,
      );
      hiveSummary.maxTemperature = maxValue(
        hiveSummary.maxTemperature,
        readingInput.temperature,
      );
      for (const scenario of readingInput.scenarios) {
        hiveSummary.scenarioBuckets[scenario.type] =
          (hiveSummary.scenarioBuckets[scenario.type] || 0) + 1;
      }
    }

    if (externalBatch.length >= batchSize) {
      await flushExternalBatch({ batch: externalBatch, summary });
    }

    if (readingBatch.length >= batchSize) {
      await flushReadingBatch({
        batch: readingBatch,
        summary,
        withAlerts,
        sendCriticalEmails,
      });
    }
  }

  await flushExternalBatch({ batch: externalBatch, summary });
  await flushReadingBatch({
    batch: readingBatch,
    summary,
    withAlerts,
    sendCriticalEmails,
  });

  if (touchLastSeen) {
    await touchDemoDevices({ topology, seenAt: endAt.toISOString() });
  }

  return finalizeSummary(summary);
}

async function flushExternalBatch({ batch, summary }) {
  if (batch.length === 0) return;

  const rows = batch.splice(0, batch.length);
  const results = await externalConditionsRepo.createManyDeduped({
    conditions: rows,
  });
  const resultByKey = new Map(
    results.map((result) => [
      bucketKey(result.condition.location_id, result.condition.bucket_at),
      result,
    ]),
  );

  for (const row of rows) {
    const result = resultByKey.get(bucketKey(row.locationId, row.bucketAt));
    const inserted = result?.inserted === true;
    const locationSummary = summary.locationsByKey.get(row.locationKey);

    if (inserted) {
      summary.tables.external_condition.inserted += 1;
      locationSummary.inserted += 1;
    } else {
      summary.tables.external_condition.skipped += 1;
      locationSummary.skipped += 1;
    }
  }
}

async function flushReadingBatch({
  batch,
  summary,
  withAlerts,
  sendCriticalEmails,
}) {
  if (batch.length === 0) return;

  const rows = batch.splice(0, batch.length);
  const results = await ingestRepo.createReadingsDeduped10mBatch({
    readings: rows,
  });
  const resultByKey = new Map(
    results.map((result) => [
      bucketKey(result.reading.device_id, result.reading.bucket_at),
      result,
    ]),
  );

  for (const row of rows) {
    const result = resultByKey.get(bucketKey(row.deviceId, row.bucketAt));
    const inserted = result?.inserted === true;
    const hiveSummary = summary.hivesByKey.get(row.hiveKey);

    if (inserted) {
      summary.tables.reading.inserted += 1;
      hiveSummary.inserted += 1;
    } else {
      summary.tables.reading.skipped += 1;
      hiveSummary.skipped += 1;
    }

    if (withAlerts && row.alertCandidate && result?.reading) {
      summary.tables.alert.candidates += 1;
      const alertResult = await alertsService.processReading(result.reading, {
        sendCriticalEmail: sendCriticalEmails,
        createdAt: row.bucketAt,
        log: sendCriticalEmails,
      });

      if (alertResult?.created) {
        summary.tables.alert.created += 1;
        hiveSummary.alertsCreated += 1;
      } else {
        summary.tables.alert.skipped += 1;
        hiveSummary.alertsSkipped += 1;
      }
    }
  }
}

async function touchDemoDevices({ topology, seenAt }) {
  for (const hive of topology.hives) {
    await devicesService.touchLastSeen({
      beekeeperId: hive.beekeeperId,
      deviceId: hive.deviceId,
      seenAt,
    });
  }
}

async function findExistingDemoBeekeeper() {
  return usersRepo.findByUsername({ username: getDemoUsername() });
}

async function ensureDemoBeekeeper() {
  const username = getDemoUsername();
  let user = await usersRepo.findByUsername({ username });

  if (!user) {
    const passwordHash = await bcrypt.hash(getDemoPassword(), BCRYPT_ROUNDS);

    try {
      user = await usersRepo.create({
        username,
        email: getDemoEmail(),
        passwordHash,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error("Demo account email is already in use");
      }

      throw err;
    }
  }

  const beekeeperId = toEntityId(user.id, "beekeeperId");
  const configuredPassword = normalizeConfiguredValue(process.env.DEMO_ACCOUNT_PASSWORD);
  if (configuredPassword) {
    const passwordHash = await bcrypt.hash(configuredPassword, BCRYPT_ROUNDS);
    await usersRepo.updatePasswordHash({ id: beekeeperId, passwordHash });
  }

  await usersRepo.updateBeekeeperAlertSettings({
    beekeeperId,
    alertsEnabled: demoConfig.thresholds.alertsEnabled,
    warningLow: demoConfig.thresholds.warningLowThreshold,
    warningHigh: demoConfig.thresholds.warningHighThreshold,
    criticalLow: demoConfig.thresholds.criticalLowThreshold,
    criticalHigh: demoConfig.thresholds.criticalHighThreshold,
  });

  return (await usersRepo.findById({ id: beekeeperId })) || user;
}

async function ensureDemoLocations() {
  const ensured = [];

  for (const locationConfig of demoConfig.locations) {
    const location = await locationsService.createOrGetLocation({
      name: locationConfig.name,
      lat: locationConfig.lat,
      lon: locationConfig.lon,
    });

    if (!location) {
      throw new Error(`Unable to ensure demo location ${locationConfig.name}`);
    }

    ensured.push({
      ...locationConfig,
      locationId: toEntityId(location.id, "locationId"),
    });
  }

  return ensured;
}

async function buildDemoTopology(seed) {
  const locationsByKey = new Map();
  for (const location of demoConfig.locations) {
    const seededLocation = seed.locations.find((entry) => entry.key === location.key);
    locationsByKey.set(location.key, {
      ...location,
      locationId: toEntityId(seededLocation.locationId, "locationId"),
    });
  }

  return {
    locations: Array.from(locationsByKey.values()),
    hives: seed.hives.map((hive) => {
      const hiveConfig = demoConfig.hives.find((entry) => entry.key === hive.key);

      return {
        ...hiveConfig,
        beekeeperId: seed.beekeeper.id,
        hiveId: toEntityId(hive.hiveId, "hiveId"),
        deviceId: toEntityId(hive.deviceId, "deviceId"),
        location: locationsByKey.get(hive.locationKey),
      };
    }),
  };
}

function resolveBackfillWindow({
  start,
  end,
  months,
  intervalMinutes,
  now,
}) {
  const normalizedIntervalMinutes = toPositiveInteger(
    intervalMinutes,
    "intervalMinutes",
  );
  const nowBucket = floorToInterval(toDate(now, "now"), normalizedIntervalMinutes);
  const requestedEndAt = end
    ? floorToInterval(toDate(end, "end"), normalizedIntervalMinutes)
    : nowBucket;
  const endAt = requestedEndAt > nowBucket ? nowBucket : requestedEndAt;
  const monthsValue = toPositiveInteger(months, "months");
  const startAt = start
    ? floorToInterval(toDate(start, "start"), normalizedIntervalMinutes)
    : floorToInterval(
      subtractUtcMonths(endAt, monthsValue),
      normalizedIntervalMinutes,
    );

  if (startAt > endAt) {
    throw new Error("Backfill start must be before or equal to end");
  }

  return {
    startAt,
    endAt,
    requestedEndAt,
    intervalMinutes: normalizedIntervalMinutes,
    futureBucketsSkipped: requestedEndAt > nowBucket
      ? countBuckets({
        startAt: new Date(nowBucket.getTime() + toIntervalMs(normalizedIntervalMinutes)),
        endAt: requestedEndAt,
        intervalMinutes: normalizedIntervalMinutes,
      })
      : 0,
  };
}

function createRangeSummary({
  seed,
  topology,
  startAt,
  endAt,
  requestedEndAt,
  intervalMinutes,
  futureBucketsSkipped,
  withAlerts,
}) {
  return {
    beekeeper: seed.beekeeper,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    requestedEndAt: requestedEndAt.toISOString(),
    intervalMinutes,
    buckets: countBuckets({ startAt, endAt, intervalMinutes }),
    futureBucketsSkipped,
    withAlerts,
    tables: {
      external_condition: { inserted: 0, skipped: 0 },
      reading: { inserted: 0, skipped: 0 },
      alert: { candidates: 0, created: 0, skipped: 0 },
    },
    locationsByKey: new Map(
      topology.locations.map((location) => [
        location.key,
        {
          key: location.key,
          locationId: location.locationId,
          name: location.name,
          cityName: location.cityName,
          inserted: 0,
          skipped: 0,
          latestTemperature: null,
        },
      ]),
    ),
    hivesByKey: new Map(
      topology.hives.map((hive) => [
        hive.key,
        {
          key: hive.key,
          hiveId: hive.hiveId,
          deviceId: hive.deviceId,
          locationKey: hive.location.key,
          name: hive.name,
          inserted: 0,
          skipped: 0,
          alertsCreated: 0,
          alertsSkipped: 0,
          minTemperature: null,
          maxTemperature: null,
          latestTemperature: null,
          latestRssi: null,
          latestScenarios: [],
          scenarioBuckets: {},
        },
      ]),
    ),
  };
}

function finalizeSummary(summary) {
  return {
    beekeeper: summary.beekeeper,
    startAt: summary.startAt,
    endAt: summary.endAt,
    requestedEndAt: summary.requestedEndAt,
    intervalMinutes: summary.intervalMinutes,
    buckets: summary.buckets,
    futureBucketsSkipped: summary.futureBucketsSkipped,
    withAlerts: summary.withAlerts,
    tables: summary.tables,
    locations: Array.from(summary.locationsByKey.values()),
    hives: Array.from(summary.hivesByKey.values()),
  };
}

function getDemoThresholdsForClassification(hive) {
  const thresholds = hive.thresholds || demoConfig.thresholds;

  return {
    warning_low_threshold: thresholds.warningLowThreshold,
    warning_high_threshold: thresholds.warningHighThreshold,
    critical_low_threshold: thresholds.criticalLowThreshold,
    critical_high_threshold: thresholds.criticalHighThreshold,
  };
}

function countBuckets({ startAt, endAt, intervalMinutes }) {
  if (endAt < startAt) return 0;
  return Math.floor((endAt.getTime() - startAt.getTime()) / toIntervalMs(intervalMinutes)) + 1;
}

function bucketKey(id, bucketAt) {
  return `${Number(id)}|${toDate(bucketAt, "bucketAt").toISOString()}`;
}

function getConfiguredDemoHives() {
  return demoConfig.hives.map((hive) => ({
    key: hive.key,
    name: hive.name,
    locationKey: hive.locationKey,
  }));
}

function getConfiguredDemoLocations() {
  return demoConfig.locations.map((location) => ({
    key: location.key,
    name: location.name,
    cityName: location.cityName,
    lat: location.lat,
    lon: location.lon,
  }));
}

function createDeleteSummary() {
  return {
    alerts: 0,
    readings: 0,
    devices: 0,
    hives: 0,
    externalConditions: 0,
    locations: 0,
  };
}

function minValue(current, value) {
  return current === null ? value : Math.min(current, value);
}

function maxValue(current, value) {
  return current === null ? value : Math.max(current, value);
}

function getDemoUsername() {
  return (
    normalizeConfiguredValue(process.env.DEMO_ACCOUNT_USERNAME) ||
    demoConfig.account.username
  );
}

function getDemoEmail() {
  return (
    normalizeConfiguredValue(process.env.DEMO_ACCOUNT_EMAIL) ||
    demoConfig.account.email
  );
}

function getDemoPassword() {
  return (
    normalizeConfiguredValue(process.env.DEMO_ACCOUNT_PASSWORD) ||
    demoConfig.account.password
  );
}

function normalizeConfiguredValue(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized || null;
}

function toDate(value, name) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${name} date`);
  }

  return date;
}

function toPositiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return Math.floor(number);
}

function toEntityId(value, name) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid ${name}`);
  }

  return id;
}

function isUniqueViolation(err) {
  return Boolean(err && err.code === "23505");
}

/**
 * Defensive validation of the demo config. Runs once at module load
 * so that misconfigurations in `demoData.config.js` fail fast with a
 * clear message instead of producing confusing runtime errors deep
 * inside the seed / backfill path.
 *
 * Checks:
 *   - `locations` and `hives` are non-empty arrays.
 *   - Every `location.key` is a unique non-empty string.
 *   - Every `hive.key` is a unique non-empty string.
 *   - Every `hive.locationKey` resolves to a configured location.
 */
function validateDemoConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("demoData.config.js must export a configuration object");
  }

  const locations = Array.isArray(config.locations) ? config.locations : [];
  const hives = Array.isArray(config.hives) ? config.hives : [];

  if (locations.length === 0) {
    throw new Error("demoData.config.js must define at least one demo location");
  }

  if (hives.length === 0) {
    throw new Error("demoData.config.js must define at least one demo hive");
  }

  const locationKeys = new Set();
  for (const location of locations) {
    const key = location && location.key;
    if (typeof key !== "string" || key.trim() === "") {
      throw new Error("Every demo location must have a non-empty string `key`");
    }
    if (locationKeys.has(key)) {
      throw new Error(`Duplicate demo location key: ${key}`);
    }
    locationKeys.add(key);
  }

  const hiveKeys = new Set();
  for (const hive of hives) {
    const key = hive && hive.key;
    if (typeof key !== "string" || key.trim() === "") {
      throw new Error("Every demo hive must have a non-empty string `key`");
    }
    if (hiveKeys.has(key)) {
      throw new Error(`Duplicate demo hive key: ${key}`);
    }
    hiveKeys.add(key);

    const locationKey = hive.locationKey;
    if (typeof locationKey !== "string" || !locationKeys.has(locationKey)) {
      throw new Error(
        `Demo hive ${key} references unknown locationKey ${JSON.stringify(locationKey)}`,
      );
    }
  }
}
