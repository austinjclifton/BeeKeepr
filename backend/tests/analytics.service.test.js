"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const servicePath = path.join(backendRoot, "src/services/analytics.service.js");
const analyticsRepoPath = path.join(backendRoot, "src/db/analytics.db.js");
const hivesRepoPath = path.join(backendRoot, "src/db/hives.db.js");
const locationsRepoPath = path.join(backendRoot, "src/db/locations.db.js");
const analyticsExportRepoPath = path.join(
  backendRoot,
  "src/db/analyticsExport.db.js",
);

function clearRequireCache() {
  delete require.cache[servicePath];
  delete require.cache[analyticsRepoPath];
  delete require.cache[hivesRepoPath];
  delete require.cache[locationsRepoPath];
  delete require.cache[analyticsExportRepoPath];
}

function buildService({
  repoStubs,
  hivesRepoStubs = baseHivesRepo(),
  locationsRepoStubs = baseLocationsRepo(),
  exportRepoStubs = baseExportRepo(),
}) {
  clearRequireCache();

  require.cache[analyticsRepoPath] = {
    id: analyticsRepoPath,
    filename: analyticsRepoPath,
    loaded: true,
    exports: repoStubs,
  };

  require.cache[hivesRepoPath] = {
    id: hivesRepoPath,
    filename: hivesRepoPath,
    loaded: true,
    exports: hivesRepoStubs,
  };

  require.cache[locationsRepoPath] = {
    id: locationsRepoPath,
    filename: locationsRepoPath,
    loaded: true,
    exports: locationsRepoStubs,
  };

  require.cache[analyticsExportRepoPath] = {
    id: analyticsExportRepoPath,
    filename: analyticsExportRepoPath,
    loaded: true,
    exports: exportRepoStubs,
  };

  return require(servicePath);
}

function baseRepo() {
  return {
    getLatestReadingForHive: async ({ hiveId }) => ({
      hive_id: hiveId,
      id: 9,
      device_id: 3,
      temperature: 94.2,
      rssi: -70,
      bucket_at: "2026-05-07T20:40:00.000Z",
      received_at: "2026-05-07T20:40:03.000Z",
      created_at: "2026-05-07T20:40:03.000Z",
    }),
    getHiveReadingsSince: async () => [],
    getHiveStatusRows: async () => [],
    getHiveSummaryRow: async ({ hiveId }) => ({
      hive_id: hiveId,
      reading_count: 12,
      average_temperature: 94.2,
      min_temperature: 88.7,
      max_temperature: 101.4,
      temperature_swing: 12.7,
      warning_count: 6,
      critical_count: 2,
      latest_temperature: 94.8,
      latest_reading_at: "2026-05-07T20:40:00.000Z",
    }),
    getHiveTemperatureSeries: async () => [],
    getCompareTemperatureSeries: async () => [],
    getLocationExternalTemperatureSeries: async () => [],
    getDashboardHiveTemperature24h: async () => [],
    getDashboardFleetTemperature24h: async () => [],
  };
}

function baseHivesRepo() {
  return {
    findByIdScoped: async () => ({ id: 1, name: "North Hive" }),
    findByIdsScoped: async ({ hiveIds }) =>
      hiveIds.map((id) => ({ id, name: `Hive ${id}` })),
    listOwnedForScope: async () => [],
  };
}

function baseLocationsRepo() {
  return {
    listOwnedByBeekeeper: async () => [],
  };
}

function baseExportRepo() {
  return {
    listHiveScope: async () => [
      {
        hive_id: 1,
        hive_name: "North Hive",
        hive_status: "active",
        device_id: 4,
        location_id: 9,
        location_name: "North Yard",
        warning_low_threshold: 92,
        warning_high_threshold: 99,
        critical_low_threshold: 88,
        critical_high_threshold: 104,
      },
    ],
    listReadingsBatch: async () => [],
    listExternalBatch: async () => [],
    listAlertsBatch: async () => [],
  };
}

test("getHiveSummary rejects invalid analytics range", async () => {
  const service = buildService({ repoStubs: baseRepo() });

  await assert.rejects(
    () =>
      service.getHiveSummary({
        beekeeperId: 1,
        hiveId: 2,
        range: "2w",
      }),
    (err) =>
      err.status === 400 &&
      err.message === "range must be one of 1d, 3d, 7d, or 1m",
  );
});

