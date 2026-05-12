"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const sessionCookieModulePath = path.join(
    __dirname,
    "..",
    "src/utils/sessionCookie.js",
);

test("session cookies stay lax and unsigned during local development", () => {
    withEnv(
        {
            NODE_ENV: undefined,
            SESSION_SECRET: undefined,
            SESSION_COOKIE_SECURE: undefined,
            SESSION_COOKIE_SAME_SITE: undefined,
            SESSION_COOKIE_DOMAIN: undefined,
        },
        () => {
            const { setSessionCookie } = loadSessionCookieModule();
            const calls = [];
            const res = {
                cookie(name, value, options) {
                    calls.push({ name, value, options });
                },
            };

            setSessionCookie(res, "token-123");

            assert.deepEqual(calls, [
                {
                    name: "sessionId",
                    value: "token-123",
                    options: {
                        httpOnly: true,
                        secure: false,
                        sameSite: "lax",
                        path: "/",
                        maxAge: 604800000,
                    },
                },
            ]);
        },
    );
});

test("session cookies become signed secure cross-site cookies in production", () => {
    withEnv(
        {
            NODE_ENV: "production",
            SESSION_SECRET: "super-secret",
            SESSION_COOKIE_SECURE: undefined,
            SESSION_COOKIE_SAME_SITE: undefined,
            SESSION_COOKIE_DOMAIN: undefined,
        },
        () => {
            const { setSessionCookie, getSessionSecret } = loadSessionCookieModule();
            const calls = [];
            const res = {
                cookie(name, value, options) {
                    calls.push({ name, value, options });
                },
            };

            assert.equal(getSessionSecret(), "super-secret");

            setSessionCookie(res, "prod-token");

            assert.deepEqual(calls, [
                {
                    name: "sessionId",
                    value: "prod-token",
                    options: {
                        httpOnly: true,
                        secure: true,
                        sameSite: "none",
                        path: "/",
                        signed: true,
                        maxAge: 604800000,
                    },
                },
            ]);
        },
    );
});

test("production session cookies require SESSION_SECRET", () => {
    withEnv(
        {
            NODE_ENV: "production",
            SESSION_SECRET: undefined,
            SESSION_COOKIE_SECURE: undefined,
            SESSION_COOKIE_SAME_SITE: undefined,
            SESSION_COOKIE_DOMAIN: undefined,
        },
        () => {
            const { getSessionSecret } = loadSessionCookieModule();

            assert.throws(
                () => getSessionSecret(),
                /SESSION_SECRET is required in production/,
            );
        },
    );
});

function loadSessionCookieModule() {
    delete require.cache[sessionCookieModulePath];
    return require(sessionCookieModulePath);
}

function withEnv(overrides, fn) {
    const prior = new Map();

    for (const [key, value] of Object.entries(overrides)) {
        prior.set(key, process.env[key]);

        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }

    try {
        return fn();
    } finally {
        for (const [key, value] of prior.entries()) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }

        delete require.cache[sessionCookieModulePath];
    }
}