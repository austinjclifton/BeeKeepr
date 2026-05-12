"use strict";

const bcrypt = require("bcrypt");

const usersRepo = require("../db/users.db.js");
const ingestRepo = require("../db/ingest.db.js");
const externalConditionsRepo = require("../db/externalConditions.db.js");
const alertsService = require("./alerts.service.js");
const locationsService = require("./locations.service.js");
const hivesService = require("./hives.service.js");
const devicesService = require("./devices.service.js");

const BCRYPT_ROUNDS = 12;
const TEN_MIN_MS = 10 * 60 * 1000;
const DEFAULT_DEMO_PASSWORD = "replace-me";
const DEFAULT_DEMO_EMAIL = "demo@beekeepr.example";
const DEMO_PROVIDER = "demo-simulator";

const DEMO_THRESHOLDS = Object.freeze({
    alertsEnabled: true,
    warningLowThreshold: 92,
    warningHighThreshold: 98,
    criticalLowThreshold: 89,
    criticalHighThreshold: 101,
});

const DEMO_LOCATIONS = Object.freeze([
    {
        key: "roc",
        name: "Rochester, NY Demo Yard",
        cityName: "Rochester, NY",
        timeZone: "America/New_York",
        lat: 43.1566,
        lon: -77.6088,
        externalBaseTemp: 58.5,
        externalDailyAmp: 11.0,
        externalSeasonalAmp: 4.0,
        externalPeakHour: 15.5,
        humidityBase: 66,
        humidityAmp: 14,
        windBaseMps: 3.1,
        windAmpMps: 1.5,
        pressureBaseHpa: 1014.5,
    },
    {
        key: "atl",
        name: "Atlanta, GA Demo Yard",
        cityName: "Atlanta, GA",
        timeZone: "America/New_York",
        lat: 33.749,
        lon: -84.388,
        externalBaseTemp: 70.5,
        externalDailyAmp: 9.5,
        externalSeasonalAmp: 3.2,
        externalPeakHour: 16.0,
        humidityBase: 62,
        humidityAmp: 12,
        windBaseMps: 2.7,
        windAmpMps: 1.2,
        pressureBaseHpa: 1012.8,
    },
]);

const DEMO_HIVES = Object.freeze([
    {
        key: "roc-01",
        locationKey: "roc",
        name: "Highland Stable Hive",
        notes: "Rochester demo hive with a stable brood temperature profile",
        installedAt: "2026-04-01T13:00:00.000Z",
        deviceInstalledAt: "2026-04-01T13:00:00.000Z",
        internalBaseline: 95.0,
        internalDailyAmp: 0.35,
        internalSeasonalAmp: 0.28,
        externalSensitivity: 0.024,
        phaseShift: 0.0,
        rssiBase: -58,
        rssiAmp: 7,
    },
    {
        key: "roc-02",
        locationKey: "roc",
        name: "Genesee Production Hive",
        notes: "Rochester demo hive with a slightly warmer brood cluster",
        installedAt: "2026-04-01T13:15:00.000Z",
        deviceInstalledAt: "2026-04-01T13:15:00.000Z",
        internalBaseline: 95.6,
        internalDailyAmp: 0.42,
        internalSeasonalAmp: 0.34,
        externalSensitivity: 0.027,
        phaseShift: 0.8,
        rssiBase: -64,
        rssiAmp: 8,
    },
    {
        key: "roc-03",
        locationKey: "roc",
        name: "Cobbs Hill Cool Hive",
        notes: "Rochester demo hive with a slightly cooler overnight profile",
        installedAt: "2026-04-01T13:30:00.000Z",
        deviceInstalledAt: "2026-04-01T13:30:00.000Z",
        internalBaseline: 94.4,
        internalDailyAmp: 0.4,
        internalSeasonalAmp: 0.31,
        externalSensitivity: 0.03,
        phaseShift: 1.7,
        rssiBase: -71,
        rssiAmp: 9,
    },
    {
        key: "atl-01",
        locationKey: "atl",
        name: "Piedmont Warm Hive",
        notes: "Atlanta demo hive with slightly higher afternoon heat retention",
        installedAt: "2026-04-01T14:00:00.000Z",
        deviceInstalledAt: "2026-04-01T14:00:00.000Z",
        internalBaseline: 95.8,
        internalDailyAmp: 0.48,
        internalSeasonalAmp: 0.3,
        externalSensitivity: 0.034,
        phaseShift: 0.5,
        rssiBase: -61,
        rssiAmp: 7,
    },
    {
        key: "atl-02",
        locationKey: "atl",
        name: "Grant Park Variable Hive",
        notes: "Atlanta demo hive with a slightly wider daily temperature swing",
        installedAt: "2026-04-01T14:15:00.000Z",
        deviceInstalledAt: "2026-04-01T14:15:00.000Z",
        internalBaseline: 94.9,
        internalDailyAmp: 0.54,
        internalSeasonalAmp: 0.36,
        externalSensitivity: 0.032,
        phaseShift: 2.1,
        rssiBase: -68,
        rssiAmp: 8,
    },
]);

