"use strict";

/**
 * BeeKeepr canonical demo world — single source of truth.
 *
 * THIS FILE IS THE CANONICAL SOURCE OF TRUTH FOR THE BEEKEEPR DEMO WORLD.
 *
 * The demo seed, backfill, tick, prune, and reset scripts read from this
 * config. Do not use the legacy SQL seed
 * (`backend/docs/archive/legacy-demo-seed.sql`) as the primary demo system
 * unless intentionally bypassing the Node simulator.
 *
 * This module is the authoritative definition of the demo beekeeper,
 * yards, hives, climates, alert thresholds, history window, and planned
 * anomaly scenarios. Every demo data tool in the backend reads from here:
 *
 *   - demoData.service.js  (ensureDemoSeed / runDemoBackfill /
 *                          runDemoTick / pruneStaleDemoData /
 *                          resetDemoRuntimeData)
 *   - src/scripts/dbSeedDemo.js
 *   - src/scripts/demoBackfill.js
 *   - src/scripts/demoTick.js
 *   - src/scripts/demoPruneStale.js
 *   - src/scripts/demoResetRuntimeData.js
 *
 * To change the demo app's locations, hives, climates, alert thresholds,
 * history window, or planned scenarios, edit this file first and then
 * re-run the npm demo scripts in the order documented in
 * `backend/docs/demo-data.md`.
 *
 * Do not define demo locations or hives in a separate SQL seed unless
 * intentionally creating a manual/legacy seed. The only canonical demo
 * loader is the Node service in `src/services/demoData.service.js`.
 *
 * Current demo world:
 *   - 2 locations:
 *       app — Blue Ridge Appalachia Demo Yard  (Asheville, NC, America/New_York)
 *       roc — Rochester Demo Yard              (Rochester, NY, America/New_York)
 *   - 5 hives (one device each):
 *       app-01  Biltmore Estate Hive
 *       app-02  Mount Pisgah Hive
 *       roc-01  Lake Ontario Hive
 *       roc-02  Highland Park Hive
 *       roc-03  Erie Canal Hive
 *
 * History window: 30 days at 10-minute intervals (~4,320 buckets/metric).
 *
 * Real weather: the demo tick (`npm run demo:tick`) calls the real
 * OpenWeather One Call 3.0 endpoint per location when `tick.useRealWeather`
 * is true. Each tick costs ~2 API calls; with 144 ticks/day that is
 * ~288 calls/day for 2 locations, well under the 1,000/day free tier.
 * The 30-day backfill still uses synthesized weather (the OpenWeather
 * Timemachine endpoint is paid), so backfilled rows have
 * `provider = "demo-simulator"` and live tick rows have
 * `provider = "openweather"`. If a real-weather call fails (network,
 * missing API key, rate limit) the tick falls back to synthesis for
 * that bucket so the internal reading still has plausible inputs.
 *
 * The module is deeply frozen; mutate keys/objects at your own risk.
 */
