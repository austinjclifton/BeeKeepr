# Demo Data

BeeKeepr demo data is configured in `src/config/demoData.config.js`.

Edit that file to change:

- Demo account defaults: `account.username`, `account.email`, `account.password`
- Default history window and cadence: `history.months`, `history.intervalMinutes`
- Demo yards: `locations[].timeZone`, `locations[].lat`, `locations[].lon`, `locations[].climate`
- Hive topology: `hives[].locationKey`, names, notes, install dates, internal baselines, strength, and RSSI profile
- Planned anomaly scenarios: `hives[].scenarios`

Scenario entries support `type`, `start`, `durationMinutes`, `intensity`, and `note`. Current scenario types are `swarm`, `heat_stress`, `cold_stress`, `brood_decline`, `queen_issue`, `sensor_issue`, and `weak_signal`.

## Seed Demo Topology

```sh
npm run db:seed:demo
```

This creates or updates the demo beekeeper, locations, hives, devices, and thresholds. It does not generate historical readings by itself.

## Generate 18 Months

```sh
npm run demo:backfill
```

By default this generates the configured 18-month history at 10-minute intervals, ending at the current bucket. It inserts external conditions and hive readings with uniqueness-aware dedupe behavior and prints inserted/skipped counts by table, location, and hive.

Each location is simulated against its own configured timezone, so multi-region demo yards keep their daily weather and brood cycles aligned to local clock time.

Backfill does not create alerts unless requested:

```sh
npm run demo:backfill -- --withAlerts
```

When `--withAlerts` is enabled, alert records are produced from readings that naturally cross the configured thresholds. Historical critical alerts do not send email.

## Custom Backfill Ranges

```sh
npm run demo:backfill -- --start=2026-01-01T00:00:00.000Z --end=2026-02-01T00:00:00.000Z
```

```sh
npm run demo:backfill -- --months=6 --intervalMinutes=10
```

Supported arguments:

- `--start=ISO_DATE`
- `--end=ISO_DATE`
- `--months=18`
- `--intervalMinutes=10`
- `--withAlerts`

Backfill floors dates to the configured bucket interval and will not insert future buckets. If `--end` is in the future, it is clamped to the current bucket and the summary reports skipped future buckets.

## Cron Tick

Keep EC2 cron running the existing command:

```sh
npm run demo:tick
```

`demo:tick` remains a safe one-shot generator for only the current 10-minute bucket. It uses the same config and simulation helpers as backfill, respects unique constraints, and reports inserted/skipped counts.

## Operational Notes

An 18-month, 10-minute backfill creates roughly 78,000 buckets. With the default config that is about 390,000 hive readings plus 156,000 external condition rows before dedupe, so run it intentionally against the target database.

Backfill is idempotent for existing buckets: readings and external conditions that already exist are skipped. If you need regenerated values after changing the config, clear the relevant demo rows deliberately before running backfill again.
