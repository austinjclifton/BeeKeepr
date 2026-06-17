"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const serviceModulePath = path.join(
    backendRoot,
    "src/services/demoData.service.js",
);
const demoDataRepoModulePath = path.join(backendRoot, "src/db/demoData.db.js");
const usersRepoModulePath = path.join(backendRoot, "src/db/users.db.js");
const ingestRepoModulePath = path.join(backendRoot, "src/db/ingest.db.js");
const externalConditionsRepoModulePath = path.join(
    backendRoot,
    "src/db/externalConditions.db.js",
);
const alertsServiceModulePath = path.join(
    backendRoot,
    "src/services/alerts.service.js",
);
const locationsServiceModulePath = path.join(
    backendRoot,
    "src/services/locations.service.js",
);
const hivesServiceModulePath = path.join(
    backendRoot,
    "src/services/hives.service.js",
);
const devicesServiceModulePath = path.join(
    backendRoot,
    "src/services/devices.service.js",
);

function clearRequireCache() {
    delete require.cache[serviceModulePath];
    delete require.cache[demoDataRepoModulePath];
    delete require.cache[usersRepoModulePath];
    delete require.cache[ingestRepoModulePath];
    delete require.cache[externalConditionsRepoModulePath];
    delete require.cache[alertsServiceModulePath];
    delete require.cache[locationsServiceModulePath];
    delete require.cache[hivesServiceModulePath];
    delete require.cache[devicesServiceModulePath];
}

function loadDemoDataService(stubs) {
    clearRequireCache();

    require.cache[demoDataRepoModulePath] = {
        id: demoDataRepoModulePath,
        filename: demoDataRepoModulePath,
        loaded: true,
        exports: stubs.demoDataRepo,
    };
    require.cache[usersRepoModulePath] = {
        id: usersRepoModulePath,
        filename: usersRepoModulePath,
        loaded: true,
        exports: stubs.usersRepo,
    };
    require.cache[ingestRepoModulePath] = {
        id: ingestRepoModulePath,
        filename: ingestRepoModulePath,
        loaded: true,
        exports: stubs.ingestRepo,
    };
    require.cache[externalConditionsRepoModulePath] = {
        id: externalConditionsRepoModulePath,
        filename: externalConditionsRepoModulePath,
        loaded: true,
        exports: stubs.externalConditionsRepo,
    };
    require.cache[alertsServiceModulePath] = {
        id: alertsServiceModulePath,
        filename: alertsServiceModulePath,
        loaded: true,
        exports: stubs.alertsService,
    };
    require.cache[locationsServiceModulePath] = {
        id: locationsServiceModulePath,
        filename: locationsServiceModulePath,
        loaded: true,
        exports: stubs.locationsService,
    };
    require.cache[hivesServiceModulePath] = {
        id: hivesServiceModulePath,
        filename: hivesServiceModulePath,
        loaded: true,
        exports: stubs.hivesService,
    };
    require.cache[devicesServiceModulePath] = {
        id: devicesServiceModulePath,
        filename: devicesServiceModulePath,
        loaded: true,
        exports: stubs.devicesService,
    };

    return require(serviceModulePath);
}