const localTimeFormatterCache = new Map();

exports.ensureDemoSeed = async function ensureDemoSeed() {
    const beekeeper = await ensureDemoBeekeeper();
    const beekeeperId = toEntityId(beekeeper.id, "beekeeperId");
    const locations = await ensureDemoLocations();
    const locationMap = new Map(locations.map((location) => [location.key, location]));

    const existingHives = await hivesService.listHives({ beekeeperId });
    const hiveMap = new Map(existingHives.map((hive) => [hive.name, hive]));
    const topology = [];

    for (const hiveConfig of DEMO_HIVES) {
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
            warningLowThreshold: DEMO_THRESHOLDS.warningLowThreshold,
            warningHighThreshold: DEMO_THRESHOLDS.warningHighThreshold,
            criticalLowThreshold: DEMO_THRESHOLDS.criticalLowThreshold,
            criticalHighThreshold: DEMO_THRESHOLDS.criticalHighThreshold,
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

exports.runDemoTick = async function runDemoTick({ now = new Date() } = {}) {
    const seed = await exports.ensureDemoSeed();
    const bucketAtDate = floorToTenMinutes(now instanceof Date ? now : new Date(now));
    const bucketAt = bucketAtDate.toISOString();
    const topology = await buildDemoTopology(seed);
    const locationSummaries = [];
    const locationState = new Map();

    for (const location of topology.locations) {
        const external = buildExternalCondition(location, bucketAtDate);
        const row = await externalConditionsRepo.upsert({
            locationId: location.locationId,
            bucketAt,
            provider: DEMO_PROVIDER,
            status: "success",
            temperature: external.temperature,
            humidityPct: external.humidityPct,
            precipMm: external.precipMm,
            windMps: external.windMps,
            windGustMps: external.windGustMps,
            pressureHpa: external.pressureHpa,
            cloudPct: external.cloudPct,
            rawJson: {
                source: DEMO_PROVIDER,
                cityName: location.cityName,
                bucketAt,
            },
        });

        locationState.set(location.key, {
            ...external,
            row,
        });

        locationSummaries.push({
            key: location.key,
            locationId: location.locationId,
            cityName: location.cityName,
            temperature: external.temperature,
        });
    }

    const hiveSummaries = [];
    let readingsInserted = 0;
    let readingsSkipped = 0;

    for (const hive of topology.hives) {
        const external = locationState.get(hive.location.key);
        const readingInput = buildReadingInput({
            hive,
            location: hive.location,
            bucketAtDate,
            externalTemperature: external.temperature,
        });

        const result = await ingestRepo.createReadingDeduped10m({
            deviceId: hive.deviceId,
            bucketAt,
            temperature: readingInput.temperature,
            rssiDbm: readingInput.rssi,
        });

        await devicesService.touchLastSeen({
            beekeeperId: hive.beekeeperId,
            deviceId: hive.deviceId,
            seenAt: bucketAt,
        });

        if (result.inserted && result.reading) {
            readingsInserted += 1;
            await alertsService.processReading(result.reading);
        } else {
            readingsSkipped += 1;
        }

        hiveSummaries.push({
            key: hive.key,
            hiveId: hive.hiveId,
            deviceId: hive.deviceId,
            locationKey: hive.location.key,
            temperature: readingInput.temperature,
            rssi: readingInput.rssi,
            inserted: result.inserted,
        });
    }

    return {
        bucketAt,
        beekeeper: seed.beekeeper,
        externalConditionsUpserted: locationSummaries.length,
        readingsInserted,
        readingsSkipped,
        locations: locationSummaries,
        hives: hiveSummaries,
    };
};

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
        alertsEnabled: DEMO_THRESHOLDS.alertsEnabled,
        warningLow: DEMO_THRESHOLDS.warningLowThreshold,
        warningHigh: DEMO_THRESHOLDS.warningHighThreshold,
        criticalLow: DEMO_THRESHOLDS.criticalLowThreshold,
        criticalHigh: DEMO_THRESHOLDS.criticalHighThreshold,
    });

    return (await usersRepo.findById({ id: beekeeperId })) || user;
}

