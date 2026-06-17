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
 *       wny — Western New York Demo Yard       (Buffalo,  NY, America/New_York)
 *   - 5 hives (one device each):
 *       app-01  Blue Ridge Stable Hive
 *       app-02  Pisgah Orchard Hive
 *       wny-01  Lake Erie Stable Hive
 *       wny-02  Niagara Snowbelt Hive
 *       wny-03  Finger Lakes Variable Hive
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
    months: 18,
    intervalMinutes: 10,
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
      key: "wny",
      name: "Western New York Demo Yard",
      cityName: "Buffalo, NY",
      timeZone: "America/New_York",
      lat: 42.8864,
      lon: -78.8784,
      climate: Object.freeze({
        averageTempF: 49,
        seasonalAmplitudeF: 28,
        winterDailyAmplitudeF: 7,
        summerDailyAmplitudeF: 13,
        peakDayOfYear: 201,
        dailyPeakHour: 15.2,
        synopticNoiseF: 5.0,
        shortNoiseF: 1.3,
        humidityBasePct: 70,
        humidityAmplitudePct: 17,
        windBaseMps: 3.6,
        windAmplitudeMps: 1.9,
        pressureBaseHpa: 1014.8,
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
      name: "Blue Ridge Stable Hive",
      notes: "Appalachia demo hive with a stable brood temperature profile",
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
          type: "weak_signal",
          start: "2025-12-08T10:00:00.000Z",
          durationMinutes: 4320,
          intensity: 0.42,
          note: "Short ridge-line reception dip after winter weather",
        }),
      ]),
    }),

    Object.freeze({
      key: "app-02",
      locationKey: "app",
      name: "Pisgah Orchard Hive",
      notes: "Appalachia orchard hive with a short cold ridge-line disturbance",
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
          type: "sensor_issue",
          start: "2026-01-22T08:30:00.000Z",
          durationMinutes: 300,
          intensity: 0.74,
          direction: "drop",
          note: "Brief cold ridge-line disturbance captured by the probe",
        }),
        Object.freeze({
          type: "brood_decline",
          start: "2025-05-19T06:00:00.000Z",
          durationMinutes: 20160,
          intensity: 0.46,
          note: "Mild orchard brood regulation dip after a wet spring stretch",
        }),
      ]),
    }),

    Object.freeze({
      key: "wny-01",
      locationKey: "wny",
      name: "Lake Erie Stable Hive",
      notes: "Western New York hive with steadier brood temperatures near the lakeshore",
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
          start: "2026-05-09T17:30:00.000Z",
          durationMinutes: 60,
          intensity: 0.68,
          note: "Short spring swarm preparation pulse",
        }),
        Object.freeze({
          type: "weak_signal",
          start: "2025-12-14T11:00:00.000Z",
          durationMinutes: 5760,
          intensity: 0.58,
          note: "Lake-effect snow and icing weaken gateway reception",
        }),
      ]),
    }),

    Object.freeze({
      key: "wny-02",
      locationKey: "wny",
      name: "Niagara Snowbelt Hive",
      notes: "Western New York hive with stronger cold-season pressure and wider swings",
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
          type: "brood_decline",
          start: "2025-06-02T04:00:00.000Z",
          durationMinutes: 30240,
          intensity: 0.55,
          note: "Slow brood decline after a wet late spring",
        }),
        Object.freeze({
          type: "sensor_issue",
          start: "2026-03-06T14:20:00.000Z",
          durationMinutes: 30,
          intensity: 0.9,
          direction: "drop",
          note: "Brief loose-probe drop during a cold snap",
        }),
      ]),
    }),

    Object.freeze({
      key: "wny-03",
      locationKey: "wny",
      name: "Finger Lakes Variable Hive",
      notes: "Western New York demo hive with wider swings and occasional probe instability",
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
          type: "sensor_issue",
          start: "2025-10-10T01:40:00.000Z",
          durationMinutes: 20,
          intensity: 0.76,
          direction: "spike",
          note: "Brief warm spike from a loose probe during variable fall conditions",
        }),
        Object.freeze({
          type: "weak_signal",
          start: "2026-02-04T08:00:00.000Z",
          durationMinutes: 2160,
          intensity: 0.52,
          note: "Snow and terrain briefly reduce gateway signal strength",
        }),
      ]),
    }),
  ]),
});