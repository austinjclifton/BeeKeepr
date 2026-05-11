"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const servicePath = path.join(backendRoot, "src/services/alerts.service.js");
const alertsRepoPath = path.join(backendRoot, "src/db/alerts.db.js");
const devicesRepoPath = path.join(backendRoot, "src/db/devices.db.js");
const resendClientPath = path.join(backendRoot, "src/utils/resendClient.js");

function clearRequireCache() {
  delete require.cache[servicePath];
  delete require.cache[alertsRepoPath];
  delete require.cache[devicesRepoPath];
  delete require.cache[resendClientPath];
}

function buildService({ alertsRepoStubs, devicesRepoStubs, resendSendImpl }) {
  clearRequireCache();

  require.cache[alertsRepoPath] = {
    id: alertsRepoPath,
    filename: alertsRepoPath,
    loaded: true,
    exports: alertsRepoStubs,
  };

  require.cache[devicesRepoPath] = {
    id: devicesRepoPath,
    filename: devicesRepoPath,
    loaded: true,
    exports: devicesRepoStubs,
  };

  require.cache[resendClientPath] = {
    id: resendClientPath,
    filename: resendClientPath,
    loaded: true,
    exports: {
      emails: {
        send: resendSendImpl,
      },
    },
  };

  return require(servicePath);
}

function baseAlertsRepo() {
  return {
    insertAlert: async () => ({ id: 1, severity: "warning" }),
    markEmailSent: async () => {},
    markEmailFailed: async () => {},
    listAlertsByBeekeeper: async () => [],
    findByIdScoped: async () => null,
    markResolved: async () => ({ id: 1, resolved: true, severity: "warning" }),
  };
}

function baseDevicesRepo() {
  return {
    getAlertContextForDevice: async () => ({
      device_id: 5,
      hive_id: 6,
      beekeeper_id: 7,
      email: "u@example.com",
      alerts_enabled: true,
      warning_low_threshold: 40,
      warning_high_threshold: 90,
      critical_low_threshold: 30,
      critical_high_threshold: 100,
    }),
  };
}

test("processReading no-ops when reading is missing device_id", async () => {
  let inserted = false;
  const repo = baseAlertsRepo();
  repo.insertAlert = async () => {
    inserted = true;
  };

  const svc = buildService({
    alertsRepoStubs: repo,
    devicesRepoStubs: baseDevicesRepo(),
    resendSendImpl: async () => {},
  });

  await svc.processReading({ id: 1, temperature: 85 });
  assert.equal(inserted, false);
});

test("processReading warning creates alert without email", async () => {
  let emailSent = false;
  const calls = [];
  const repo = baseAlertsRepo();
  repo.insertAlert = async (input) => {
    calls.push(input);
    return { id: 11 };
  };

  const svc = buildService({
    alertsRepoStubs: repo,
    devicesRepoStubs: baseDevicesRepo(),
    resendSendImpl: async () => {
      emailSent = true;
    },
  });

  await svc.processReading({ id: 99, device_id: 5, temperature: 91 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].severity, "warning");
  assert.equal(emailSent, false);
});

test("processReading critical sends email and marks email_sent", async () => {
  const calls = [];
  const repo = baseAlertsRepo();
  repo.insertAlert = async (input) => ({ id: 22, ...input });
  repo.markEmailSent = async ({ alertId }) => {
    calls.push(alertId);
  };

  let toAddress = null;
  const svc = buildService({
    alertsRepoStubs: repo,
    devicesRepoStubs: baseDevicesRepo(),
    resendSendImpl: async ({ to }) => {
      toAddress = to;
    },
  });

  await svc.processReading({ id: 10, device_id: 5, temperature: 105 });

  assert.equal(toAddress, "u@example.com");
  assert.deepEqual(calls, [22]);
});

test("processReading marks email failed when provider throws", async () => {
  const calls = [];
  const repo = baseAlertsRepo();
  repo.insertAlert = async () => ({ id: 31 });
  repo.markEmailFailed = async ({ alertId, message }) => {
    calls.push({ alertId, message });
  };

  const svc = buildService({
    alertsRepoStubs: repo,
    devicesRepoStubs: baseDevicesRepo(),
    resendSendImpl: async () => {
      throw new Error("smtp failed");
    },
  });

  await svc.processReading({ id: 10, device_id: 5, temperature: 105 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].alertId, 31);
  assert.equal(calls[0].message, "smtp failed");
});

test("resolveAlert rejects missing alert", async () => {
  const svc = buildService({
    alertsRepoStubs: baseAlertsRepo(),
    devicesRepoStubs: baseDevicesRepo(),
    resendSendImpl: async () => {},
  });

  await assert.rejects(
    () => svc.resolveAlert({ beekeeperId: 1, alertId: 2 }),
    (err) => err.status === 404 && err.message === "Alert not found",
  );
});

test("resolveAlert resolves warning alerts", async () => {
  const repo = baseAlertsRepo();
  repo.findByIdScoped = async () => ({
    id: 2,
    severity: "warning",
    resolved: false,
  });
  let resolvedAlertId = null;
  repo.markResolved = async ({ alertId }) => {
    resolvedAlertId = alertId;
    return {
      id: alertId,
      severity: "warning",
      resolved: true,
      resolved_at: "2026-05-10T12:00:00.000Z",
    };
  };

  const svc = buildService({
    alertsRepoStubs: repo,
    devicesRepoStubs: baseDevicesRepo(),
    resendSendImpl: async () => {},
  });

  const result = await svc.resolveAlert({ beekeeperId: 1, alertId: 2 });

  assert.equal(resolvedAlertId, 2);
  assert.equal(result.resolved, true);
  assert.equal(result.resolved_at, "2026-05-10T12:00:00.000Z");
});

test("resolveAlert rejects critical alerts", async () => {
  const repo = baseAlertsRepo();
  repo.findByIdScoped = async () => ({
    id: 3,
    severity: "critical",
    resolved: false,
  });

  const svc = buildService({
    alertsRepoStubs: repo,
    devicesRepoStubs: baseDevicesRepo(),
    resendSendImpl: async () => {},
  });

  await assert.rejects(
    () => svc.resolveAlert({ beekeeperId: 1, alertId: 3 }),
    (err) =>
      err.status === 400 &&
      err.message === "Only warning alerts can be manually resolved",
  );
});