function buildDemoStubs() {
    const state = {
        createdUsers: [],
        locationCalls: [],
        createdHives: [],
        updatedHives: [],
        createdDevices: [],
        touchedDevices: [],
        externalUpserts: [],
        readingInserts: [],
        alerts: [],
        pruneCalls: [],
        resetCalls: [],
    };

    const user = {
        id: 7,
        username: "demo",
        email: "demo@beekeepr.example",
    };
    const locations = new Map();
    const hives = [];
    const devicesByHive = new Map();

    const stubs = {
        demoDataRepo: {
            pruneStaleDemoData: async (input) => {
                state.pruneCalls.push(input);
                return {
                    deleted: {
                        alerts: 0,
                        readings: 0,
                        devices: 0,
                        hives: 0,
                        externalConditions: 0,
                        locations: 0,
                    },
                    staleHives: [],
                    deletedLocations: [],
                    prunableLocations: [],
                };
            },
            resetDemoRuntimeData: async (input) => {
                state.resetCalls.push(input);
                return {
                    deleted: {
                        alerts: 0,
                        readings: 0,
                        devices: 0,
                        hives: 0,
                        externalConditions: 0,
                        locations: 0,
                    },
                    resetLocations: [],
                    sharedLocationsSkipped: [],
                };
            },
        },
        usersRepo: {
            findByUsername: async () => state.createdUsers.length ? user : null,
            create: async (input) => {
                state.createdUsers.push(input);
                return user;
            },
            updatePasswordHash: async () => true,
            updateBeekeeperAlertSettings: async () => ({ ok: true }),
            findById: async () => user,
        },
        ingestRepo: {
            createReadingsDeduped10mBatch: async ({ readings }) => {
                for (const reading of readings) {
                    state.readingInserts.push(reading);
                }

                return readings.map((reading) => {
                    const inserted = reading.deviceId % 2 === 1;
                    return {
                        inserted,
                        reading: {
                            id: 1000 + reading.deviceId,
                            device_id: reading.deviceId,
                            bucket_at: reading.bucketAt,
                            temperature: reading.temperature,
                            rssi: reading.rssiDbm,
                        },
                    };
                });
            },
        },
        externalConditionsRepo: {
            createManyDeduped: async ({ conditions }) => {
                for (const condition of conditions) {
                    state.externalUpserts.push(condition);
                }

                return conditions.map((condition, index) => ({
                    inserted: true,
                    condition: {
                        id: state.externalUpserts.length + index,
                        location_id: condition.locationId,
                        bucket_at: condition.bucketAt,
                        ...condition,
                    },
                }));
            },
        },
        alertsService: {
            processReading: async (reading) => {
                state.alerts.push(reading);
            },
        },
        locationsService: {
            createOrGetLocation: async ({ name, lat, lon }) => {
                state.locationCalls.push({ name, lat, lon });
                const key = `${lat},${lon}`;
                if (!locations.has(key)) {
                    locations.set(key, { id: locations.size + 1, name, lat, lon });
                }
                return locations.get(key);
            },
        },
        hivesService: {
            listHives: async () => hives.slice(),
            createHive: async (input) => {
                const hive = { id: hives.length + 10, ...input };
                hives.push(hive);
                state.createdHives.push(input);
                return hive;
            },
            updateHive: async (input) => {
                state.updatedHives.push(input);
                const current = hives.find((hive) => hive.id === input.hiveId);
                const updated = { ...current, ...input, id: input.hiveId };
                const index = hives.findIndex((hive) => hive.id === input.hiveId);
                hives[index] = updated;
                return updated;
            },
        },
        devicesService: {
            listDevicesForHive: async ({ hiveId }) => devicesByHive.get(hiveId) || [],
            createDevice: async ({ hiveId, installedAt }) => {
                const device = { id: 200 + hiveId, hive_id: hiveId, installed_at: installedAt };
                devicesByHive.set(hiveId, [device]);
                state.createdDevices.push({ hiveId, installedAt });
                return device;
            },
            touchLastSeen: async ({ beekeeperId, deviceId, seenAt }) => {
                state.touchedDevices.push({ beekeeperId, deviceId, seenAt });
                return { id: deviceId, last_seen_at: seenAt };
            },
        },
    };

    return { stubs, state };
}

test("ensureDemoSeed creates the expected demo topology", async () => {
    const { stubs, state } = buildDemoStubs();
    const demoDataService = loadDemoDataService(stubs);

    const result = await demoDataService.ensureDemoSeed();

    assert.equal(result.beekeeper.username, "demo");
    assert.equal(result.locations.length, 2);
    assert.equal(result.hives.length, 5);
    assert.equal(state.createdUsers.length, 1);
    assert.equal(state.locationCalls.length, 2);
    assert.equal(state.createdHives.length, 5);
    assert.equal(state.createdDevices.length, 5);
    assert.deepEqual(
        result.hives.map((hive) => hive.locationKey),
        ["app", "app", "wny", "wny", "wny"],
    );
});

