// Shared auth state
let csrfToken = null;
let _currentUser = null;
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function setCsrfToken(token) {
  csrfToken = token;
}

export function getCsrfToken() {
  return csrfToken;
}

export function setCurrentUser(user) {
  _currentUser = user;
}

export function getCurrentUser() {
  return _currentUser;
}

// Shared JSON fetch
export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (csrfToken && options.method && options.method !== 'GET') {
    headers['X-CSRF-Token'] = csrfToken;
  }
  const res = await fetch(apiUrl(path), { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json();
}

export function apiUrl(path) {
  if (!apiBaseUrl || /^https?:\/\//i.test(path)) return path;
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function cToF(c) {
  if (c == null) return null;
  return parseFloat(parseFloat(c).toFixed(1));
}

// Analytics query helpers
const ANALYTICS_RANGES = new Set(['1d', '3d', '7d', '1m']);
const ANALYTICS_BUCKETS = new Set(['auto', '10m', '30m', 'hour', '6h', 'day']);

function normalizeAnalyticsRange(range) {
  const value = String(range || '1d').toLowerCase();
  if (!ANALYTICS_RANGES.has(value)) {
    throw new Error('Invalid analytics range');
  }
  return value;
}

function buildAnalyticsQuery(input = '1d') {
  const params = new URLSearchParams();

  if (typeof input === 'string' || input == null) {
    params.set('range', normalizeAnalyticsRange(input));
    return params.toString();
  }

  const range = input.range ? normalizeAnalyticsRange(input.range) : null;
  const hasStart = input.start != null && String(input.start).trim() !== '';
  const hasEnd = input.end != null && String(input.end).trim() !== '';

  if (range && (hasStart || hasEnd)) {
    throw new Error('Use either a preset range or custom start/end dates');
  }

  if (range) {
    params.set('range', range);
    appendAnalyticsExtras(params, input);
    return params.toString();
  }

  if (!hasStart || !hasEnd) {
    throw new Error('Custom analytics queries require start and end');
  }

  const start = normalizeDateParam(input.start, 'start');
  const end = normalizeDateParam(input.end, 'end');
  if (start.getTime() >= end.getTime()) {
    throw new Error('Start date must be before end date');
  }

  params.set('start', start.toISOString());
  params.set('end', end.toISOString());
  appendAnalyticsExtras(params, input);
  return params.toString();
}

function appendAnalyticsExtras(params, input) {
  if (input.bucket && input.bucket !== 'auto') {
    const bucket = String(input.bucket).toLowerCase();
    if (!ANALYTICS_BUCKETS.has(bucket)) {
      throw new Error('Invalid analytics bucket');
    }
    params.set('bucket', bucket);
  }

  if (input.locationId != null && String(input.locationId).trim() !== '') {
    params.set('locationId', String(requirePositiveId(input.locationId, 'locationId')));
  }
}

function normalizeDateParam(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid date`);
  }
  return date;
}

function requirePositiveId(value, name) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return id;
}

// Analytics requests
export function getHiveStatus(query = '1d') {
  return apiFetch(`/api/hives/status?${buildAnalyticsQuery(query)}`);
}

export function getHiveLatestReading(hiveId) {
  const id = requirePositiveId(hiveId, 'hiveId');
  return apiFetch(`/api/hives/${id}/readings/latest`);
}

export function getHiveAnalyticsSummary(hiveId, query = '1d') {
  const id = requirePositiveId(hiveId, 'hiveId');
  return apiFetch(`/api/hives/${id}/analytics/summary?${buildAnalyticsQuery(query)}`);
}

export function getHiveTemperatureSeries(hiveId, query = '1d') {
  const id = requirePositiveId(hiveId, 'hiveId');
  return apiFetch(`/api/hives/${id}/analytics/temperature?${buildAnalyticsQuery(query)}`);
}

export function getHiveComparison(hiveIds, query = '1d') {
  const ids = Array.from(new Set((hiveIds || []).map(id => requirePositiveId(id, 'hiveId'))));
  if (!ids.length) {
    throw new Error('At least one hive is required');
  }
  return apiFetch(`/api/analytics/hives/compare?${buildAnalyticsQuery(query)}&hiveIds=${encodeURIComponent(ids.join(','))}`);
}

export function getAnalyticsLocations() {
  return apiFetch('/api/analytics/locations');
}

export function getDashboardHiveTemperature24h(hiveId) {
  const id = requirePositiveId(hiveId, 'hiveId');
  return apiFetch(`/api/hives/${id}/dashboard/temperature-24h`);
}

export function getDashboardFleetTemperature24h({ locationId } = {}) {
  const params = new URLSearchParams();
  if (locationId != null && String(locationId).trim() !== '') {
    params.set('locationId', String(requirePositiveId(locationId, 'locationId')));
  }
  const qs = params.toString();
  return apiFetch(`/api/analytics/dashboard/fleet-temperature-24h${qs ? `?${qs}` : ''}`);
}

// CSV export helpers
export async function downloadAnalyticsCsv(params = {}) {
  const url = buildAnalyticsExportUrl(params);
  const res = await fetch(apiUrl(url), { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || res.statusText);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename="([^"]+)"/i);
  return {
    blob,
    filename: filenameMatch?.[1] || 'beekeepr-export.csv',
  };
}

export function buildAnalyticsExportUrl(params = {}) {
  const qs = new URLSearchParams();
  qs.set('scope', params.scope || 'user');

  if (params.hiveId) qs.set('hiveId', String(requirePositiveId(params.hiveId, 'hiveId')));
  if (params.locationId) qs.set('locationId', String(requirePositiveId(params.locationId, 'locationId')));
  if (params.start) qs.set('start', normalizeDateParam(params.start, 'start').toISOString());
  if (params.end) qs.set('end', normalizeDateParam(params.end, 'end').toISOString());

  for (const key of ['includeReadings', 'includeExternal', 'includeHiveDevice', 'includeAlerts']) {
    if (params[key] !== undefined) qs.set(key, params[key] ? 'true' : 'false');
  }

  return `/api/analytics/export.csv?${qs.toString()}`;
}

// Alert and device requests
export function getLatestExternalCondition(hiveId) {
  const id = requirePositiveId(hiveId, 'hiveId');
  return apiFetch(`/api/external-conditions/latest?hiveId=${encodeURIComponent(id)}`);
}

export function getAlerts({ hiveId } = {}) {
  const id = hiveId ? requirePositiveId(hiveId, 'hiveId') : null;
  return apiFetch(`/api/alerts${id ? `?hiveId=${encodeURIComponent(id)}` : ''}`);
}

export function resolveAlert(alertId) {
  const id = requirePositiveId(alertId, 'alertId');
  return apiFetch(`/api/alerts/${id}/resolve`, { method: 'PATCH' });
}

export function getHiveDevices(hiveId) {
  const id = requirePositiveId(hiveId, 'hiveId');
  return apiFetch(`/api/hives/${id}/devices`);
}

// UI-friendly error text
export function friendlyApiMessage(err, fallback = 'Something went wrong') {
  if (err?.message === 'Demo account is read-only') {
    return 'This demo account is read-only. You can explore the data, but edits are disabled.';
  }
  return err?.message || fallback;
}
