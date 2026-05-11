"use strict";
const { query } = require("./pool");

/**
 * Create a new hive record
 */
exports.create = async ({
  beekeeperId,
  name,
  notes,
  locationId,
  status,
  installedAt,
  archivedAt,
  warningLowThreshold,
  warningHighThreshold,
  criticalLowThreshold,
  criticalHighThreshold,
}) => {
  const rows = await query(
    `
    INSERT INTO hive (
      beekeeper_id,
      name,
      notes,
      location_id,
      status,
      installed_at,
      archived_at,
      warning_low_threshold,
      warning_high_threshold,
      critical_low_threshold,
      critical_high_threshold
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
    `,
    [
      beekeeperId,
      name,
      notes ?? null,
      locationId ?? null,
      status,
      installedAt,
      archivedAt,
      warningLowThreshold,
      warningHighThreshold,
      criticalLowThreshold,
      criticalHighThreshold,
    ],
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
 * Find scoped hives by ids, preserving requested order
 */
exports.findByIdsScoped = async ({ beekeeperId, hiveIds, locationId = null }) => {
  return query(
    `
    SELECT id, name, location_id
    FROM hive
    WHERE beekeeper_id = $1
      AND id = ANY($2::bigint[])
      AND ($3::bigint IS NULL OR location_id = $3)
    ORDER BY array_position($2::bigint[], id)
    `,
    [beekeeperId, hiveIds, locationId],
  );
};

/**
 * List active owned hives for analytics scope selection
 */
exports.listOwnedForScope = async ({ beekeeperId, locationId = null, limit = 10 }) => {
  return query(
    `
    SELECT
      h.id,
      h.name,
      h.location_id,
      MAX(r.bucket_at) AS latest_reading_at
    FROM hive h
    LEFT JOIN device d
      ON d.hive_id = h.id
    LEFT JOIN reading r
      ON r.device_id = d.id
    WHERE h.beekeeper_id = $1
      AND h.status = 'active'
      AND ($2::bigint IS NULL OR h.location_id = $2)
    GROUP BY h.id, h.name, h.location_id
    ORDER BY latest_reading_at DESC NULLS LAST, h.name ASC, h.id ASC
    LIMIT $3
    `,
    [beekeeperId, locationId, limit],
  );
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
  status,
  installedAt,
  archivedAt,
  warningLowThreshold,
  warningHighThreshold,
  criticalLowThreshold,
  criticalHighThreshold,
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

  if (status !== undefined) {
    set.push(`status = $${i++}`);
    values.push(status);
  }

  if (installedAt !== undefined) {
    set.push(`installed_at = $${i++}`);
    values.push(installedAt);
  }

  if (archivedAt !== undefined) {
    set.push(`archived_at = $${i++}`);
    values.push(archivedAt);
  }

  if (warningLowThreshold !== undefined) {
    set.push(`warning_low_threshold = $${i++}`);
    values.push(warningLowThreshold);
  }

  if (warningHighThreshold !== undefined) {
    set.push(`warning_high_threshold = $${i++}`);
    values.push(warningHighThreshold);
  }

  if (criticalLowThreshold !== undefined) {
    set.push(`critical_low_threshold = $${i++}`);
    values.push(criticalLowThreshold);
  }

  if (criticalHighThreshold !== undefined) {
    set.push(`critical_high_threshold = $${i++}`);
    values.push(criticalHighThreshold);
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