test("ensureDemoSeed prunes stale demo hives before rebuilding the configured topology", async () => {
    const { stubs, state } = buildDemoStubs();
    state.createdUsers.push({ username: "demo" });

    let existingHives = [
        {
            id: 41,
            name: "Blue Ridge Stable Hive",
            location_id: 8,
        },
    ];

    stubs.hivesService.listHives = async () => existingHives.slice();
    stubs.demoDataRepo.pruneStaleDemoData = async (input) => {
        state.pruneCalls.push(input);
        existingHives = [];
        return {
            deleted: {
                alerts: 1,
                readings: 1,
                devices: 1,
                hives: 1,
                externalConditions: 1,
                locations: 1,
            },
            staleHives: [
                { hiveId: 41, name: "Blue Ridge Stable Hive", locationId: 8 },
            ],
            deletedLocations: [
                { locationId: 8, name: "Blue Ridge Appalachia Demo Yard" },
            ],
            prunableLocations: [],
        };
    };

    const demoDataService = loadDemoDataService(stubs);
    const result = await demoDataService.ensureDemoSeed();

    assert.equal(state.pruneCalls.length, 1);
    assert.deepEqual(state.pruneCalls[0].configuredHiveNames, [
        "Blue Ridge Stable Hive",
        "Pisgah Orchard Hive",
        "Lake Erie Stable Hive",
        "Niagara Snowbelt Hive",
        "Finger Lakes Variable Hive",
    ]);
    assert.equal(result.hives.length, 5);
    assert.equal(result.hives.some((hive) => hive.name === "Yolo Stable Hive"), false);
});

test("runDemoTick upserts the configured demo locations and inserts one current 10-minute bucket", async () => {
    const { stubs, state } = buildDemoStubs();
    const demoDataService = loadDemoDataService(stubs);

    const result = await demoDataService.runDemoTick({
        now: new Date("2026-05-11T16:24:00.000Z"),
    });

    assert.equal(result.bucketAt, "2026-05-11T16:20:00.000Z");
    assert.equal(result.externalConditionsUpserted, 2);
    assert.equal(state.externalUpserts.length, 2);
    assert.equal(state.readingInserts.length, 5);
    assert.equal(state.touchedDevices.length, 5);
    assert.equal(result.readingsInserted, 2);
    assert.equal(result.readingsSkipped, 3);
    assert.equal(state.alerts.length, 0);

    const locationKeys = state.externalUpserts.map((entry) => entry.locationKey).sort();
    assert.deepEqual(locationKeys, ["app", "wny"]);
    assert.ok(state.readingInserts.every((entry) => entry.temperature >= 92));
    assert.ok(state.readingInserts.every((entry) => entry.temperature <= 98));
});

test("runDemoBackfill generates a bounded historical range without alerts by default", async () => {
    const { stubs, state } = buildDemoStubs();
    const demoDataService = loadDemoDataService(stubs);

    const result = await demoDataService.runDemoBackfill({
        start: "2026-05-10T00:00:00.000Z",
        end: "2026-05-10T00:10:00.000Z",
        now: new Date("2026-05-11T16:24:00.000Z"),
    });

    assert.equal(result.startAt, "2026-05-10T00:00:00.000Z");
    assert.equal(result.endAt, "2026-05-10T00:10:00.000Z");
    assert.equal(result.buckets, 2);
    assert.equal(result.tables.external_condition.inserted, 4);
    assert.equal(result.tables.reading.inserted, 4);
    assert.equal(result.tables.reading.skipped, 6);
    assert.equal(result.tables.alert.created, 0);
    assert.equal(state.externalUpserts.length, 4);
    assert.equal(state.readingInserts.length, 10);
    assert.equal(state.touchedDevices.length, 5);
});

