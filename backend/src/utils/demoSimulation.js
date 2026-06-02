"use strict";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const YEAR_DAYS = 365.2425;

const localTimeFormatterCache = new Map();

function floorToInterval(date, intervalMinutes) {
  const intervalMs = toIntervalMs(intervalMinutes);
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
}

function toIntervalMs(intervalMinutes) {
  const minutes = Number(intervalMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("intervalMinutes must be a positive number");
  }

  return Math.floor(minutes) * MINUTE_MS;
}

function subtractUtcMonths(date, months) {
  const value = new Date(date);
  value.setUTCMonth(value.getUTCMonth() - months);
  return value;
}

function buildExternalCondition(location, bucketAtDate) {
  const local = getLocalTimeParts(bucketAtDate, location.timeZone);
  const climate = location.climate;
  const localHour = local.hour + local.minute / 60;
  const seasonalWave = Math.cos(
    (Math.PI * 2 * (local.dayOfYear - climate.peakDayOfYear)) / YEAR_DAYS,
  );
  const warmth = (seasonalWave + 1) / 2;
  const dailyWave = Math.cos(
    (Math.PI * 2 * (localHour - climate.dailyPeakHour)) / 24,
  );
  const dailyAmplitude = lerp(
    climate.winterDailyAmplitudeF,
    climate.summerDailyAmplitudeF,
    warmth,
  );
  const synopticNoise = smoothNoise(`${location.key}:synoptic`, bucketAtDate, 5 * DAY_MS);
  const shortNoise = smoothNoise(`${location.key}:short`, bucketAtDate, 18 * 60 * MINUTE_MS);
  const stormNoise = smoothNoise(`${location.key}:storm`, bucketAtDate, 3 * DAY_MS);

  const temperature = roundToOne(
    climate.averageTempF +
    climate.seasonalAmplitudeF * seasonalWave +
    dailyAmplitude * dailyWave +
    climate.synopticNoiseF * synopticNoise +
    climate.shortNoiseF * shortNoise,
  );
  const cloudPct = roundToOne(
    clamp(42 - 17 * dailyWave + 18 * stormNoise + 10 * (1 - warmth), 4, 98),
  );
  const humidityPct = roundToOne(
    clamp(
      climate.humidityBasePct -
      climate.humidityAmplitudePct * dailyWave +
      0.22 * cloudPct +
      6 * (1 - warmth),
      24,
      98,
    ),
  );
  const windMps = roundToOne(
    clamp(
      climate.windBaseMps +
      climate.windAmplitudeMps * ((1 - dailyWave) / 2) +
      0.6 * smoothNoise(`${location.key}:wind`, bucketAtDate, 36 * 60 * MINUTE_MS),
      0.3,
      13,
    ),
  );
  const windGustMps = roundToOne(
    clamp(windMps + 0.7 + Math.max(0, stormNoise) * 2.2, windMps, 18),
  );
  const precipMm = cloudPct >= 86 && stormNoise > 0.25
    ? roundToOne(((cloudPct - 84) / 18) * (0.6 + stormNoise))
    : 0;
  const pressureHpa = roundToOne(
    clamp(
      climate.pressureBaseHpa -
      4.5 * stormNoise +
      1.4 * smoothNoise(`${location.key}:pressure`, bucketAtDate, 7 * DAY_MS),
      960,
      1045,
    ),
  );

  return {
    temperature,
    humidityPct,
    precipMm,
    windMps,
    windGustMps,
    pressureHpa,
    cloudPct,
  };
}