test("getHiveSummary scopes query to authenticated beekeeper and includes alert counts", async () => {
  let captured = null;
  const repo = baseRepo();
  repo.getHiveSummaryRow = async (input) => {
    captured = input;
    return baseRepo().getHiveSummaryRow(input);
  };

  const service = buildService({ repoStubs: repo });
  const result = await service.getHiveSummary({
    beekeeperId: 44,
    hiveId: 7,
    range: "7d",
  });

  assert.equal(captured.beekeeperId, 44);
  assert.equal(captured.hiveId, 7);
  assert.ok(captured.startAt instanceof Date);
  assert.equal(result.hiveId, 7);
  assert.equal(result.range, "7d");
  assert.equal(result.summary.warningCount, 6);
  assert.equal(result.summary.criticalCount, 2);
});

test("getHiveSummary rejects non-owned hive", async () => {
  const repo = baseRepo();
  repo.getHiveSummaryRow = async () => null;

  const service = buildService({ repoStubs: repo });

  await assert.rejects(
    () => service.getHiveSummary({ beekeeperId: 1, hiveId: 999, range: "1d" }),
    (err) => err.status === 404 && err.message === "Hive not found",
  );
});

test("getHiveTemperatureSeries returns bucketed data for an owned hive", async () => {
  let captured = null;
  const repo = baseRepo();
  repo.getHiveTemperatureSeries = async (input) => {
    captured = input;
    return [
      {
        bucket_at: "2026-05-07T14:00:00.000Z",
        average_temperature: 94.1,
        external_temperature: 67.8,
        min_temperature: 93.8,
        max_temperature: 94.6,
        reading_count: 6,
      },
    ];
  };

  const service = buildService({ repoStubs: repo });
  const result = await service.getHiveTemperatureSeries({
    beekeeperId: 2,
    hiveId: 5,
    range: "7d",
  });

  assert.equal(captured.beekeeperId, 2);
  assert.equal(captured.hiveId, 5);
  assert.equal(captured.bucketSize, "hour");
  assert.equal(result.series.length, 1);
  assert.equal(result.series[0].externalTemperature, 67.8);
  assert.equal(result.series[0].readingCount, 6);
});

