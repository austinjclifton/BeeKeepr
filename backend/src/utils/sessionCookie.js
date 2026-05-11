"use strict";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "sessionId";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getBaseOptions() {
  const options = {
    httpOnly: true,
    secure: parseBoolean(
      process.env.SESSION_COOKIE_SECURE,
      process.env.NODE_ENV === "production",
    ),
    sameSite: normalizeSameSite(process.env.SESSION_COOKIE_SAME_SITE || "lax"),
    path: "/",
  };

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
};

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

function normalizeSameSite(value) {
  const normalized = String(value).trim().toLowerCase();
  if (["strict", "lax", "none"].includes(normalized)) return normalized;
  return "lax";
}
