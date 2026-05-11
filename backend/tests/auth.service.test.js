"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const servicePath = path.join(backendRoot, "src/services/auth.service.js");
const usersRepoPath = path.join(backendRoot, "src/db/users.db.js");
const sessionsServicePath = path.join(
  backendRoot,
  "src/services/sessions.service.js",
);
const bcryptPath = require.resolve("bcrypt");

function clearRequireCache() {
  delete require.cache[servicePath];
  delete require.cache[usersRepoPath];
  delete require.cache[sessionsServicePath];
  delete require.cache[bcryptPath];
}

function buildService({ usersRepoStubs, sessionsStubs, bcryptStubs }) {
  clearRequireCache();

  require.cache[usersRepoPath] = {
    id: usersRepoPath,
    filename: usersRepoPath,
    loaded: true,
    exports: usersRepoStubs,
  };

  require.cache[sessionsServicePath] = {
    id: sessionsServicePath,
    filename: sessionsServicePath,
    loaded: true,
    exports: sessionsStubs,
  };

  require.cache[bcryptPath] = {
    id: bcryptPath,
    filename: bcryptPath,
    loaded: true,
    exports: bcryptStubs,
  };

  return require(servicePath);
}

function baseUsersRepo() {
  return {
    findByEmail: async () => null,
    findByUsername: async () => null,
    findByLoginIdentifier: async () => null,
    create: async ({ username, email, passwordHash }) => ({
      id: 1,
      username,
      email,
      passwordHash,
    }),
    findByEmail: async () => null,
    findByUsername: async () => null,
    findById: async () => null,
    updatePasswordHash: async () => true,
    updateBeekeeperAlertSettings: async () => ({
      id: 1,
      alerts_enabled: true,
      warning_low_threshold: 90,
      warning_high_threshold: 100,
      critical_low_threshold: 85,
      critical_high_threshold: 105,
      updated_at: "2026-03-31T12:00:00.000Z",
    }),
    findById: async () => ({ id: 1, username: "u", email: "u@example.com" }),
    deleteBeekeeperById: async () => true,
  };
}

function baseSessions() {
  return {
    createSession: async () => ({ sessionToken: "s", csrfToken: "c" }),
    invalidateAllSessionsForUser: async () => { },
  };
}

function baseBcrypt() {
  return {
    hash: async (v) => `hash:${v}`,
    compare: async () => true,
  };
}

test("register rejects invalid username", async () => {
  const svc = buildService({
    usersRepoStubs: baseUsersRepo(),
    sessionsStubs: baseSessions(),
    bcryptStubs: baseBcrypt(),
  });

  await assert.rejects(
    () =>
      svc.register({
        username: "a",
        email: "a@b.com",
        password: "password123",
      }),
    (err) => err.status === 400 && /Username must be between/.test(err.message),
  );
});

test("register rejects duplicate email", async () => {
  const users = baseUsersRepo();
  users.findByEmail = async () => ({ id: 2 });

  const svc = buildService({
    usersRepoStubs: users,
    sessionsStubs: baseSessions(),
    bcryptStubs: baseBcrypt(),
  });

  await assert.rejects(
    () =>
      svc.register({
        username: "user1",
        email: "u@example.com",
        password: "password123",
      }),
    (err) => err.status === 409 && err.message === "Email already in use",
  );
});

test("register creates user and session", async () => {
  let created = null;
  let sessionInput = null;

  const users = baseUsersRepo();
  users.create = async (input) => {
    created = input;
    return { id: 8, username: input.username, email: input.email };
  };

  const sessions = baseSessions();
  sessions.createSession = async (input) => {
    sessionInput = input;
    return { sessionToken: "sess", csrfToken: "csrf" };
  };

  const svc = buildService({
    usersRepoStubs: users,
    sessionsStubs: sessions,
    bcryptStubs: baseBcrypt(),
  });

  const result = await svc.register({
    username: "  beek  ",
    email: "  beek@example.com ",
    password: "password123",
    context: { ip: "127.0.0.1" },
  });

  assert.deepEqual(created, {
    username: "beek",
    email: "beek@example.com",
    passwordHash: "hash:password123",
  });
  assert.deepEqual(sessionInput, {
    beekeeperId: 8,
    context: { ip: "127.0.0.1" },
  });
  assert.equal(result.user.id, 8);
});

test("login returns unauthorized on bad credentials", async () => {
  const users = baseUsersRepo();
  users.findByLoginIdentifier = async () => ({
    id: 3,
    username: "u",
    email: "u@e.com",
    password_hash: "h",
  });

  const bcrypt = baseBcrypt();
  bcrypt.compare = async () => false;

  const svc = buildService({
    usersRepoStubs: users,
    sessionsStubs: baseSessions(),
    bcryptStubs: bcrypt,
  });

  await assert.rejects(
    () => svc.login({ identifier: "u", password: "badpass123" }),
    (err) => err.status === 401 && err.message === "Invalid credentials",
  );
});

test("login resolves email lookup through DB-level identifier query", async () => {
  let lookup = null;
  let sessionInput = null;

  const users = baseUsersRepo();
  users.findByLoginIdentifier = async (input) => {
    lookup = input;
    return {
      id: 7,
      username: "beek",
      email: "beek@example.com",
      password_hash: "hash:secretpass",
    };
  };

  const sessions = baseSessions();
  sessions.createSession = async (input) => {
    sessionInput = input;
    return { sessionToken: "sess", csrfToken: "csrf" };
  };

  const svc = buildService({
    usersRepoStubs: users,
    sessionsStubs: sessions,
    bcryptStubs: baseBcrypt(),
  });

  const result = await svc.login({
    identifier: "  Beek@Example.com ",
    password: "secretpass",
    context: { ip: "127.0.0.1" },
  });

  assert.deepEqual(lookup, {
    identifier: "Beek@Example.com",
    email: "beek@example.com",
  });
  assert.deepEqual(sessionInput, {
    beekeeperId: 7,
    context: { ip: "127.0.0.1" },
  });
  assert.equal(result.user.email, "beek@example.com");
});

