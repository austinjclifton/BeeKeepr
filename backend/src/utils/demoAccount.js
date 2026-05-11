"use strict";

function getDemoAccountUsername() {
  const username = process.env.DEMO_ACCOUNT_USERNAME;
  return typeof username === "string" && username.trim()
    ? username.trim()
    : null;
}

function isDemoAccountUser(user) {
  const demoUsername = getDemoAccountUsername();
  if (!demoUsername) return false;
  return user?.username === demoUsername;
}

module.exports = {
  getDemoAccountUsername,
  isDemoAccountUser,
};
