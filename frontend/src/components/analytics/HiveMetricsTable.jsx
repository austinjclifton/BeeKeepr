import {
  formatCount,
  formatInternalTemperature,
  getHiveId,
} from '../../utils/analyticsFormat';
import StatusBadge from './StatusBadge';

/**
 * "Fleet Status" panel — wide-table view of every hive, plus a
 * mobile-friendly card list so the data stays readable on phones
 * (no horizontal scroll).
 *
 * Two layouts are rendered in the DOM and toggled via Tailwind
 * responsive utilities:
 *   - <md : stacked card list, one card per hive. Each card surfaces
 *          the headline numbers + health badge so a quick phone
 *          glance still tells the whole story.
 *   - md+ : classic wide table, with slightly tighter padding than
 *           the previous version so it sits better next to the
 *           fleet chart above.
 *
 * Jun 2026 readability pass:
 *   - Added a one-line product-tone subtitle above the table so the
 *     "Fleet Status" card has the same context-line pattern as the
 *     fleet chart card next to it.
 *   - Bumped column header font from 10px → 11px (still uppercase /
 *     tracked, so the hierarchy is unchanged — they just read at a
 *     more comfortable size against the dashboard chrome).
 *   - Hive cell now stacks hive name (white, bold) over location
 *     name (muted, 12px, truncated) so the yard/yard-group context
 *     is visible at a glance without growing the row very much.
 *     Padding is tightened from `py-2.5` → `py-2` and the
 *     name/location gap is `mt-0.5` to keep the row visually
 *     compact even with the second line.
 *   - Internal temperature columns (Latest, Average, Min, Max,
 *     Temperature Swing) now always render 2 decimals via
 *     `formatInternalTemperature`; if external columns are ever
 *     added they should use `formatExternalTemperature` (1 decimal).
 *
 * No new data, no new fields — the same per-hive payload drives
 * every value on both layouts.
 */

const NUMERIC_COLUMNS = new Set([
  'Latest',
  'Average',
  'Min',
  'Max',
  'Temperature Swing',
  'Readings',
  'Warnings',
  'Critical',
]);

// Per-hive-row data needed by both layouts. Extracted so the table
// and the cards read from the same source of truth.
function buildRows(hives) {
  return hives.map(hive => {
    const id = getHiveId(hive);
    return {
      id,
      key: id,
      name: hive.name || `Hive ${id}`,
      locationName: hive.locationName || 'No location',
      healthStatus: hive.healthStatus || 'offline',
      latestTemperature: hive.latestTemperature,
      averageTemperature: hive.averageTemperature,
      minTemperature: hive.minTemperature,
      maxTemperature: hive.maxTemperature,
      temperatureSwing: hive.temperatureSwing,
      readingCount: hive.readingCount,
      warningCount: hive.warningCount ?? 0,
      criticalCount: hive.criticalCount ?? 0,
    };
  });
}

