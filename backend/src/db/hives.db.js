"use strict";
const { query } = require("./pool");

/**
 * Create a new hive record
 */
exports.create = async ({ beekeeperId, name, notes, locationId }) => {
  const rows = await query(
    `
    INSERT INTO hive (beekeeper_id, name, notes, location_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [beekeeperId, name, notes ?? null, locationId ?? null],
  );

  return rows[0] ?? null;
};

/**
 * List hives for a beekeeper
 */
exports.listHivesByBeekeeper = async ({ beekeeperId }) => {
  return query(
    `
    SELECT *
    FROM hive
    WHERE beekeeper_id = $1
    ORDER BY created_at DESC, id DESC
    `,
    [beekeeperId],
  );
};

/**
 * Find a hive by id (scoped)
 */
exports.findByIdScoped = async ({ beekeeperId, hiveId }) => {
  const rows = await query(
    `
    SELECT *
    FROM hive
    WHERE id = $1
      AND beekeeper_id = $2
    LIMIT 1
    `,
    [hiveId, beekeeperId],
  );

  return rows[0] ?? null;
};

/**
 * Check hive existence (scoped)
 */
exports.existsScoped = async ({ beekeeperId, hiveId }) => {
  const rows = await query(
    `
    SELECT 1
    FROM hive
    WHERE id = $1
      AND beekeeper_id = $2
    LIMIT 1
    `,
    [hiveId, beekeeperId],
  );

  return rows.length > 0;
};

/**
 * Get the hive's location_id (scoped)
 */
exports.getLocationIdForHive = async ({ beekeeperId, hiveId }) => {
  const rows = await query(
    `
    SELECT location_id
    FROM hive
    WHERE id = $1
      AND beekeeper_id = $2
    LIMIT 1
    `,
    [hiveId, beekeeperId],
  );

  return rows[0] ?? null;
};

/**
 * Update a hive's data (scoped)
 */
exports.updateScoped = async ({
  beekeeperId,
  hiveId,
  name,
  notes,
  locationId,
}) => {
  const set = [];
  const values = [];
  let i = 1;

  if (name !== undefined) {
    set.push(`name = $${i++}`);
    values.push(name);
  }

  if (notes !== undefined) {
    set.push(`notes = $${i++}`);
    values.push(notes);
  }

  if (locationId !== undefined) {
    set.push(`location_id = $${i++}`);
    values.push(locationId);
  }

  if (set.length === 0) {
    return exports.findByIdScoped({ beekeeperId, hiveId });
  }

  values.push(hiveId, beekeeperId);

  const rows = await query(
    `
    UPDATE hive
    SET ${set.join(", ")}
    WHERE id = $${i++}
      AND beekeeper_id = $${i++}
    RETURNING *
    `,
    values,
  );

  return rows[0] ?? null;
};

/**
 * Delete a hive by its id (scoped)
 */
exports.removeScoped = async ({ beekeeperId, hiveId }) => {
  const rows = await query(
    `
    DELETE FROM hive
    WHERE id = $1
      AND beekeeper_id = $2
    RETURNING id
    `,
    [hiveId, beekeeperId],
  );

  return rows.length > 0;
};