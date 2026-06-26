export function getHiveId(hive) {
  const id = hive?.hiveId ?? hive?.id;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const EXTERNAL_TEMPERATURE_COLOR = '#22D3EE';

export function formatTemperature(value, precision = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(precision)}°F` : '—';
}

/**
 * Cell-formatter for **internal** hive temperature (Latest, Average, Min,
 * Max, Temperature Swing in the Fleet Status table). Always renders
 * exactly two decimal places so the row reads at a uniform width and the
 * 1/10 °F difference between adjacent hives is visible.
 *
 *   95.9   → "95.90°F"
 *   96.123 → "96.12°F"
 *   null   → "—"
 *
 * Defined as a separate helper (rather than a precision argument on
 * `formatTemperature`) so the call site reads as a clear intent: "this
 * column is internal hive temperature, give it the 2-decimal treatment".
 */
export function formatInternalTemperature(value) {
  return formatTemperature(value, 2);
}

/**
 * Cell-formatter for **external / outside** temperature. Always renders
 * exactly one decimal place, matching the convention used by the weather
 * strip and external-readout cards elsewhere in the app.
 *
 *   71.23  → "71.2°F"
 *   80     → "80.0°F"
 *   null   → "—"
 */
export function formatExternalTemperature(value) {
  return formatTemperature(value, 1);
}

/**
 * Format a temperature value for chart tooltip / readout contexts.
 *
 * Default behavior (`precision` omitted or `'auto'`) preserves up to two
 * decimal places of precision from the data and trims trailing zeros so
 * the readout reflects whatever precision the sensor actually carries:
 *
 *   95.42 → "95.42°F"
 *   73.8  → "73.8°F"
 *   90.0  → "90°F"    (true integer shows no decimal)
 *   95.4  → "95.4°F"
 *
 * Pass a numeric `precision` to force an exact number of decimal places
 * — used by the dashboard fleet chart so internal series always show 2
 * decimals and external series always show 1, regardless of how clean
 * the underlying number is.
 *
 * Renders "No data" for non-finite values (the chart-context equivalent of
 * "—" used in cells, since "—" reads as a typo inside a tooltip).
 */
export function formatChartTemperature(value, precision = 'auto') {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'No data';
  if (precision === 'auto') {
    // Round to 2 decimals first, then strip trailing zeros so we surface as
    // much precision as the data has, but no more. Also drops the decimal
    // point entirely when both fractional digits are zero.
    const fixed = n.toFixed(2);
    const trimmed = fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    return `${trimmed}°F`;
  }
  return `${n.toFixed(precision)}°F`;
}

export function formatCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '0';
}

// Compact number formatter for large values (1.2k, 169.4k, 1.2M).
// Safe to call on null/undefined — returns '—' in that case so it can be
// dropped straight into a strip without breaking the layout.
export function formatCompactNumber(value, { precision = 1, fallback = '—' } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const abs = Math.abs(n);
  if (abs < 1000) return String(n);

  const sign = n < 0 ? '-' : '';
  const units = [
    { threshold: 1e9, suffix: 'B' },
    { threshold: 1e6, suffix: 'M' },
    { threshold: 1e3, suffix: 'k' },
  ];

  for (const { threshold, suffix } of units) {
    if (abs >= threshold) {
      const scaled = abs / threshold;
      // Trim trailing zeros for cleaner display, but keep up to `precision` decimals.
      const fixed = scaled.toFixed(precision);
      const trimmed = fixed.replace(/\.?0+$/, '');
      return `${sign}${trimmed}${suffix}`;
    }
  }

  return String(n);
}

export function formatDateTime(value) {
  if (!value) return 'No data';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No data';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function formatFullDateTime(value) {
  if (!value) return 'No data';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'No data';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(value) {
  if (!value) return 'No readings';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No readings';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatChartTime(value, range) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  if (range === '1m') {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: range === '1d' ? undefined : 'short',
    day: range === '1d' ? undefined : 'numeric',
    hour: 'numeric',
    minute: range === '1d' ? '2-digit' : undefined,
  }).format(d);
}

export function formatChartTooltipTime(value) {
  return formatFullDateTime(value);
}

export function formatAggregationInterval(bucketSize) {
  return {
    '10m': '10-minute bucket',
    '30m': '30-minute chart bucket',
    hour: 'hourly chart bucket',
    '6h': '6-hour chart bucket',
    day: 'daily chart bucket',
  }[bucketSize] || 'chart bucket';
}

export function formatBucketRange(start, end, bucketSize) {
  const startText = formatFullDateTime(start);
  if (!end || bucketSize === '10m') return startText;
  return `${startText} to ${formatFullDateTime(end)}`;
}

export function formatWindMps(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)} m/s` : '—';
}

export function formatPercent(value, precision = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(precision)}%` : '—';
}

export function formatPressureHpa(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)} hPa` : '—';
}

export function formatPrecipMm(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)} mm` : '—';
}

export function paddedTemperatureDomain(values, fallback = [40, 110]) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return fallback;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;
  const pad = span === 0 ? 3 : Math.max(2, span * 0.15);
  return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
}

/**
 * Parse a `startAt`/`endAt` value from the API into a `Date` (or `null`).
 * Used by chart components to clamp the time axis to the requested window.
 */
export function parseTimelineDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function averageDefined(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

export function titleCase(value) {
  if (!value) return 'Unknown';
  return String(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
