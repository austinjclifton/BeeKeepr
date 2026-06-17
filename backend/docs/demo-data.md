# Demo Data

The BeeKeepr demo data system has exactly one source of truth:
[`src/scripts/demoData.config.js`](../src/scripts/demoData.config.js). The
service in [`src/services/demoData.service.js`](../src/services/demoData.service.js)
and every `npm` demo script read from that file. To change the demo
world — account defaults, alert thresholds, history window, climates,
locations, hives, or planned scenarios — edit that file first, then
re-run the relevant npm scripts below.

Do not define demo locations or hives in a separate SQL seed unless
intentionally creating a manual/legacy seed. The only canonical demo
loader is the Node service.

## Current demo world

Two locations, five hives, one device per hive:

| Location key | Name                         | City          | Time zone         |
| ------------ | ---------------------------- | ------------- | ----------------- |
| `app`        | Blue Ridge Appalachia Demo Yard | Asheville, NC | America/New_York |
| `wny`        | Western New York Demo Yard   | Buffalo, NY   | America/New_York  |

| Hive key  | Location | Name                    |
| --------- | -------- | ----------------------- |
| `app-01`  | `app`    | Blue Ridge Stable Hive  |
| `app-02`  | `app`    | Pisgah Orchard Hive     |
| `wny-01`  | `wny`    | Lake Erie Stable Hive   |
| `wny-02`  | `wny`    | Niagara Snowbelt Hive   |
| `wny-03`  | `wny`    | Finger Lakes Variable Hive |

The config also controls:

- **Account defaults:** `account.username`, `account.email`,
  `account.password` (overridable via `DEMO_ACCOUNT_USERNAME`,
  `DEMO_ACCOUNT_EMAIL`, `DEMO_ACCOUNT_PASSWORD` env vars).
- **History window and cadence:** `history.months` (default `18`),
  `history.intervalMinutes` (default `10`).
- **Provider tag** for generated external conditions: `provider`
  (default `demo-simulator`).
- **Alert thresholds:** `thresholds.alertsEnabled`,
  `thresholds.warningLowThreshold`, `thresholds.warningHighThreshold`,
  `thresholds.criticalLowThreshold`, `thresholds.criticalHighThreshold`.
- **Per-location climate profiles** (`locations[].climate`) and
  **per-hive internal baselines + RSSI profiles + scenarios**
  (`hives[].internal`, `hives[].rssi`, `hives[].scenarios`).

Scenario entries support `type`, `start`, `durationMinutes`,
`intensity`, and `note`. Current scenario types are `swarm`,
`heat_stress`, `cold_stress`, `brood_decline`, `queen_issue`,
`sensor_issue`, and `weak_signal`.

The service validates the config at module load — duplicate location
keys, duplicate hive keys, unknown `hive.locationKey`, or empty
`locations`/`hives` arrays all fail fast with a clear message.

## Scripts and recommended order

All demo scripts live in `backend/` and are listed in
`backend/package.json`.

