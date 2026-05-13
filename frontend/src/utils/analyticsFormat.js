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

export function formatMetric(value, precision = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(precision) : '—';
}

export function formatCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '0';
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
