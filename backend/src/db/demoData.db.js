"use strict";

const { withTransaction } = require("./pool.js");

exports.pruneStaleDemoData = async function pruneStaleDemoData({
  beekeeperId,
  configuredHiveNames,
  configuredLocations,
  provider,
  removeUnusedLocations = true,
}) {
  const hiveNames = normalizeHiveNames(configuredHiveNames);
  const locationPayload = JSON.stringify(normalizeConfiguredLocations(configuredLocations));

  return withTransaction(async (client) => {
    const staleHiveResult = await client.query(
      `
      SELECT
        h.id AS hive_id,
        h.name,
        h.location_id
      FROM hive h
      WHERE h.beekeeper_id = $1
        AND NOT (h.name = ANY($2::text[]))
      ORDER BY h.id ASC
      `,
      [beekeeperId, hiveNames],
    );

    const staleHives = staleHiveResult.rows.map((row) => ({
      hiveId: Number(row.hive_id),
      name: row.name,
      locationId: row.location_id == null ? null : Number(row.location_id),
    }));
    const deleted = createDeleteSummary();

    if (staleHives.length > 0) {
      const hiveIds = staleHives.map((hive) => hive.hiveId);
      const dependencyCountsResult = await client.query(
        `
        SELECT
          (
            SELECT COUNT(*)::bigint
            FROM device d
            WHERE d.hive_id = ANY($1::bigint[])
          ) AS devices,
          (
            SELECT COUNT(*)::bigint
            FROM reading r
            WHERE EXISTS (
              SELECT 1
              FROM device d
              WHERE d.id = r.device_id
                AND d.hive_id = ANY($1::bigint[])
            )
          ) AS readings,
          (
            SELECT COUNT(*)::bigint
            FROM alert a
            WHERE EXISTS (
              SELECT 1
              FROM reading r
              JOIN device d
                ON d.id = r.device_id
              WHERE r.id = a.reading_id
                AND d.hive_id = ANY($1::bigint[])
            )
          ) AS alerts
        `,
        [hiveIds],
      );

      const dependencyCounts = dependencyCountsResult.rows[0] || {};
      deleted.devices = toCount(dependencyCounts.devices);
      deleted.readings = toCount(dependencyCounts.readings);
      deleted.alerts = toCount(dependencyCounts.alerts);

      const deletedHivesResult = await client.query(
        `
        DELETE FROM hive
        WHERE beekeeper_id = $1
          AND id = ANY($2::bigint[])
        RETURNING id
        `,
        [beekeeperId, hiveIds],
      );
      deleted.hives = deletedHivesResult.rowCount;
    }

    const prunableLocationResult = await client.query(
      `
      WITH configured AS (
        SELECT DISTINCT
          round(c.lat * 1000000)::int AS lat_e6,
          round(c.lon * 1000000)::int AS lon_e6
        FROM jsonb_to_recordset($1::jsonb) AS c(
          lat double precision,
          lon double precision,
          name text
        )
      )
      SELECT
        l.id,
        l.name,
        l.lat,
        l.lon
      FROM location l
      WHERE NOT EXISTS (
        SELECT 1
        FROM hive h
        WHERE h.location_id = l.id
      )
        AND NOT EXISTS (
          SELECT 1
          FROM configured c
          WHERE c.lat_e6 = l.lat_e6
            AND c.lon_e6 = l.lon_e6
        )
        AND (
          EXISTS (
            SELECT 1
            FROM external_condition ec
            WHERE ec.location_id = l.id
              AND ec.provider = $2
          )
          OR COALESCE(l.name, '') ILIKE '%Demo Yard%'
        )
      ORDER BY l.id ASC
      `,
      [locationPayload, provider],
    );

    const prunableLocations = prunableLocationResult.rows.map((row) => ({
      locationId: Number(row.id),
      name: row.name,
      lat: Number(row.lat),
      lon: Number(row.lon),
    }));

    const deletedLocations = [];
    if (removeUnusedLocations && prunableLocations.length > 0) {
      const locationIds = prunableLocations.map((location) => location.locationId);
      const deletedExternalResult = await client.query(
        `
        DELETE FROM external_condition
        WHERE location_id = ANY($1::bigint[])
        RETURNING id
        `,
        [locationIds],
      );
      deleted.externalConditions = deletedExternalResult.rowCount;

      const deletedLocationsResult = await client.query(
        `
        DELETE FROM location
        WHERE id = ANY($1::bigint[])
        RETURNING id, name, lat, lon
        `,
        [locationIds],
      );
      deleted.locations = deletedLocationsResult.rowCount;

      for (const row of deletedLocationsResult.rows) {
        deletedLocations.push({
          locationId: Number(row.id),
          name: row.name,
          lat: Number(row.lat),
          lon: Number(row.lon),
        });
      }
    }

    return {
      deleted,
      staleHives,
      deletedLocations,
      prunableLocations: removeUnusedLocations ? [] : prunableLocations,
    };
  });
};

