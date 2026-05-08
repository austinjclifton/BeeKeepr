"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const servicePath = path.join(backendRoot, "src/services/sessions.service.js");
const sessionsRepoPath = path.join(backendRoot, "src/db/sessions.db.js");
const usersRepoPath = path.join(backendRoot, "src/db/users.db.js");

function clearRequireCache() {
  delete require.cache[servicePath];
  delete require.cache[sessionsRepoPath];
  delete require.cache[usersRepoPath];
}

function buildService({ sessionsRepoStubs, usersRepoStubs }) {
  clearRequireCache();

  require.cache[sessionsRepoPath] = {
    id: sessionsRepoPath,
    filename: sessionsRepoPath,
    loaded: true,
    exports: sessionsRepoStubs,
  };

  require.cache[usersRepoPath] = {
    id: usersRepoPath,
    filename: usersRepoPath,
    loaded: true,
    exports: usersRepoStubs,
  };

  return require(servicePath);
}

function baseSessionsRepo() {
  return {
    create: async ({ beekeeperId, sessionToken, csrfToken, expiresAt }) => ({
      id: 1,
      beekeeper_id: beekeeperId,
      session_token: sessionToken,
      csrf_token: csrfToken,
      expires_at: expiresAt,
      active: true,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    }),
    findByToken: async () => null,
    invalidate: async () => true,
    invalidateAllForBeekeeper: async () => true,
    touch: async () => true,
  };
}

function baseUsersRepo() {
  return {
    findById: async () => ({ id: 1, username: "u", email: "u@example.com" }),
  };
}

test("createSession validates beekeeperId", async () => {
  const service = buildService({
    sessionsRepoStubs: baseSessionsRepo(),
    usersRepoStubs: baseUsersRepo(),
  });

  await assert.rejects(
    () => service.createSession({ beekeeperId: 0 }),
    (err) =>
      err.status === 400 &&
      err.message === "beekeeperId must be a positive integer",
  );
});

test("createSession returns mapped session with generated tokens", async () => {
  const service = buildService({
    sessionsRepoStubs: baseSessionsRepo(),
    usersRepoStubs: baseUsersRepo(),
  });

  const session = await service.createSession({
    beekeeperId: 2,
    context: { ip: "127.0.0.1" },
  });

  assert.equal(session.beekeeperId, 2);
  assert.equal(typeof session.sessionToken, "string");
  assert.equal(session.sessionToken.length, 64);
  assert.equal(typeof session.csrfToken, "string");
  assert.equal(session.csrfToken.length, 64);
  assert.equal(session.active, true);
});

test("validateSession returns null for blank token", async () => {
  const service = buildService({
    sessionsRepoStubs: baseSessionsRepo(),
    usersRepoStubs: baseUsersRepo(),
  });

  const result = await service.validateSession({ sessionToken: "   " });
  assert.equal(result, null);
});

test("validateSession invalidates expired sessions", async () => {
  const calls = [];
  const sessionsRepo = baseSessionsRepo();
  sessionsRepo.findByToken = async () => ({
    id: 10,
    beekeeper_id: 7,
    session_token: "tok",
    csrf_token: "csrf",
    expires_at: new Date(Date.now() - 60_000).toISOString(),
    active: true,
    created_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  });
  sessionsRepo.invalidate = async ({ sessionId }) => {
    calls.push(sessionId);
    return true;
  };

  const service = buildService({
    sessionsRepoStubs: sessionsRepo,
    usersRepoStubs: baseUsersRepo(),
  });

  const result = await service.validateSession({ sessionToken: "tok" });
  assert.equal(result, null);
  assert.deepEqual(calls, [10]);
});

test("validateSession invalidates orphaned sessions", async () => {
  const calls = [];
  const sessionsRepo = baseSessionsRepo();
  sessionsRepo.findByToken = async () => ({
    id: 11,
    beekeeper_id: 9,
    session_token: "tok",
    csrf_token: "csrf",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    active: true,
    created_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  });
  sessionsRepo.invalidate = async ({ sessionId }) => {
    calls.push(sessionId);
    return true;
  };

  const usersRepo = baseUsersRepo();
  usersRepo.findById = async () => null;

  const service = buildService({
    sessionsRepoStubs: sessionsRepo,
    usersRepoStubs: usersRepo,
  });

  const result = await service.validateSession({ sessionToken: "tok" });
  assert.equal(result, null);
  assert.deepEqual(calls, [11]);
});

test("validateSession touches active valid session and returns context", async () => {
  const calls = [];
  const sessionsRepo = baseSessionsRepo();
  sessionsRepo.findByToken = async () => ({
    id: 12,
    beekeeper_id: 5,
    session_token: "tok",
    csrf_token: "csrf",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    active: true,
    created_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  });
  sessionsRepo.touch = async ({ sessionId }) => {
    calls.push(sessionId);
    return true;
  };

  const usersRepo = baseUsersRepo();
  usersRepo.findById = async () => ({
    id: 5,
    username: "beek",
    email: "beek@example.com",
  });

  const service = buildService({
    sessionsRepoStubs: sessionsRepo,
    usersRepoStubs: usersRepo,
  });

  const result = await service.validateSession({ sessionToken: "tok" });
  assert.equal(result.user.id, 5);
  assert.equal(result.session.beekeeperId, 5);
  assert.deepEqual(calls, [12]);
});

test("invalidateSession no-ops on unknown token", async () => {
  let invalidated = false;
  const sessionsRepo = baseSessionsRepo();
  sessionsRepo.findByToken = async () => null;
  sessionsRepo.invalidate = async () => {
    invalidated = true;
    return true;
  };

  const service = buildService({
    sessionsRepoStubs: sessionsRepo,
    usersRepoStubs: baseUsersRepo(),
  });
  await service.invalidateSession({ sessionToken: "tok" });

  assert.equal(invalidated, false);
});

test("invalidateAllSessionsForUser validates beekeeperId", async () => {
  const service = buildService({
    sessionsRepoStubs: baseSessionsRepo(),
    usersRepoStubs: baseUsersRepo(),
  });

  await assert.rejects(
    () => service.invalidateAllSessionsForUser({ beekeeperId: -1 }),
    (err) =>
      err.status === 400 &&
      err.message === "beekeeperId must be a positive integer",
  );
});