test("changePassword rejects when new matches current", async () => {
  const svc = buildService({
    usersRepoStubs: baseUsersRepo(),
    sessionsStubs: baseSessions(),
    bcryptStubs: baseBcrypt(),
  });

  await assert.rejects(
    () =>
      svc.changePassword({
        userId: 1,
        currentPassword: "samepass",
        newPassword: "samepass",
      }),
    (err) =>
      err.status === 400 &&
      err.message === "New password must be different from current password",
  );
});

test("changePassword rejects bad current password", async () => {
  const users = baseUsersRepo();
  users.findById = async () => ({
    id: 1,
    username: "u",
    email: "u@example.com",
    password_hash: "hash:oldpass123",
  });

  const bcrypt = baseBcrypt();
  bcrypt.compare = async () => false;

  const svc = buildService({
    usersRepoStubs: users,
    sessionsStubs: baseSessions(),
    bcryptStubs: bcrypt,
  });

  await assert.rejects(
    () =>
      svc.changePassword({
        userId: 1,
        currentPassword: "oldpass123",
        newPassword: "newpass123",
      }),
    (err) => err.status === 401 && err.message === "Current password incorrect",
  );
});

test("changePassword verifies current password, hashes new password, and invalidates sessions", async () => {
  let passwordHashUpdate = null;
  let invalidated = null;
  const users = baseUsersRepo();
  users.findById = async () => ({
    id: 4,
    username: "u",
    email: "u@example.com",
    password_hash: "hash:oldpass123",
  });
  users.updatePasswordHash = async (input) => {
    passwordHashUpdate = input;
    return true;
  };

  const sessions = baseSessions();
  sessions.invalidateAllSessionsForUser = async (input) => {
    invalidated = input;
  };

  const bcrypt = baseBcrypt();
  const compares = [];
  bcrypt.compare = async (plain, hash) => {
    compares.push({ plain, hash });
    return plain === "oldpass123";
  };

  const svc = buildService({
    usersRepoStubs: users,
    sessionsStubs: sessions,
    bcryptStubs: bcrypt,
  });

  await svc.changePassword({
    userId: 4,
    currentPassword: "oldpass123",
    newPassword: "newpass123",
  });

  assert.deepEqual(compares, [{ plain: "oldpass123", hash: "hash:oldpass123" }]);
  assert.deepEqual(passwordHashUpdate, { id: 4, passwordHash: "hash:newpass123" });
  assert.deepEqual(invalidated, { beekeeperId: 4 });
});

test("deleteUserAndSessions forbids deleting another user", async () => {
  const svc = buildService({
    usersRepoStubs: baseUsersRepo(),
    sessionsStubs: baseSessions(),
    bcryptStubs: baseBcrypt(),
  });

  await assert.rejects(
    () => svc.deleteUserAndSessions({ userId: 2, requesterId: 1 }),
    (err) => err.status === 403 && err.message === "Cannot delete another user",
  );
});

test("updateBeekeeperAlertSettings rejects empty patch", async () => {
  const svc = buildService({
    usersRepoStubs: baseUsersRepo(),
    sessionsStubs: baseSessions(),
    bcryptStubs: baseBcrypt(),
  });

  await assert.rejects(
    () => svc.updateBeekeeperAlertSettings({ userId: 1 }),
    (err) =>
      err.status === 400 &&
      err.message === "Provide at least one alert settings field to update",
  );
});

test("updateBeekeeperAlertSettings rejects partial threshold payload", async () => {
  const svc = buildService({
    usersRepoStubs: baseUsersRepo(),
    sessionsStubs: baseSessions(),
    bcryptStubs: baseBcrypt(),
  });

  await assert.rejects(
    () =>
      svc.updateBeekeeperAlertSettings({
        userId: 1,
        warningLow: 90,
      }),
    (err) =>
      err.status === 400 &&
      err.message ===
      "warningLow, warningHigh, criticalLow, and criticalHigh must be provided together",
  );
});

test("updateBeekeeperAlertSettings normalizes and maps updated settings", async () => {
  let captured = null;
  const users = baseUsersRepo();
  users.updateBeekeeperAlertSettings = async (input) => {
    captured = input;
    return {
      id: input.beekeeperId,
      alerts_enabled: false,
      warning_low_threshold: 91,
      warning_high_threshold: 99,
      critical_low_threshold: 88,
      critical_high_threshold: 103,
      updated_at: "2026-03-31T12:00:00.000Z",
      propagated_hive_count: 3,
    };
  };

  const svc = buildService({
    usersRepoStubs: users,
    sessionsStubs: baseSessions(),
    bcryptStubs: baseBcrypt(),
  });

  const result = await svc.updateBeekeeperAlertSettings({
    userId: 12,
    alertsEnabled: false,
    warningLow: "91",
    warningHigh: "99",
    criticalLow: "88",
    criticalHigh: "103",
  });

  assert.deepEqual(captured, {
    beekeeperId: 12,
    alertsEnabled: false,
    warningLow: 91,
    warningHigh: 99,
    criticalLow: 88,
    criticalHigh: 103,
  });
  assert.equal(result.warningLow, 91);
  assert.equal(result.propagatedHiveCount, 3);
  assert.equal(result.updatedAt, "2026-03-31T12:00:00.000Z");
});