exports.resetDemoRuntimeData = async function resetDemoRuntimeData({
  beekeeperId,
  configuredLocations,
}) {
  const locationPayload = JSON.stringify(normalizeConfiguredLocations(configuredLocations));

  return withTransaction(async (client) => {
    const deleted = createDeleteSummary();

    const deletedAlertsResult = await client.query(
      `
      DELETE FROM alert
      WHERE beekeeper_id = $1
      RETURNING id
      `,
      [beekeeperId],
    );
    deleted.alerts = deletedAlertsResult.rowCount;

    const deletedReadingsResult = await client.query(
      `
      DELETE FROM reading r
      USING device d, hive h
      WHERE r.device_id = d.id
        AND d.hive_id = h.id
        AND h.beekeeper_id = $1
      RETURNING r.id
      `,
      [beekeeperId],
    );
    deleted.readings = deletedReadingsResult.rowCount;

    const configuredLocationResult = await client.query(
      `
      WITH configured AS (
        SELECT DISTINCT
          round(c.lat * 1000000)::int AS lat_e6,
          round(c.lon * 1000000)::int AS lon_e6
        FROM jsonb_to_recordset($1::jsonb) AS c(
          lat double precision,
          lon double precision,
          name text
        )
      )
      SELECT
        l.id,
        l.name,
        l.lat,
        l.lon,
        EXISTS (
          SELECT 1
          FROM hive h
          WHERE h.location_id = l.id
            AND h.beekeeper_id <> $2
        ) AS has_other_hives
      FROM location l
      JOIN configured c
        ON c.lat_e6 = l.lat_e6
       AND c.lon_e6 = l.lon_e6
      ORDER BY l.id ASC
      `,
      [locationPayload, beekeeperId],
    );

    const resetLocations = [];
    const sharedLocationsSkipped = [];

    for (const row of configuredLocationResult.rows) {
      const location = {
        locationId: Number(row.id),
        name: row.name,
        lat: Number(row.lat),
        lon: Number(row.lon),
      };

      if (row.has_other_hives === true) {
        sharedLocationsSkipped.push(location);
      } else {
        resetLocations.push(location);
      }
    }

    if (resetLocations.length > 0) {
      const deletedExternalResult = await client.query(
        `
        DELETE FROM external_condition
        WHERE location_id = ANY($1::bigint[])
        RETURNING id
        `,
        [resetLocations.map((location) => location.locationId)],
      );
      deleted.externalConditions = deletedExternalResult.rowCount;
    }

    return {
      deleted,
      resetLocations,
      sharedLocationsSkipped,
    };
  });
};

function createDeleteSummary() {
  return {
    alerts: 0,
    readings: 0,
    devices: 0,
    hives: 0,
    externalConditions: 0,
    locations: 0,
  };
}

function normalizeHiveNames(values) {
  if (!Array.isArray(values)) return [];

  return values
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeConfiguredLocations(values) {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => ({
      name: value?.name ?? null,
      lat: Number(value?.lat),
      lon: Number(value?.lon),
    }))
    .filter((value) => Number.isFinite(value.lat) && Number.isFinite(value.lon));
}

function toCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}