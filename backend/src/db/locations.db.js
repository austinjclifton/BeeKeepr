"use strict";
const { query } = require("./pool");

/**
 * Get a location by its id
 */
exports.findById = async ({ locationId }) => {
  const rows = await query(
    `
    SELECT id, name, lat, lon, lat_e6, lon_e6, created_at, updated_at
    FROM location
    WHERE id = $1
    LIMIT 1
    `,
    [locationId],
  );

  return rows[0] ?? null;
};

/**
 * Get a location by its lat/lon E6 coordinates
 */
exports.findByLatLonE6 = async ({ latE6, lonE6 }) => {
  const rows = await query(
    `
    SELECT id, name, lat, lon, lat_e6, lon_e6, created_at, updated_at
    FROM location
    WHERE lat_e6 = $1
      AND lon_e6 = $2
    LIMIT 1
    `,
    [latE6, lonE6],
  );

  return rows[0] ?? null;
};

/**
 * Get the coordinates of a location by its id
 */
exports.getCoordsById = async ({ locationId }) => {
  const rows = await query(
    `
    SELECT id, lat, lon, lat_e6, lon_e6
    FROM location
    WHERE id = $1
    LIMIT 1
    `,
    [locationId],
  );

  return rows[0] ?? null;
};

/**
 * List all stored locations
 */
exports.listLocations = async ({ limit, order }) => {
  const orderSql = toOrderSql(order);
  const limitVal = toLimitValue(limit, 1000);

  return query(
    `
    SELECT id, name, lat, lon, lat_e6, lon_e6, created_at, updated_at
    FROM location
    ORDER BY created_at ${orderSql}, id ${orderSql}
    LIMIT $1
    `,
    [limitVal],
  );
};

/**
 * List locations that contain owned hives
 */
exports.listOwnedByBeekeeper = async ({ beekeeperId }) => {
  return query(
    `
    SELECT DISTINCT
      l.id,
      l.name,
      l.lat,
      l.lon
    FROM hive h
    JOIN location l
      ON l.id = h.location_id
    WHERE h.beekeeper_id = $1
    ORDER BY l.name ASC NULLS LAST, l.id ASC
    `,
    [beekeeperId],
  );
};

/**
 * Create a location if it doesn't exist, otherwise return the existing row
 */
exports.createOrGetLocation = async ({ name, lat, lon, latE6, lonE6 }) => {
  try {
    const rows = await query(
      `
      WITH ins AS (
        INSERT INTO location (name, lat, lon)
        VALUES ($1, $2, $3)
        ON CONFLICT (lat_e6, lon_e6) DO NOTHING
        RETURNING id, name, lat, lon, lat_e6, lon_e6, created_at, updated_at
      )
      SELECT * FROM ins
      UNION ALL
      SELECT id, name, lat, lon, lat_e6, lon_e6, created_at, updated_at
      FROM location
      WHERE lat_e6 = $4
        AND lon_e6 = $5
      LIMIT 1
      `,
      [name ?? null, lat, lon, latE6, lonE6],
    );

    return rows[0] ?? null;
  } catch (err) {
    throw mapPgError(err) ?? err;
  }
};

/**
 * Update a location's data (scoped)
 */
exports.update = async ({ locationId, name, lat, lon }) => {
  const set = [];
  const values = [];
  let i = 1;

  if (name !== undefined) {
    set.push(`name = $${i++}`);
    values.push(name);
  }

  if (lat !== undefined) {
    set.push(`lat = $${i++}`);
    values.push(lat);
  }

  if (lon !== undefined) {
    set.push(`lon = $${i++}`);
    values.push(lon);
  }

  if (set.length === 0) {
    return exports.findById({ locationId });
  }

  values.push(locationId);

  try {
    const rows = await query(
      `
      UPDATE location
      SET ${set.join(", ")}
      WHERE id = $${i++}
      RETURNING id, name, lat, lon, lat_e6, lon_e6, created_at, updated_at
      `,
      values,
    );

    return rows[0] ?? null;
  } catch (err) {
    throw mapPgError(err) ?? err;
  }
};

/**
 * Delete a location by its id
 */
exports.remove = async ({ locationId }) => {
  const rows = await query(
    `
    DELETE FROM location
    WHERE id = $1
    RETURNING id
    `,
    [locationId],
  );

  return rows.length > 0;
};



/* ========================================================================== */
/* Helpers                                                                     */
/* ========================================================================== */

function toOrderSql(order) {
  const o = String(order ?? "desc")
    .toLowerCase()
    .trim();
  if (o === "asc") return "ASC";
  if (o === "desc") return "DESC";
  return "DESC";
}

function toLimitValue(limit, fallback = 1000) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return Math.min(i, 100000);
}

function mapPgError(err) {
  if (!err?.code) return null;

  if (err.code === "23505") {
    const e = new Error("Location already exists at lat/lon");
    e.status = 409;
    e.code = "DUPLICATE_LOCATION";
    return e;
  }

  if (err.code === "22003" || err.code === "22P02") {
    const e = new Error("Invalid location values");
    e.status = 400;
    e.code = "INVALID_LOCATION";
    return e;
  }

  return null;
}
