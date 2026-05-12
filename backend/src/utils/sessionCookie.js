"use strict";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "sessionId";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function getBaseOptions() {
  const sessionSecret = getSessionSecret();
  const sameSite = normalizeSameSite(
    process.env.SESSION_COOKIE_SAME_SITE || (IS_PRODUCTION ? "none" : "lax"),
  );
  const secure = parseBoolean(
    process.env.SESSION_COOKIE_SECURE,
    IS_PRODUCTION || sameSite === "none",
  );

  if (sameSite === "none" && secure !== true) {
    throw new Error(
      "SESSION_COOKIE_SECURE must be true when SESSION_COOKIE_SAME_SITE=none",
    );
  }

  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
  };

  if (sessionSecret) {
    options.signed = true;
  }

  if (process.env.SESSION_COOKIE_DOMAIN) {
    options.domain = process.env.SESSION_COOKIE_DOMAIN;
  }

  return options;
}

function setSessionCookie(res, sessionToken) {
  res.cookie(SESSION_COOKIE_NAME, sessionToken, {
    ...getBaseOptions(),
    maxAge: SESSION_MAX_AGE_MS,
  });
}

function clearSessionCookie(res) {
  // Must match key attributes to reliably clear
  res.clearCookie(SESSION_COOKIE_NAME, getBaseOptions());
}

module.exports = {
  SESSION_COOKIE_NAME,
  setSessionCookie,
  clearSessionCookie,
  getSessionSecret,
};

function getSessionSecret() {
  const secret = normalizeConfiguredValue(process.env.SESSION_SECRET);

  if (IS_PRODUCTION && !secret) {
    throw new Error("SESSION_SECRET is required in production");
  }

  return secret;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

function normalizeConfiguredValue(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized || null;
}

function normalizeSameSite(value) {
  const normalized = String(value).trim().toLowerCase();
  if (["strict", "lax", "none"].includes(normalized)) return normalized;
  return "lax";
}