| Script                          | Purpose                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run db:migrate`            | Apply `backend/docs/schema.sql` to a fresh database. Not a migration tool.               |
| `npm run db:seed:demo`          | Ensure demo beekeeper, locations, hives, devices, and thresholds from the config.       |
| `npm run demo:prune-stale`      | Remove demo records no longer in the config (stale hives, orphaned demo locations).     |
| `npm run demo:reset-readings`   | Clear alerts, readings, and demo-simulator weather for the configured demo world.       |
| `npm run demo:backfill`         | Generate historical external conditions, readings, RSSI, and (optionally) alerts.        |
| `npm run demo:tick`             | Generate one current 10-minute bucket (use as a cron job for "live" demo data).         |

### First-time setup on a fresh database

```sh
cd backend
npm run db:migrate      # apply schema.sql
npm run db:seed:demo    # create demo topology
npm run demo:backfill   # generate 18 months of history (default flags)
```

### After editing the config (rename / remove / add a hive or location)

```sh
cd backend
npm run demo:prune-stale -- --removeUnusedLocations=true   # drop stale topology
npm run demo:reset-readings                                # clear generated history
npm run db:seed:demo                                       # recreate topology from config
npm run demo:backfill                                      # regenerate history
```

`db:seed:demo` already calls `pruneStaleDemoData` internally, so
running it alone is usually enough for routine edits. Use the explicit
sequence above when you want to reset the generated history as well.

### `npm run demo:backfill` flags

```sh
npm run demo:backfill -- --withAlerts
npm run demo:backfill -- --start=2026-01-01T00:00:00.000Z --end=2026-02-01T00:00:00.000Z
npm run demo:backfill -- --months=6 --intervalMinutes=10
```

Supported arguments: `--start=ISO_DATE`, `--end=ISO_DATE`,
`--months=18`, `--intervalMinutes=10`, `--withAlerts`. Dates are
floored to the configured bucket interval and clamped to the current
bucket; future buckets are skipped and reported in the summary.

### `npm run demo:tick`

```sh
npm run demo:tick
```

Generates one current 10-minute bucket and exits. Uses the same config
and simulation helpers as backfill, respects unique constraints, and
reports inserted/skipped counts. Critical alerts created during a
tick send email (this is the only demo path that does). Run from
cron to keep the demo looking "live" between manual backfills.

## Seed vs. backfill vs. tick vs. prune vs. reset

- **seed (`db:seed:demo`)** — creates/updates the static demo
  topology (beekeeper, locations, hives, devices, thresholds). Does
  NOT generate any time-series data.
- **backfill (`demo:backfill`)** — generates the historical
  time-series (external conditions + readings + optional alerts) for
  the configured window. Idempotent per bucket.
- **tick (`demo:tick`)** — generates exactly one current bucket. Use
  on a schedule to keep the demo "live".
- **prune (`demo:prune-stale`)** — deletes demo records that no
  longer correspond to anything in the config. Run this after
  removing/renaming locations or hives.
- **reset (`demo:reset-readings`)** — clears all generated alerts,
  readings, and demo-simulator weather so backfill can start fresh.
  Does NOT touch the topology.

## Operational notes

An 18-month, 10-minute backfill creates roughly 78,000 buckets per
metric. With the default config that is about 390,000 hive readings
plus 156,000 external condition rows before dedupe, so run it
intentionally against the target database.

Backfill is idempotent for existing buckets: readings and external
conditions that already exist are skipped. If you need regenerated
values after changing the config, run `npm run demo:reset-readings`
and then `npm run demo:backfill` again.

## Scheduling the 10-minute tick (cron, NOT PM2)

PM2 is used to manage the long-running backend API
(`beekeepr-backend` on the EC2 deploy). The demo `tick` script is
short-lived (it connects, writes one bucket, logs, and exits), so it
belongs in **cron**, not PM2. This is portable across AWS EC2 and
DigitalOcean droplets, and the tick can be inspected/edited without
restarting the API.

The tick job also uses `flock` so a slow tick cannot overlap with the
next one — if a tick is still running when the next interval fires,
`flock -n` makes the new invocation exit immediately instead of
stacking up database writers.

Canonical cron line (replace `/path/to/beekeepr/backend` with the
actual deployed backend directory — e.g. `/home/ubuntu/beekeepr/backend`
on the current EC2 box):

```cron
*/10 * * * * cd /path/to/beekeepr/backend && flock -n /tmp/beekeepr-demo-tick.lock npm run demo:tick >> /home/ubuntu/beekeepr-demo-tick.log 2>&1
```

What each piece means:

- `*/10 * * * *` — every 10 minutes.
- `cd /path/to/beekeepr/backend` — pin cwd so `dotenv` loads the right
  `.env` and the npm script resolves correctly.
- `flock -n /tmp/beekeepr-demo-tick.lock` — non-blocking lock; if a
  previous tick is still running, the new one exits cleanly instead of
  contending for the same database writes.
- `npm run demo:tick` — the canonical tick script (see above).
- `>> /home/ubuntu/beekeepr-demo-tick.log 2>&1` — append stdout+stderr
  to a persistent log so the latest tick output is easy to inspect.

Manual install (one-time on a fresh host, or after migrating the box):

```sh
# from anywhere, with the repo already cloned
cd /home/ubuntu/beekeepr
bash scripts/install-demo-tick-cron.sh
# or, ad-hoc:
( crontab -l 2>/dev/null | grep -v beekeepr-demo-tick.lock ; \
  echo '*/10 * * * * cd /home/ubuntu/beekeepr/backend && flock -n /tmp/beekeepr-demo-tick.lock npm run demo:tick >> /home/ubuntu/beekeepr-demo-tick.log 2>&1' \
) | crontab -
crontab -l
```

Verify the job is actually firing:

```sh
crontab -l
tail -n 50 /home/ubuntu/beekeepr-demo-tick.log
# run one tick by hand with the same lock to sanity-check:
cd /home/ubuntu/beekeepr/backend && flock -n /tmp/beekeepr-demo-tick.lock npm run demo:tick
```

Do **not** run the tick under PM2 unless the design changes to a
long-running worker process. PM2 is for the API process only.

## PM2 ↔ cron split (target state)

| Process              | Manager | Notes                                                 |
| -------------------- | ------- | ----------------------------------------------------- |
| `beekeepr-backend`   | PM2     | `pm2 start src/server.js --name beekeepr-backend`     |
| Demo 10-minute tick  | cron    | short-lived script, `flock`-guarded, logs to file     |

If you find a stale PM2 entry for an old demo tick / scheduler
process from a previous design, stop it before removing it, then:

```sh
pm2 stop <old-demo-tick-process-name>   # confirm it's just the tick
pm2 delete <old-demo-tick-process-name>
pm2 save
```

Do not run `pm2 delete` blindly — make sure you're only removing a
tick/scheduler process, not the API.

## Rebuilding the demo DB from a wiped state

Use this exact order on a fresh database (or after wiping the demo
data). Every step is idempotent except `db:migrate` and
`demo:reset-readings`, which are intentional.

```sh
cd /path/to/beekeepr/backend