function buildReadingInput({ hive, location, bucketAtDate, externalCondition }) {
  const local = getLocalTimeParts(bucketAtDate, location.timeZone);
  const internal = hive.internal;
  const climate = location.climate;
  const localHour = local.hour + local.minute / 60;
  const broodActivity = getBroodActivity({
    dayOfYear: local.dayOfYear,
    startDay: climate.broodStartDay,
    endDay: climate.broodEndDay,
  });
  const dailyWave = Math.cos(
    (Math.PI * 2 * (localHour - 14 - internal.phaseShiftHours)) / 24,
  );
  const broodSeasonWave = smoothNoise(
    `${hive.key}:brood-season`,
    bucketAtDate,
    28 * DAY_MS,
  );
  const broodTarget =
    internal.baselineTempF +
    internal.sensorPlacementOffsetF +
    internal.broodDailyAmplitudeF * dailyWave +
    internal.broodSeasonalAmplitudeF * broodSeasonWave +
    internal.activeExternalSensitivity *
    (externalCondition.temperature - climate.averageTempF);
  const coldPressure = Math.min(
    0,
    externalCondition.temperature - climate.coldStressTempF,
  );
  const winterNoise =
    smoothNoise(`${hive.key}:winter-6h`, bucketAtDate, 6 * 60 * MINUTE_MS) *
    (0.5 + (1 - internal.strength) * 1.2) +
    smoothNoise(`${hive.key}:winter-2d`, bucketAtDate, 2 * DAY_MS) *
    (0.6 + (1 - internal.strength) * 1.5);
  const winterTarget =
    internal.winterClusterTempF +
    internal.sensorPlacementOffsetF +
    1.2 * (internal.strength - 0.75) +
    internal.winterExternalSensitivity * coldPressure +
    winterNoise;
  const activeNoise =
    smoothNoise(`${hive.key}:active-8h`, bucketAtDate, 8 * 60 * MINUTE_MS) *
    (0.08 + (1 - internal.strength) * 0.18);
  let temperature = lerp(winterTarget, broodTarget + activeNoise, broodActivity);

  // Add a tiny deterministic high-frequency component so 10-minute buckets
  // do not quantize into long flat runs after rounding.
  const continuityPhase = hashUnit(`${hive.key}:continuity-phase`);
  const continuityWave = Math.sin(
    Math.PI * 2 * (bucketAtDate.getTime() / (130 * MINUTE_MS) + continuityPhase),
  );
  const microPhase = hashUnit(`${hive.key}:micro-phase`);
  const microWave = Math.sin(
    Math.PI * 2 * (bucketAtDate.getTime() / (47 * MINUTE_MS) + microPhase),
  );
  temperature += continuityWave * (0.03 + (1 - internal.strength) * 0.02);
  temperature += microWave * (0.018 + (1 - internal.strength) * 0.013);

  const signalWave = Math.sin(
    (Math.PI * 2 * (localHour + internal.phaseShiftHours)) / 24,
  );
  let rssi =
    hive.rssi.baselineDbm -
    ((signalWave + 1) / 2) * hive.rssi.dailyAmplitudeDb +
    hive.rssi.noiseDb *
    smoothNoise(`${hive.key}:rssi`, bucketAtDate, 12 * 60 * MINUTE_MS);

  const activeScenarios = getActiveScenarioOverlays({
    hive,
    location,
    bucketAtDate,
    externalCondition,
  });

  for (const scenario of activeScenarios) {
    const intensity = scenario.intensity;
    const envelope = scenario.envelope;

    if (scenario.type === "swarm") {
      temperature += (4.5 + intensity * 6.5) * scenario.bell;
    } else if (scenario.type === "heat_stress") {
      const heatFactor = clamp(
        (externalCondition.temperature - climate.heatStressTempF + 8) / 16,
        0.35,
        1.3,
      );
      temperature += (2.4 + intensity * 5.4) * envelope * heatFactor;
    } else if (scenario.type === "cold_stress") {
      const coldFactor = clamp(
        (climate.coldStressTempF - externalCondition.temperature + 8) / 18,
        0.35,
        1.4,
      );
      temperature -= (2.8 + intensity * 6.8) * envelope * coldFactor;
    } else if (scenario.type === "brood_decline" || scenario.type === "queen_issue") {
      temperature -= (1.4 + intensity * 3.6) * envelope;
      temperature +=
        (0.8 + intensity * 1.5) *
        envelope *
        smoothNoise(`${hive.key}:${scenario.type}:${scenario.start}`, bucketAtDate, 9 * 60 * MINUTE_MS);
    } else if (scenario.type === "sensor_issue") {
      const sign = scenario.direction === "spike" ? 1 : -1;
      temperature += sign * (10 + intensity * 18) * scenario.bell;
    } else if (scenario.type === "weak_signal") {
      rssi -= (10 + intensity * 28) * envelope;
    }
  }

  return {
    temperature: roundToTwo(clamp(temperature, -40, 140)),
    rssi: Math.round(clamp(rssi, -125, -35)),
    scenarios: activeScenarios.map((scenario) => ({
      type: scenario.type,
      note: scenario.note,
    })),
  };
}

