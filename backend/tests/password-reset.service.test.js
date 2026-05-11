"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const servicePath = path.join(
  backendRoot,
  "src/services/passwordReset.service.js",
);
const usersRepoPath = path.join(backendRoot, "src/db/users.db.js");
const resetRepoPath = path.join(backendRoot, "src/db/passwordReset.db.js");

function clearRequireCache() {
  delete require.cache[servicePath];
  delete require.cache[usersRepoPath];
  delete require.cache[resetRepoPath];
}

function buildService({ usersRepoStubs, resetRepoStubs }) {
  clearRequireCache();

  require.cache[usersRepoPath] = {
    id: usersRepoPath,
    filename: usersRepoPath,
    loaded: true,
    exports: usersRepoStubs,
  };

  require.cache[resetRepoPath] = {
    id: resetRepoPath,
    filename: resetRepoPath,
    loaded: true,
    exports: resetRepoStubs,
  };

  return require(servicePath);
}

function baseUsersRepo() {
  return {
    findByEmail: async () => null,
  };
}

function baseResetRepo() {
  return {
    createOrReplace: async () => ({ beekeeper_id: 1 }),
    findByTokenHash: async () => null,
    markConsumedForBeekeeper: async () => true,
  };
}

test("requestResetForEmail no-ops on blank/non-string email", async () => {
  let called = false;
  const usersRepo = baseUsersRepo();
  usersRepo.findByEmail = async () => {
    called = true;
    return null;
  };

  const service = buildService({
    usersRepoStubs: usersRepo,
    resetRepoStubs: baseResetRepo(),
  });

  await service.requestResetForEmail({ email: "   " });
  await service.requestResetForEmail({ email: null });

  assert.equal(called, false);
});

test("requestResetForEmail no-ops for unknown email", async () => {
  const calls = [];
  const usersRepo = baseUsersRepo();
  usersRepo.findByEmail = async ({ email }) => {
    calls.push(email);
    return null;
  };

  let resetCalled = false;
  const resetRepo = baseResetRepo();
  resetRepo.createOrReplace = async () => {
    resetCalled = true;
  };

  const service = buildService({
    usersRepoStubs: usersRepo,
    resetRepoStubs: resetRepo,
  });

  await service.requestResetForEmail({ email: " TeSt@Example.com " });

  assert.deepEqual(calls, ["test@example.com"]);
  assert.equal(resetCalled, false);
});

test("requestResetForEmail creates hashed token for known beekeeper", async () => {
  let captured = null;
  const usersRepo = baseUsersRepo();
  usersRepo.findByEmail = async () => ({ id: 42 });

  const resetRepo = baseResetRepo();
  resetRepo.createOrReplace = async (input) => {
    captured = input;
    return { beekeeper_id: input.beekeeperId };
  };

  const service = buildService({
    usersRepoStubs: usersRepo,
    resetRepoStubs: resetRepo,
  });
  await service.requestResetForEmail({ email: "beek@example.com" });

  assert.equal(captured.beekeeperId, 42);
  assert.equal(typeof captured.tokenHash, "string");
  assert.equal(captured.tokenHash.length, 64);
  assert.ok(captured.expiresAt instanceof Date);
});

test("verifyResetToken returns null on blank token", async () => {
  const service = buildService({
    usersRepoStubs: baseUsersRepo(),
    resetRepoStubs: baseResetRepo(),
  });

  const result = await service.verifyResetToken({ rawToken: "   " });
  assert.equal(result, null);
});

test("verifyResetToken returns null when token hash not found", async () => {
  const calls = [];
  const resetRepo = baseResetRepo();
  resetRepo.findByTokenHash = async ({ tokenHash }) => {
    calls.push(tokenHash);
    return null;
  };

  const service = buildService({
    usersRepoStubs: baseUsersRepo(),
    resetRepoStubs: resetRepo,
  });

  const rawToken = "abc123";
  const expectedHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  const result = await service.verifyResetToken({ rawToken });

  assert.equal(result, null);
  assert.deepEqual(calls, [expectedHash]);
});

test("verifyResetToken returns null for expired tokens", async () => {
  const resetRepo = baseResetRepo();
  resetRepo.findByTokenHash = async () => ({
    beekeeper_id: 7,
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  });

  const service = buildService({
    usersRepoStubs: baseUsersRepo(),
    resetRepoStubs: resetRepo,
  });

  const result = await service.verifyResetToken({ rawToken: "abc123" });
  assert.equal(result, null);
});

test("verifyResetToken returns null for consumed tokens", async () => {
  const resetRepo = baseResetRepo();
  resetRepo.findByTokenHash = async () => ({
    beekeeper_id: 7,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    consumed_at: new Date().toISOString(),
  });

  const service = buildService({
    usersRepoStubs: baseUsersRepo(),
    resetRepoStubs: resetRepo,
  });

  const result = await service.verifyResetToken({ rawToken: "abc123" });
  assert.equal(result, null);
});

test("verifyResetToken returns beekeeperId for active token", async () => {
  const resetRepo = baseResetRepo();
  resetRepo.findByTokenHash = async () => ({
    beekeeper_id: 99,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });

  const service = buildService({
    usersRepoStubs: baseUsersRepo(),
    resetRepoStubs: resetRepo,
  });

  const result = await service.verifyResetToken({ rawToken: "abc123" });
  assert.deepEqual(result, { beekeeperId: 99 });
});

test("consumeResetTokenForBeekeeper validates beekeeperId", async () => {
  const service = buildService({
    usersRepoStubs: baseUsersRepo(),
    resetRepoStubs: baseResetRepo(),
  });

  await assert.rejects(
    () => service.consumeResetTokenForBeekeeper({ beekeeperId: 0 }),
    (err) => err.status === 400 && err.message === "Invalid beekeeperId",
  );
});

test("consumeResetTokenForBeekeeper marks token consumed", async () => {
  const calls = [];
  const resetRepo = baseResetRepo();
  resetRepo.markConsumedForBeekeeper = async ({ beekeeperId }) => {
    calls.push(beekeeperId);
    return true;
  };

  const service = buildService({
    usersRepoStubs: baseUsersRepo(),
    resetRepoStubs: resetRepo,
  });

  await service.consumeResetTokenForBeekeeper({ beekeeperId: 17 });
  assert.deepEqual(calls, [17]);
});