async function ensureDemoLocations() {
    const ensured = [];

    for (const locationConfig of DEMO_LOCATIONS) {
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
    for (const location of DEMO_LOCATIONS) {
        const seededLocation = seed.locations.find((entry) => entry.key === location.key);
        locationsByKey.set(location.key, {
            ...location,
            locationId: toEntityId(seededLocation.locationId, "locationId"),
        });
    }

    return {
        locations: Array.from(locationsByKey.values()),
        hives: seed.hives.map((hive) => {
            const hiveConfig = DEMO_HIVES.find((entry) => entry.key === hive.key);

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

function buildExternalCondition(location, bucketAtDate) {
    const local = getLocalTimeParts(bucketAtDate, location.timeZone);
    const localHour = local.hour + local.minute / 60;
    const dailyWave = Math.cos((Math.PI * 2 * (localHour - location.externalPeakHour)) / 24);
    const seasonalWave = Math.sin((Math.PI * 2 * (local.dayOfYear - 120)) / 365);
    const cloudWave = Math.sin((Math.PI * 2 * (local.dayOfYear - 118)) / 9);

    const temperature = roundToOne(
        location.externalBaseTemp +
        location.externalDailyAmp * dailyWave +
        location.externalSeasonalAmp * seasonalWave,
    );
    const humidityPct = roundToOne(
        clamp(
            location.humidityBase - location.humidityAmp * dailyWave + 6 * cloudWave,
            28,
            96,
        ),
    );
    const windMps = roundToOne(
        clamp(
            location.windBaseMps +
            location.windAmpMps * ((1 - dailyWave) / 2) +
            0.35 * Math.sin((Math.PI * 2 * (localHour + 2)) / 12),
            0.4,
            11,
        ),
    );
    const windGustMps = roundToOne(clamp(windMps + 0.9 + Math.max(0, cloudWave), windMps, 14));
    const cloudPct = roundToOne(clamp(40 - 18 * dailyWave + 22 * cloudWave, 5, 96));
    const precipMm = cloudPct >= 84 ? roundToOne((cloudPct - 82) / 18) : 0;
    const pressureHpa = roundToOne(
        location.pressureBaseHpa + 2.6 * Math.cos((Math.PI * 2 * (local.dayOfYear - 116)) / 6),
    );

    return {
        temperature,
        humidityPct,
        precipMm,
        windMps,
        windGustMps,
        pressureHpa,
        cloudPct,
    };
}

function buildReadingInput({ hive, location, bucketAtDate, externalTemperature }) {
    const local = getLocalTimeParts(bucketAtDate, location.timeZone);
    const localHour = local.hour + local.minute / 60;
    const dailyWave = Math.cos((Math.PI * 2 * (localHour - 14 - hive.phaseShift)) / 24);
    const seasonalWave = Math.sin(
        (Math.PI * 2 * (local.dayOfYear - 120)) / 28 + hive.phaseShift,
    );
    const temperature = roundToOne(
        clamp(
            hive.internalBaseline +
            hive.internalDailyAmp * dailyWave +
            hive.internalSeasonalAmp * seasonalWave +
            hive.externalSensitivity * (externalTemperature - location.externalBaseTemp),
            92,
            98,
        ),
    );
    const signalWave = Math.sin((Math.PI * 2 * (localHour + hive.phaseShift)) / 24);
    const rssi = Math.round(clamp(hive.rssiBase - ((signalWave + 1) / 2) * hive.rssiAmp, -95, -45));

    return {
        temperature,
        rssi,
    };
}

function floorToTenMinutes(date) {
    return new Date(Math.floor(date.getTime() / TEN_MIN_MS) * TEN_MIN_MS);
}

function getLocalTimeParts(date, timeZone) {
    const formatter = getLocalTimeFormatter(timeZone);
    const values = Object.create(null);

    for (const part of formatter.formatToParts(date)) {
        if (part.type !== "literal") {
            values[part.type] = Number(part.value);
        }
    }

    return {
        year: values.year,
        month: values.month,
        day: values.day,
        hour: values.hour,
        minute: values.minute,
        dayOfYear: getDayOfYear(values.year, values.month, values.day),
    };
}

function getLocalTimeFormatter(timeZone) {
    if (!localTimeFormatterCache.has(timeZone)) {
        localTimeFormatterCache.set(
            timeZone,
            new Intl.DateTimeFormat("en-US", {
                timeZone,
                hour12: false,
                hourCycle: "h23",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            }),
        );
    }

    return localTimeFormatterCache.get(timeZone);
}

function getDayOfYear(year, month, day) {
    const start = Date.UTC(year, 0, 1);
    const current = Date.UTC(year, month - 1, day);
    return Math.floor((current - start) / 86400000) + 1;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function roundToOne(value) {
    return Math.round(value * 10) / 10;
}

function getDemoUsername() {
    return normalizeConfiguredValue(process.env.DEMO_ACCOUNT_USERNAME) || "demo";
}

function getDemoEmail() {
    return normalizeConfiguredValue(process.env.DEMO_ACCOUNT_EMAIL) || DEFAULT_DEMO_EMAIL;
}

function getDemoPassword() {
    return normalizeConfiguredValue(process.env.DEMO_ACCOUNT_PASSWORD) || DEFAULT_DEMO_PASSWORD;
}

function normalizeConfiguredValue(value) {
    if (typeof value !== "string") return null;

    const normalized = value.trim();
    return normalized || null;
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