function getActiveScenarioOverlays({
  hive,
  location,
  bucketAtDate,
  externalCondition,
}) {
  const scenarios = Array.isArray(hive.scenarios) ? hive.scenarios : [];
  const active = [];

  for (const scenario of scenarios) {
    const start = new Date(scenario.start);
    const durationMinutes = Number(scenario.durationMinutes);
    if (Number.isNaN(start.getTime()) || !Number.isFinite(durationMinutes)) {
      continue;
    }

    const elapsedMs = bucketAtDate.getTime() - start.getTime();
    const durationMs = durationMinutes * MINUTE_MS;
    if (elapsedMs < 0 || elapsedMs > durationMs) {
      continue;
    }

    const progress = durationMs === 0 ? 1 : clamp(elapsedMs / durationMs, 0, 1);
    const envelope = windowEnvelope(progress, durationMinutes);
    const bell = Math.sin(Math.PI * progress);

    active.push({
      type: scenario.type,
      start: scenario.start,
      note: scenario.note || null,
      direction: scenario.direction,
      intensity: clamp(Number(scenario.intensity ?? 1), 0, 1.5),
      envelope,
      bell,
      locationKey: location.key,
      externalTemperature: externalCondition.temperature,
    });
  }

  return active;
}

function getBroodActivity({ dayOfYear, startDay, endDay }) {
  const rampDays = 24;

  if (startDay <= endDay) {
    return Math.min(
      smoothstep((dayOfYear - startDay) / rampDays),
      smoothstep((endDay - dayOfYear) / rampDays),
    );
  }

  return Math.max(
    smoothstep((dayOfYear - startDay) / rampDays),
    smoothstep((endDay - dayOfYear) / rampDays),
  );
}

function windowEnvelope(progress, durationMinutes) {
  if (durationMinutes <= 90) {
    return Math.sin(Math.PI * progress);
  }

  const ramp = Math.min(0.18, Math.max(0.03, 60 / durationMinutes));
  const up = smoothstep(progress / ramp);
  const down = smoothstep((1 - progress) / ramp);
  return Math.min(up, down);
}

function smoothNoise(seed, date, periodMs) {
  const x = date.getTime() / periodMs;
  const left = Math.floor(x);
  const fraction = x - left;
  const a = hashUnit(`${seed}:${left}`) * 2 - 1;
  const b = hashUnit(`${seed}:${left + 1}`) * 2 - 1;

  return lerp(a, b, smoothstep(fraction));
}

function hashUnit(input) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function getLocalTimeParts(date, timeZone) {
  const formatter = getLocalTimeFormatter(timeZone);
  const values = Object.create(null);

  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    dayOfYear: getDayOfYear(values.year, values.month, values.day),
  };
}

function getLocalTimeFormatter(timeZone) {
  if (!localTimeFormatterCache.has(timeZone)) {
    localTimeFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }

  return localTimeFormatterCache.get(timeZone);
}

function getDayOfYear(year, month, day) {
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / DAY_MS) + 1;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

function smoothstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function roundToOne(value) {
  return Math.round(value * 10) / 10;
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  buildExternalCondition,
  buildReadingInput,
  floorToInterval,
  subtractUtcMonths,
  toIntervalMs,
};
