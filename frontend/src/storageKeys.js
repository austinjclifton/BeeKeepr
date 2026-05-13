export const SETTINGS_PREF_KEY = 'beekeepr_settings_v1';
export const LEGACY_SETTINGS_PREF_KEY = 'asheville_settings_v1';
export const THRESHOLDS_SYNC_KEY = 'beekeepr_thresholds_synced_v1';
export const LEGACY_THRESHOLDS_SYNC_KEY = 'asheville_thresholds_synced_v1';
export const ANALYTICS_RANGE_KEY = 'beekeepr_analytics_range_v1';
export const LEGACY_ANALYTICS_RANGE_KEY = 'asheville_analytics_range_v1';

export function readMigratedJson(primaryKey, legacyKey) {
  try {
    const raw = localStorage.getItem(primaryKey);
    if (raw) return JSON.parse(raw);

    const legacyRaw = localStorage.getItem(legacyKey);
    if (!legacyRaw) return null;

    localStorage.setItem(primaryKey, legacyRaw);
    localStorage.removeItem(legacyKey);
    return JSON.parse(legacyRaw);
  } catch {
    return null;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { }
}

export function readMigratedFlag(primaryKey, legacyKey) {
  try {
    const value = localStorage.getItem(primaryKey);
    if (value) return value;

    const legacyValue = localStorage.getItem(legacyKey);
    if (!legacyValue) return null;

    localStorage.setItem(primaryKey, legacyValue);
    localStorage.removeItem(legacyKey);
    return legacyValue;
  } catch {
    return null;
  }
}

export function writeFlag(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch { }
}