export default function HiveMetricsTable({ hives }) {
  const columns = [
    'Hive', 'Health', 'Latest', 'Average', 'Min', 'Max',
    'Temperature Swing', 'Readings', 'Warnings', 'Critical',
  ];

  const rows = buildRows(hives);

  return (
    <>
      {/* Short product-tone subtitle so the Fleet Status card has the
          same context-line pattern as the fleet chart card next to
          it. Sits above both the mobile cards and the desktop table
          so it reads consistently across viewports. `mb-1` (4px)
          keeps the subtitle visually attached to the table — the
          heading→subtitle gap is already `mb-3.5` (14px) from the
          DashboardSection, so the total heading→table gap is
          14+4=18px, inside the dashboard's 12-16px target. */}
      <p className="mb-1 text-[13px] leading-snug text-ink-secondary">
        Current 24-hour summary for all hives.
      </p>

      {/* Mobile / tablet (under lg): stacked card list. The lg
          breakpoint is intentional — the table needs ~720px of
          horizontal space and the sidebar consumes 240px+, so
          the table only fits comfortably at lg+ viewports. Below
          that, the card list keeps the data readable without
          horizontal scroll. */}
      <ul className="flex flex-col gap-2.5 lg:hidden">
        {rows.map(row => (
          <li
            key={row.key}
            className="rounded-lg border border-line bg-surface-elevated p-3.5 shadow-card-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold leading-tight text-white">
                  {row.name}
                </div>
                <div className="mt-0.5 truncate text-[12px] text-ink-muted">
                  {row.locationName}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[20px] font-extrabold leading-none tracking-[-0.01em] tabular-nums text-amber">
                  {formatInternalTemperature(row.latestTemperature)}
                </div>
                <div className="mt-1.5">
                  <StatusBadge status={row.healthStatus} />
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 border-t border-line-soft pt-3">
              <Stat label="Avg" value={formatInternalTemperature(row.averageTemperature)} />
              <Stat label="Min" value={formatInternalTemperature(row.minTemperature)} />
              <Stat label="Max" value={formatInternalTemperature(row.maxTemperature)} />
              <Stat label="Swing" value={formatInternalTemperature(row.temperatureSwing)} />
              <Stat label="Readings" value={formatCount(row.readingCount)} />
              <Stat
                label="Alerts"
                value={`${row.criticalCount}c / ${row.warningCount}w`}
                tone={row.criticalCount > 0 ? 'critical' : row.warningCount > 0 ? 'warning' : 'muted'}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop (lg+): classic wide table with slightly tighter
          padding so it sits better against the rest of the page.
          Internal temperatures are formatted with 2 decimals via
          `formatInternalTemperature`; the Hive cell stacks hive
          name (white, bold) over location name (muted, 12px,
          truncated) so the location context is visible without
          adding a new column. */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm text-ink-secondary">
          <thead>
            <tr>
              {columns.map(label => {
                const numeric = NUMERIC_COLUMNS.has(label);
                return (
                  <th
                    key={label}
                    scope="col"
                    className={
                      'border-b border-line px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted ' +
                      (numeric ? 'text-right' : 'text-left')
                    }
                  >
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.key}
                className="border-b border-line/70 transition last:border-b-0 hover:bg-white/[0.02] even:bg-white/[0.01]"
              >
                <td className="px-3 py-2 align-middle">
                  <div className="truncate font-extrabold text-white">
                    {row.name}
                  </div>
                  <div
                    className="mt-0.5 truncate text-[12px] leading-tight text-ink-muted"
                    title={row.locationName}
                  >
                    {row.locationName}
                  </div>
                </td>
                <td className="px-3 py-2 align-middle"><StatusBadge status={row.healthStatus} /></td>
                <td className="px-3 py-2 align-middle text-right tabular-nums">
                  {formatInternalTemperature(row.latestTemperature)}
                </td>
                <td className="px-3 py-2 align-middle text-right tabular-nums">
                  {formatInternalTemperature(row.averageTemperature)}
                </td>
                <td className="px-3 py-2 align-middle text-right tabular-nums">
                  {formatInternalTemperature(row.minTemperature)}
                </td>
                <td className="px-3 py-2 align-middle text-right tabular-nums">
                  {formatInternalTemperature(row.maxTemperature)}
                </td>
                <td className="px-3 py-2 align-middle text-right tabular-nums">
                  {formatInternalTemperature(row.temperatureSwing)}
                </td>
                <td className="px-3 py-2 align-middle text-right tabular-nums">
                  {formatCount(row.readingCount)}
                </td>
                <td
                  className={
                    'px-3 py-2 align-middle text-right font-extrabold tabular-nums ' +
                    (row.warningCount > 0 ? 'text-warning' : 'text-ink-muted')
                  }
                >
                  {formatCount(row.warningCount)}
                </td>
                <td
                  className={
                    'px-3 py-2 align-middle text-right font-extrabold tabular-nums ' +
                    (row.criticalCount > 0 ? 'text-error' : 'text-ink-muted')
                  }
                >
                  {formatCount(row.criticalCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Small numeric cell used inside the mobile card layout. Keeps
// the card readable without duplicating StatCard's full layout.
function Stat({ label, value, tone = 'default' }) {
  const valueClass =
    tone === 'critical'
      ? 'text-error'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'muted'
          ? 'text-ink-muted'
          : 'text-white';
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-extrabold uppercase leading-tight tracking-[0.06em] text-ink-muted/80">
        {label}
      </div>
      <div className={`mt-0.5 truncate text-[14px] font-extrabold leading-[1.1] tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
