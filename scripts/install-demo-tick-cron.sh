#!/usr/bin/env bash
#
# install-demo-tick-cron.sh
#
# Install (or replace) the BeeKeepr demo 10-minute tick cron line.
# Idempotent: re-running replaces the previous line cleanly.
#
# The tick is a short-lived Node script, not a long-running worker, so
# it belongs in cron — not PM2. PM2 is reserved for the backend API
# (`beekeepr-backend`). The line uses `flock -n` so a slow tick cannot
# overlap with the next interval.
#
# Usage:
#   bash scripts/install-demo-tick-cron.sh
#
# Environment overrides:
#   BACKEND_DIR   Absolute path to the backend directory containing
#                 the npm scripts. Default: <repo-root>/backend.
#   CRON_USER     User whose crontab to edit. Default: the current user
#                 (this script must run as that user, or via sudo -u).
#   CRON_SCHEDULE Cron expression for the tick. Default: "*/10 * * * *".
#   CRON_LOG      Log file path. Default: /home/ubuntu/beekeepr-demo-tick.log
#                 (override for non-ubuntu hosts).

set -euo pipefail

# --- Resolve repo root from the script's own location ------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKEND_DIR="${BACKEND_DIR:-${REPO_ROOT}/backend}"
CRON_USER="${CRON_USER:-$(id -un)}"
CRON_SCHEDULE="${CRON_SCHEDULE:-*/10 * * * *}"
LOCK_FILE="${LOCK_FILE:-/tmp/beekeepr-demo-tick.lock}"
CRON_LOG="${CRON_LOG:-/home/ubuntu/beekeepr-demo-tick.log}"
SENTINEL="beekeepr-demo-tick.lock"

# --- Sanity checks ------------------------------------------------------------
if [ ! -d "${BACKEND_DIR}" ]; then
  echo "ERROR: BACKEND_DIR does not exist: ${BACKEND_DIR}" >&2
  exit 1
fi

if [ ! -f "${BACKEND_DIR}/package.json" ]; then
  echo "ERROR: No package.json in ${BACKEND_DIR} — is this the backend?" >&2
  exit 1
fi

if ! command -v flock >/dev/null 2>&1; then
  echo "ERROR: 'flock' is not installed. Install it (apt: util-linux) before re-running." >&2
  exit 1
fi

if ! command -v crontab >/dev/null 2>&1; then
  echo "ERROR: 'crontab' is not installed. Install it (apt: cron) before re-running." >&2
  exit 1
fi

# --- Build the cron line ------------------------------------------------------
CRON_LINE="${CRON_SCHEDULE} cd ${BACKEND_DIR} && flock -n ${LOCK_FILE} npm run demo:tick >> ${CRON_LOG} 2>&1"

echo "Installing BeeKeepr demo tick cron for user '${CRON_USER}':"
echo "  ${CRON_LINE}"

# --- Replace any existing line with the same sentinel; append the new one -----
TMP_CRON="$(mktemp)"
trap 'rm -f "${TMP_CRON}"' EXIT

crontab -u "${CRON_USER}" -l 2>/dev/null \
  | grep -v -F "${SENTINEL}" \
  > "${TMP_CRON}" || true

printf '%s\n' "${CRON_LINE}" >> "${TMP_CRON}"

crontab -u "${CRON_USER}" "${TMP_CRON}"

echo
echo "Resulting crontab for ${CRON_USER}:"
crontab -u "${CRON_USER}" -l

echo
echo "Done. The tick will run every 10 minutes."
echo "  - Logs:    ${CRON_LOG}"
echo "  - Lock:    ${LOCK_FILE}"
echo "  - Manual:  cd ${BACKEND_DIR} && flock -n ${LOCK_FILE} npm run demo:tick"