test("getHiveTemperatureSeries supports custom start and end with backend bucket sizing", async () => {
  let captured = null;
  const repo = baseRepo();
  repo.getHiveTemperatureSeries = async (input) => {
    captured = input;
    return [];
  };

  const service = buildService({ repoStubs: repo });
  const result = await service.getHiveTemperatureSeries({
    beekeeperId: 2,
    hiveId: 5,
    start: "2026-05-01T00:00:00.000Z",
    end: "2026-05-04T00:00:00.000Z",
  });

  assert.equal(captured.bucketSize, "hour");
  assert.equal(captured.startAt.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(captured.endAt.toISOString(), "2026-05-04T00:00:00.000Z");
  assert.equal(result.range, "custom");
  assert.equal(result.mode, "custom");
});

test("custom analytics window validates start and end", async () => {
  const service = buildService({ repoStubs: baseRepo() });

  await assert.rejects(
    () =>
      service.getHiveSummary({
        beekeeperId: 1,
        hiveId: 2,
        start: "2026-05-04T00:00:00.000Z",
        end: "2026-05-01T00:00:00.000Z",
      }),
    (err) => err.status === 400 && err.message === "start must be before end",
  );

  await assert.rejects(
    () =>
      service.getHiveSummary({
        beekeeperId: 1,
        hiveId: 2,
        range: "7d",
        start: "2026-05-01T00:00:00.000Z",
        end: "2026-05-04T00:00:00.000Z",
      }),
    (err) =>
      err.status === 400 &&
      err.message === "Provide either range or start/end, not both",
  );
});

test("getHiveReadingsSince validates and maps hive history", async () => {
  let captured = null;
  const repo = baseRepo();
  repo.getHiveReadingsSince = async (input) => {
    captured = input;
    return [
      {
        id: 11,
        device_id: 3,
        temperature: 94.2,
        rssi: -70,
        bucket_at: "2026-05-07T20:40:00.000Z",
        received_at: "2026-05-07T20:40:03.000Z",
        created_at: "2026-05-07T20:40:03.000Z",
      },
    ];
  };

  const service = buildService({ repoStubs: repo });
  const result = await service.getHiveReadingsSince({
    beekeeperId: 3,
    hiveId: 7,
    since: "2026-05-01T00:00:00.000Z",
    until: "2026-05-02T00:00:00.000Z",
    limit: "10",
    order: "desc",
  });

  assert.equal(captured.beekeeperId, 3);
  assert.equal(captured.hiveId, 7);
  assert.equal(captured.order, "desc");
  assert.equal(captured.limit, 10);
  assert.ok(captured.since instanceof Date);
  assert.equal(result.hiveId, 7);
  assert.equal(result.readings[0].deviceId, 3);
  assert.equal(result.readings[0].createdAt, "2026-05-07T20:40:03.000Z");
});

test("compareHives validates hiveIds", async () => {
  const service = buildService({ repoStubs: baseRepo() });

  await assert.rejects(
    () => service.compareHives({ beekeeperId: 1, range: "1d", hiveIds: "" }),
    (err) => err.status === 400 && err.message === "hiveIds is required",
  );

  await assert.rejects(
    () =>
      service.compareHives({
        beekeeperId: 1,
        range: "1d",
        hiveIds: "1,bad",
      }),
    (err) =>
      err.status === 400 &&
      err.message === "hiveIds must be comma-separated positive integers",
  );
});

test("compareHives rejects unauthorized hives", async () => {
  const hivesRepo = baseHivesRepo();
  hivesRepo.findByIdsScoped = async () => [{ id: 1, name: "Owned" }];

  const service = buildService({
    repoStubs: baseRepo(),
    hivesRepoStubs: hivesRepo,
  });

  await assert.rejects(
    () =>
      service.compareHives({
        beekeeperId: 1,
        range: "3d",
        hiveIds: "1,2",
      }),
    (err) =>
      err.status === 404 && err.message === "One or more hives not found",
  );
});

test("compareHives includes location external temperature when a location filter is selected", async () => {
  let compareCaptured = null;
  let externalCaptured = null;
  const repo = baseRepo();
  const locationsRepo = baseLocationsRepo();
  locationsRepo.listOwnedByBeekeeper = async () => [{ id: 4, name: 'North Yard' }];
  repo.getCompareTemperatureSeries = async (input) => {
    compareCaptured = input;
    return [
      {
        hive_id: 1,
        bucket_at: "2026-05-07T14:00:00.000Z",
        average_temperature: 94.1,
        min_temperature: 93.8,
        max_temperature: 94.6,
        reading_count: 6,
      },
      {
        hive_id: 2,
        bucket_at: "2026-05-07T14:00:00.000Z",
        average_temperature: 95.4,
        min_temperature: 95.1,
        max_temperature: 95.9,
        reading_count: 6,
      },
    ];
  };
  repo.getLocationExternalTemperatureSeries = async (input) => {
    externalCaptured = input;
    return [
      {
        bucket_at: "2026-05-07T14:00:00.000Z",
        external_temperature: 68.2,
      },
    ];
  };

  const service = buildService({ repoStubs: repo, locationsRepoStubs: locationsRepo });
  const result = await service.compareHives({
    beekeeperId: 1,
    range: "7d",
    bucket: "hour",
    hiveIds: "1,2",
    locationId: "4",
  });

  assert.equal(compareCaptured.locationId, 4);
  assert.equal(externalCaptured.locationId, 4);
  assert.equal(result.locationId, 4);
  assert.equal(result.externalSeries.length, 1);
  assert.equal(result.externalSeries[0].temperature, 68.2);
  assert.equal(result.externalSeries[0].externalTemperature, 68.2);
});

test("compareHives returns location external temperature without selected hives when a location filter is selected", async () => {
  let externalCaptured = null;
  const repo = baseRepo();
  const locationsRepo = baseLocationsRepo();
  locationsRepo.listOwnedByBeekeeper = async () => [{ id: 4, name: 'North Yard' }];
  repo.getLocationExternalTemperatureSeries = async (input) => {
    externalCaptured = input;
    return [
      {
        bucket_at: "2026-05-07T14:00:00.000Z",
        external_temperature: 68.2,
      },
    ];
  };

  const service = buildService({ repoStubs: repo, locationsRepoStubs: locationsRepo });
  const result = await service.compareHives({
    beekeeperId: 1,
    range: "7d",
    bucket: "hour",
    locationId: "4",
  });

  assert.equal(externalCaptured.locationId, 4);
  assert.equal(result.locationId, 4);
  assert.equal(result.hives.length, 0);
  assert.equal(result.externalSeries.length, 1);
  assert.equal(result.externalSeries[0].temperature, 68.2);
});

test("getHivesStatus maps one item per owned hive with alert counts and health", async () => {
  const repo = baseRepo();
  repo.getHiveStatusRows = async () => [
    {
      id: 1,
      name: "North Hive",
      status: "active",
      location_name: "North Yard",
      latest_temperature: 105,
      latest_bucket_at: new Date(),
      reading_count: 10,
      average_temperature: 95,
      min_temperature: 90,
      max_temperature: 105,
      temperature_swing: 15,
      warning_count: 0,
      critical_count: 1,
      external_temperature: 62.5,
      external_humidity_pct: 55,
      external_wind_mps: 3.2,
      external_cloud_pct: 40,
      external_bucket_at: "2026-05-07T20:30:00.000Z",
      warning_low_threshold: 92,
      warning_high_threshold: 99,
      critical_low_threshold: 88,
      critical_high_threshold: 104,
    },
    {
      id: 2,
      name: "South Hive",
      status: "active",
      location_name: null,
      latest_temperature: null,
      latest_bucket_at: null,
      reading_count: 0,
      average_temperature: null,
      min_temperature: null,
      max_temperature: null,
      temperature_swing: null,
      warning_count: 0,
      critical_count: 0,
      external_temperature: null,
      external_humidity_pct: null,
      external_wind_mps: null,
      external_cloud_pct: null,
      external_bucket_at: null,
      warning_low_threshold: null,
      warning_high_threshold: null,
      critical_low_threshold: null,
      critical_high_threshold: null,
    },
  ];

  const service = buildService({ repoStubs: repo });
  const result = await service.getHivesStatus({
    beekeeperId: 1,
    range: "1d",
  });

  assert.equal(result.hives.length, 2);
  assert.equal(result.hives[0].criticalCount, 1);
  assert.equal(result.hives[0].healthStatus, "critical");
  assert.equal(result.hives[0].externalTemperature, 62.5);
  assert.equal(result.hives[0].externalConditionAt, "2026-05-07T20:30:00.000Z");
  assert.equal(result.hives[1].healthStatus, "offline");
});

test("getHivesStatus marks stale latest readings offline", async () => {
  const repo = baseRepo();
  repo.getHiveStatusRows = async () => [
    {
      id: 1,
      name: "Stale Hive",
      status: "active",
      location_name: "North Yard",
      latest_temperature: 94,
      latest_bucket_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      reading_count: 10,
      average_temperature: 94,
      min_temperature: 93,
      max_temperature: 95,
      temperature_swing: 2,
      warning_count: 0,
      critical_count: 0,
      warning_low_threshold: 92,
      warning_high_threshold: 99,
      critical_low_threshold: 88,
      critical_high_threshold: 104,
    },
  ];

  const service = buildService({ repoStubs: repo });
  const result = await service.getHivesStatus({
    beekeeperId: 1,
    range: "1d",
  });

  assert.equal(result.hives[0].healthStatus, "offline");
});

test("getLatestHiveReading returns null reading for owned hive without data", async () => {
  const repo = baseRepo();
  repo.getLatestReadingForHive = async () => ({
    hive_id: 3,
    id: null,
  });

  const service = buildService({ repoStubs: repo });
  const result = await service.getLatestHiveReading({
    beekeeperId: 1,
    hiveId: 3,
  });

  assert.deepEqual(result, { hiveId: 3, reading: null });
});

test("getHivesStatus applies location filter", async () => {
  let captured = null;
  const repo = baseRepo();
  repo.getHiveStatusRows = async (input) => {
    captured = input;
    return [];
  };

  const service = buildService({ repoStubs: repo });
  const result = await service.getHivesStatus({
    beekeeperId: 1,
    range: "7d",
    bucket: "hour",
    locationId: "4",
  });

  assert.equal(captured.locationId, 4);
  assert.equal(result.locationId, 4);
  assert.equal(result.bucketSize, "hour");
});

test("getHiveTemperatureSeries rejects unsafe bucket requests", async () => {
  const service = buildService({ repoStubs: baseRepo() });

  await assert.rejects(
    () =>
      service.getHiveTemperatureSeries({
        beekeeperId: 1,
        hiveId: 2,
        range: "1m",
        bucket: "10m",
      }),
    (err) =>
      err.status === 400 &&
      err.message ===
      "bucket 10m is too small for this range; choose a larger bucket",
  );
});

test("getDashboardHiveTemperature24h maps selected hive internal and outside points", async () => {
  const repo = baseRepo();
  repo.getDashboardHiveTemperature24h = async () => [
    {
      hive_id: 5,
      name: "North Hive",
      location_id: 9,
      location_name: "North Yard",
      bucket_at: "2026-05-10T12:00:00.000Z",
      reading_id: 11,
      internal_temperature: 94.2,
      rssi: -66,
      received_at: "2026-05-10T12:00:03.000Z",
      external_condition_id: 20,
      outside_temperature: 65.4,
      humidity_pct: 55,
      wind_mps: 2.1,
      pressure_hpa: 1016,
      cloud_pct: 20,
      external_status: "success",
    },
  ];

  const service = buildService({ repoStubs: repo });
  const result = await service.getDashboardHiveTemperature24h({
    beekeeperId: 1,
    hiveId: 5,
  });

  assert.equal(result.hive.hiveId, 5);
  assert.equal(result.bucketSize, "10m");
  assert.equal(result.points[0].internalTemperature, 94.2);
  assert.equal(result.points[0].outsideTemperature, 65.4);
});

test("getDashboardFleetTemperature24h returns one 10-minute series per hive", async () => {
  const repo = baseRepo();
  const hivesRepo = baseHivesRepo();
  hivesRepo.listOwnedForScope = async ({ locationId }) => [
    { id: 1, name: "North Hive", location_id: locationId },
    { id: 2, name: "South Hive", location_id: locationId },
  ];
  repo.getDashboardFleetTemperature24h = async () => [
    { hive_id: 1, bucket_at: "2026-05-10T12:00:00.000Z", temperature: 94 },
    { hive_id: 2, bucket_at: "2026-05-10T12:00:00.000Z", temperature: 96 },
  ];

  const service = buildService({
    repoStubs: repo,
    hivesRepoStubs: hivesRepo,
  });
  const result = await service.getDashboardFleetTemperature24h({
    beekeeperId: 1,
    locationId: 4,
  });

  assert.equal(result.locationId, 4);
  assert.equal(result.bucketSize, "10m");
  assert.equal(result.hives.length, 2);
  assert.equal(result.hives[0].series[0].averageTemperature, 94);
});

test("compareHives enforces selected location ownership", async () => {
  let captured = null;
  const hivesRepo = baseHivesRepo();
  const locationsRepo = baseLocationsRepo();
  locationsRepo.listOwnedByBeekeeper = async () => [{ id: 4, name: 'North Yard' }];
  hivesRepo.findByIdsScoped = async (input) => {
    captured = input;
    return input.hiveIds.map((id) => ({ id, name: `Hive ${id}` }));
  };

  const service = buildService({
    repoStubs: baseRepo(),
    hivesRepoStubs: hivesRepo,
    locationsRepoStubs: locationsRepo,
  });
  const result = await service.compareHives({
    beekeeperId: 1,
    range: "7d",
    bucket: "hour",
    hiveIds: "1,2",
    locationId: "4",
  });

  assert.equal(captured.locationId, 4);
  assert.equal(result.locationId, 4);
});

test("prepareCsvExport streams scoped hive/device rows", async () => {
  const chunks = [];
  const writable = {
    write(chunk) {
      chunks.push(chunk);
      return true;
    },
  };

  const service = buildService({ repoStubs: baseRepo() });
  const csvExport = await service.prepareCsvExport({
    beekeeperId: 1,
    scope: "location",
    locationId: 9,
    includeReadings: false,
    includeExternal: false,
    includeHiveDevice: true,
    includeAlerts: false,
  });

  await csvExport.writeTo(writable);

  const output = chunks.join("");
  assert.match(csvExport.filename, /beekeepr-location-export-all-data\.csv/);
  assert.match(output, /record_type,hive_id,hive_name/);
  assert.match(output, /hive_device,1,North Hive/);
});
