"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const serviceModulePath = path.join(
    backendRoot,
    "src/services/demoData.service.js",
);
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
            createReadingDeduped10m: async ({ deviceId, bucketAt, temperature, rssiDbm }) => {
                state.readingInserts.push({ deviceId, bucketAt, temperature, rssiDbm });

                const inserted = deviceId % 2 === 1;
                return {
                    inserted,
                    reading: inserted
                        ? {
                            id: 1000 + deviceId,
                            device_id: deviceId,
                            bucket_at: bucketAt,
                            temperature,
                            rssi: rssiDbm,
                        }
                        : null,
                };
            },
        },
        externalConditionsRepo: {
            upsert: async (input) => {
                state.externalUpserts.push(input);
                return { id: state.externalUpserts.length, ...input };
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
        ["roc", "roc", "roc", "atl", "atl"],
    );
});

test("runDemoTick upserts two locations and inserts one current 10-minute bucket", async () => {
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
    assert.equal(state.alerts.length, 2);

    const rochester = state.externalUpserts.find((entry) => entry.locationId === 1);
    const atlanta = state.externalUpserts.find((entry) => entry.locationId === 2);
    assert.ok(rochester.temperature < atlanta.temperature);
    assert.ok(state.readingInserts.every((entry) => entry.temperature >= 92));
    assert.ok(state.readingInserts.every((entry) => entry.temperature <= 98));
});