module.exports = Object.freeze({
  account: Object.freeze({
    username: "demo",
    email: "demo@beekeepr.example",
    password: "replace-me",
  }),

  history: Object.freeze({
    days: 30,
    intervalMinutes: 10,
  }),

  tick: Object.freeze({
    useRealWeather: true,
  }),

  provider: "demo-simulator",

  thresholds: Object.freeze({
    alertsEnabled: true,
    warningLowThreshold: 92,
    warningHighThreshold: 98,
    criticalLowThreshold: 89,
    criticalHighThreshold: 101,
  }),

  locations: Object.freeze([
    Object.freeze({
      key: "app",
      name: "Blue Ridge Appalachia Demo Yard",
      cityName: "Asheville, NC",
      timeZone: "America/New_York",
      lat: 35.5951,
      lon: -82.5515,
      climate: Object.freeze({
        averageTempF: 58,
        seasonalAmplitudeF: 24,
        winterDailyAmplitudeF: 7,
        summerDailyAmplitudeF: 13,
        peakDayOfYear: 198,
        dailyPeakHour: 15.0,
        synopticNoiseF: 4.4,
        shortNoiseF: 1.1,
        humidityBasePct: 72,
        humidityAmplitudePct: 16,
        windBaseMps: 2.4,
        windAmplitudeMps: 1.1,
        pressureBaseHpa: 1013.5,
        broodStartDay: 72,
        broodEndDay: 304,
        heatStressTempF: 88,
        coldStressTempF: 22,
      }),
    }),
    Object.freeze({
      key: "roc",
      name: "Rochester Demo Yard",
      cityName: "Rochester, NY",
      timeZone: "America/New_York",
      lat: 43.1566,
      lon: -77.6088,
      climate: Object.freeze({
        averageTempF: 48,
        seasonalAmplitudeF: 28,
        winterDailyAmplitudeF: 6,
        summerDailyAmplitudeF: 12,
        peakDayOfYear: 200,
        dailyPeakHour: 15.0,
        synopticNoiseF: 5.2,
        shortNoiseF: 1.3,
        humidityBasePct: 71,
        humidityAmplitudePct: 17,
        windBaseMps: 3.4,
        windAmplitudeMps: 1.7,
        pressureBaseHpa: 1014.5,
        broodStartDay: 88,
        broodEndDay: 286,
        heatStressTempF: 86,
        coldStressTempF: 18,
      }),
    }),
  ]),

  hives: Object.freeze([
    Object.freeze({
      key: "app-01",
      locationKey: "app",
      name: "Biltmore Estate Hive",
      notes: "Asheville demo hive with a stable brood temperature profile",
      installedAt: "2024-11-01T13:00:00.000Z",
      deviceInstalledAt: "2024-11-01T13:00:00.000Z",
      internal: Object.freeze({
        baselineTempF: 95.2,
        strength: 0.9,
        broodDailyAmplitudeF: 0.26,
        broodSeasonalAmplitudeF: 0.2,
        winterClusterTempF: 91.8,
        winterExternalSensitivity: 0.05,
        activeExternalSensitivity: 0.024,
        sensorPlacementOffsetF: 0.05,
        phaseShiftHours: 0.2,
      }),
      rssi: Object.freeze({
        baselineDbm: -60,
        dailyAmplitudeDb: 6,
        noiseDb: 2,
      }),
      scenarios: Object.freeze([
        Object.freeze({
          type: "heat_stress",
          start: "2026-06-12T16:00:00.000Z",
          durationMinutes: 240,
          intensity: 0.62,
          note: "Late-spring heat wave on the estate grounds",
        }),
      ]),
    }),

    Object.freeze({
      key: "app-02",
      locationKey: "app",
      name: "Mount Pisgah Hive",
      notes: "Asheville ridge-line hive with a brief probe disturbance and a swarm-prep pulse",
      installedAt: "2024-11-01T13:15:00.000Z",
      deviceInstalledAt: "2024-11-01T13:15:00.000Z",
      internal: Object.freeze({
        baselineTempF: 95.0,
        strength: 0.8,
        broodDailyAmplitudeF: 0.4,
        broodSeasonalAmplitudeF: 0.28,
        winterClusterTempF: 90.8,
        winterExternalSensitivity: 0.08,
        activeExternalSensitivity: 0.03,
        sensorPlacementOffsetF: -0.05,
        phaseShiftHours: 1.0,
      }),
      rssi: Object.freeze({
        baselineDbm: -65,
        dailyAmplitudeDb: 7,
        noiseDb: 2,
      }),
      scenarios: Object.freeze([
        Object.freeze({
          type: "queen_issue",
          start: "2026-06-08T05:00:00.000Z",
          durationMinutes: 1440,
          intensity: 0.48,
          note: "Slow brood-pattern dip after queen replacement attempt",
        }),
        Object.freeze({
          type: "swarm",
          start: "2026-06-15T17:30:00.000Z",
          durationMinutes: 60,
          intensity: 0.7,
          note: "Brief spring swarm preparation pulse on the ridge",
        }),
      ]),
    }),

    Object.freeze({
      key: "roc-01",
      locationKey: "roc",
      name: "Lake Ontario Hive",
      notes: "Rochester lakeshore hive with steadier brood temperatures near the lake",
      installedAt: "2024-11-01T13:30:00.000Z",
      deviceInstalledAt: "2024-11-01T13:30:00.000Z",
      internal: Object.freeze({
        baselineTempF: 95.1,
        strength: 0.88,
        broodDailyAmplitudeF: 0.28,
        broodSeasonalAmplitudeF: 0.22,
        winterClusterTempF: 91.2,
        winterExternalSensitivity: 0.06,
        activeExternalSensitivity: 0.026,
        sensorPlacementOffsetF: 0.05,
        phaseShiftHours: 0.5,
      }),
      rssi: Object.freeze({
        baselineDbm: -62,
        dailyAmplitudeDb: 6,
        noiseDb: 2,
      }),
      scenarios: Object.freeze([
        Object.freeze({
          type: "swarm",
          start: "2026-05-22T16:30:00.000Z",
          durationMinutes: 60,
          intensity: 0.68,
          note: "Short spring swarm preparation pulse on the lakeshore",
        }),
      ]),
    }),

    Object.freeze({
      key: "roc-02",
      locationKey: "roc",
      name: "Highland Park Hive",
      notes: "Rochester city-park hive with a brief signal dip and a probe disturbance",
      installedAt: "2024-11-01T13:45:00.000Z",
      deviceInstalledAt: "2024-11-01T13:45:00.000Z",
      internal: Object.freeze({
        baselineTempF: 94.6,
        strength: 0.71,
        broodDailyAmplitudeF: 0.48,
        broodSeasonalAmplitudeF: 0.34,
        winterClusterTempF: 89.7,
        winterExternalSensitivity: 0.11,
        activeExternalSensitivity: 0.034,
        sensorPlacementOffsetF: -0.25,
        phaseShiftHours: 2.2,
      }),
      rssi: Object.freeze({
        baselineDbm: -70,
        dailyAmplitudeDb: 8,
        noiseDb: 3,
      }),
      scenarios: Object.freeze([
        Object.freeze({
          type: "weak_signal",
          start: "2026-05-30T11:00:00.000Z",
          durationMinutes: 720,
          intensity: 0.46,
          note: "Storm system briefly reduces gateway signal at the park",
        }),
        Object.freeze({
          type: "sensor_issue",
          start: "2026-06-10T09:00:00.000Z",
          durationMinutes: 30,
          intensity: 0.84,
          direction: "drop",
          note: "Brief loose-probe drop during a wet, cool morning",
        }),
      ]),
    }),

    Object.freeze({
      key: "roc-03",
      locationKey: "roc",
      name: "Erie Canal Hive",
      notes: "Rochester canal-side hive with a multi-day brood decline after a wet stretch",
      installedAt: "2024-11-01T14:00:00.000Z",
      deviceInstalledAt: "2024-11-01T14:00:00.000Z",
      internal: Object.freeze({
        baselineTempF: 94.9,
        strength: 0.76,
        broodDailyAmplitudeF: 0.52,
        broodSeasonalAmplitudeF: 0.36,
        winterClusterTempF: 90.4,
        winterExternalSensitivity: 0.09,
        activeExternalSensitivity: 0.032,
        sensorPlacementOffsetF: -0.1,
        phaseShiftHours: 2.6,
      }),
      rssi: Object.freeze({
        baselineDbm: -68,
        dailyAmplitudeDb: 8,
        noiseDb: 3,
      }),
      scenarios: Object.freeze([
        Object.freeze({
          type: "brood_decline",
          start: "2026-06-05T04:00:00.000Z",
          durationMinutes: 4320,
          intensity: 0.5,
          note: "Slow brood decline after a wet, cool stretch along the canal",
        }),
      ]),
    }),
  ]),
});