test("runDemoBackfill keeps deterministic smooth temperature progression with centesimal precision", async () => {
    const { stubs, state } = buildDemoStubs();
    const demoDataService = loadDemoDataService(stubs);

    await demoDataService.runDemoBackfill({
        start: "2026-05-10T00:00:00.000Z",
        end: "2026-05-10T06:00:00.000Z",
        now: new Date("2026-05-11T16:24:00.000Z"),
    });

    const series = state.readingInserts
        .filter((entry) => entry.hiveKey === "wny-01")
        .map((entry) => entry.temperature);

    assert.ok(series.length > 10);

    let hasCentesimalValue = false;
    let longestRun = 1;
    let currentRun = 1;

    for (let index = 0; index < series.length; index += 1) {
        const value = series[index];
        const hundredths = Math.round(value * 100);

        if (Math.abs(value * 100 - hundredths) <= 1e-9 && hundredths % 10 !== 0) {
            hasCentesimalValue = true;
        }

        if (index === 0) continue;

        if (Object.is(series[index - 1], value)) {
            currentRun += 1;
            longestRun = Math.max(longestRun, currentRun);
        } else {
            currentRun = 1;
        }
    }

    assert.equal(hasCentesimalValue, true);
    assert.ok(longestRun <= 3);
});

test("pruneStaleDemoData passes the five-hive config into the scoped prune operation", async () => {
    const { stubs, state } = buildDemoStubs();
    stubs.demoDataRepo.pruneStaleDemoData = async (input) => {
        state.pruneCalls.push(input);
        return {
            deleted: {
                alerts: 4,
                readings: 9,
                devices: 2,
                hives: 2,
                externalConditions: 6,
                locations: 1,
            },
            staleHives: [
                { hiveId: 21, name: "Blue Ridge Stable Hive", locationId: 31 },
                { hiveId: 22, name: "Pisgah Orchard Hive", locationId: 31 },
            ],
            deletedLocations: [
                { locationId: 31, name: "Blue Ridge Appalachia Demo Yard" },
            ],
            prunableLocations: [],
        };
    };
    const demoDataService = loadDemoDataService(stubs);
    state.createdUsers.push({ username: "demo" });

    const result = await demoDataService.pruneStaleDemoData();

    assert.equal(state.pruneCalls.length, 1);
    assert.equal(state.pruneCalls[0].beekeeperId, 7);
    assert.equal(state.pruneCalls[0].provider, "demo-simulator");
    assert.equal(state.pruneCalls[0].removeUnusedLocations, true);
    assert.deepEqual(
        state.pruneCalls[0].configuredHiveNames,
        [
            "Blue Ridge Stable Hive",
            "Pisgah Orchard Hive",
            "Lake Erie Stable Hive",
            "Niagara Snowbelt Hive",
            "Finger Lakes Variable Hive",
        ],
    );
    assert.deepEqual(
        state.pruneCalls[0].configuredLocations.map((location) => location.key),
        ["app", "wny"],
    );
    assert.equal(result.beekeeper.username, "demo");
    assert.equal(result.deleted.hives, 2);
    assert.equal(result.deleted.locations, 1);
    assert.deepEqual(
        result.staleHives.map((hive) => hive.name),
        ["Blue Ridge Stable Hive", "Pisgah Orchard Hive"],
    );
});

test("resetDemoRuntimeData passes the configured demo yards into the runtime reset operation", async () => {
    const { stubs, state } = buildDemoStubs();
    stubs.demoDataRepo.resetDemoRuntimeData = async (input) => {
        state.resetCalls.push(input);
        return {
            deleted: {
                alerts: 3,
                readings: 5,
                devices: 0,
                hives: 0,
                externalConditions: 4,
                locations: 0,
            },
            resetLocations: [
                { locationId: 1, name: "Blue Ridge Appalachia Demo Yard" },
                { locationId: 2, name: "Western New York Demo Yard" },
            ],
            sharedLocationsSkipped: [],
        };
    };
    const demoDataService = loadDemoDataService(stubs);
    state.createdUsers.push({ username: "demo" });

    const result = await demoDataService.resetDemoRuntimeData();

    assert.equal(state.resetCalls.length, 1);
    assert.equal(state.resetCalls[0].beekeeperId, 7);
    assert.equal(state.resetCalls[0].provider, "demo-simulator");
    assert.deepEqual(
        state.resetCalls[0].configuredLocations.map((location) => location.key),
        ["app", "wny"],
    );
    assert.equal(result.deleted.readings, 5);
    assert.equal(result.deleted.externalConditions, 4);
    assert.equal(result.resetLocations.length, 2);
});
