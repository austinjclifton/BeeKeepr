import DashboardSection from './DashboardSection';
import {
  formatPercent,
  formatPrecipMm,
  formatPressureHpa,
  formatRelativeTime,
  formatWindMps,
} from '../../utils/analyticsFormat';

// Secondary environment details — the primary environment values
// (outside temperature, hive-vs-outside delta, humidity, wind) live
// in the SelectedHiveMetricRow strip above the chart, so the user
// sees them in the same panel as the internal metrics.
//
// This lower section is now the "full detail view" for the rest of
// the weather data, plus the external-reading freshness. The values
// come straight from the `selectedHive` payload; no new data
// sources, no new fields. `Updated` reuses `formatRelativeTime` so
// the freshness copy ("5m ago", "1h ago", ...) matches the rest of
// the dashboard.
const SECONDARY_FIELDS = [
  {
    label: 'Wind Gust',
    key: 'externalWindGustMps',
    format: formatWindMps,
    detail: 'Latest gust speed',
  },
  {
    label: 'Cloud Cover',
    key: 'externalCloudPct',
    format: formatPercent,
    detail: 'Latest cloud cover',
  },
  {
    label: 'Pressure',
    key: 'externalPressureHpa',
    format: formatPressureHpa,
    detail: 'Latest barometric pressure',
  },
  {
    label: 'Precipitation',
    key: 'externalPrecipMm',
    format: formatPrecipMm,
    detail: 'Latest bucket precipitation',
  },
  {
    label: 'Updated',
    key: 'externalConditionAt',
    // formatRelativeTime returns "No readings" for falsy / unparseable
    // values; for this cell we want a cleaner "—" fallback that
    // doesn't read as "no temperature readings".
    format: value => (value ? formatRelativeTime(value) : '—'),
    detail: 'Latest external reading',
  },
];

/**
 * Compact "secondary details" environment strip shown below the
 * fleet chart.
 *
 * Since the primary environment values (outside temp, hive-vs-
 * outside delta, humidity, wind) live in the selected-hive metrics
 * strip above the chart, this section is no longer the main
 * environment surface — it's the full weather detail view. It now
 * carries the four supporting fields (wind gust, cloud cover,
 * pressure, precipitation) plus the external-data freshness, so the
 * strip and this section together cover every weather value the
 * dashboard exposes.
 *
 * Layout: single compact horizontal strip with five cells at lg,
 * two columns at sm, stacked at mobile. Same compact visual
 * language as before — unified 11px uppercase label, 16px tabular
 * value, muted detail line, line-soft dividers, no per-cell shadow
 * or border. The eyebrow keeps the yard name so context is
 * preserved; "Updated" carries the timestamp.
 */
export default function OutsideConditionsGrid({ selectedHive }) {
  return (
    <DashboardSection
      title="More environment"
      eyebrow={selectedHive?.locationName || 'Selected Hive Location'}
    >
      <div className="overflow-hidden rounded-lg border border-line-soft bg-surface-elevated/60">
        <div className="grid grid-cols-1 divide-y divide-line-soft sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
          {SECONDARY_FIELDS.map(field => {
            const rawValue = selectedHive?.[field.key];
            const display = rawValue != null ? field.format(rawValue) : '—';
            return (
              <div
                key={field.label}
                className="flex min-w-0 flex-col gap-1 px-4 py-3 first:pl-5 last:pr-5"
              >
                <div className="text-[11px] font-extrabold uppercase leading-[1.2] tracking-[0.05em] text-ink-muted">
                  {field.label}
                </div>
                <div className="min-w-0 truncate text-[16px] font-extrabold leading-[1.1] tracking-[-0.01em] tabular-nums text-white">
                  {display}
                </div>
                <div className="truncate text-[11px] leading-snug text-ink-muted">
                  {field.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardSection>
  );
}