# A. Apply schema to a fresh database
npm run db:migrate

# B. Ensure the demo topology exists (also prunes internally)
npm run db:seed:demo

# C. Prune any stale demo topology that is no longer in the config
npm run demo:prune-stale -- --removeUnusedLocations=true

# D. Clear previously generated runtime data
npm run demo:reset-readings

# E. Re-seed the topology after reset (cheap; ensures hives exist)
npm run db:seed:demo

# F. Generate 18 months of history at 10-minute buckets, with alerts
npm run demo:backfill -- --months=18 --intervalMinutes=10 --withAlerts=true

# G. One manual tick to confirm the recurring job will work
npm run demo:tick
```

For a routine config edit (rename / add / remove a hive or location),
steps **C → G** are usually enough — `db:migrate` is only needed on a
fresh database.

## Verifying the canonical demo world

After any rebuild, confirm the topology matches `demoData.config.js`:

```sql
-- Counts
SELECT COUNT(*) AS locations FROM location;
SELECT COUNT(*) AS hives FROM hive;
SELECT COUNT(*) AS devices FROM device;
SELECT COUNT(*) AS external_conditions FROM external_condition;
SELECT COUNT(*) AS readings FROM reading;
SELECT COUNT(*) AS alerts FROM alert;

-- Names match the canonical world
SELECT name FROM location ORDER BY name;
SELECT name FROM hive ORDER BY name;
```

Expected:

- 2 locations — `Blue Ridge Appalachia Demo Yard`, `Western New York Demo Yard`
- 5 hives — `Blue Ridge Stable Hive`, `Pisgah Orchard Hive`,
  `Lake Erie Stable Hive`, `Niagara Snowbelt Hive`, `Finger Lakes Variable Hive`
- 5 devices (one per hive)
- external_conditions / readings populated by the backfill (orders of
  magnitude depend on `--months` and `--intervalMinutes`)
- alerts populated when `--withAlerts=true` was used

Confirm no California-era demo data lingers after a rename or prune:

```sql
SELECT *
FROM location
WHERE name ILIKE '%California%'
   OR name ILIKE '%Davis%';

SELECT *
FROM hive
WHERE name ILIKE '%Yolo%'
   OR name ILIKE '%Delta%'
   OR name ILIKE '%Solano%'
   OR name ILIKE '%California%';
```

Both queries should return zero rows.

## Legacy SQL seed

[`docs/archive/legacy-demo-seed.sql`](../docs/archive/legacy-demo-seed.sql)
is the original hand-rolled SQL demo seed. It is **not** referenced
by any npm script or runtime code path. It is preserved only for
operators who intentionally need to restore an older demo world
shaped like the old California + Western New York layout. The active
demo system does not use it — use the npm scripts above instead.
