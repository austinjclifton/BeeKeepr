import { lazy, Suspense, useMemo } from 'react';
import { EmptyState, ErrorState, LoadingState } from './StateBlocks';
import {
  getFleetHiveColor,
  getFleetHiveDisplay,
  sortFleetHives,
} from '../../utils/chartStyles';
import { getHiveId } from '../../utils/analyticsFormat';

const MultiHiveComparisonChart = lazy(() => import('./MultiHiveComparisonChart'));

/**
 * 24-hour fleet temperature comparison panel. Renders the multi-hive line
 * chart when the user has 2+ hives with data, an empty state when they
 * don't, and an error state if the request fails.
 *
 * Dashboard layout (Jun 2026 readability pass):
 *   - Custom header row replaces the default DashboardSection chrome.
 *     The eyebrow / title / description sit on the left and the hive
 *     color legend sits on the right. The legend wraps to a second
 *     row on smaller viewports so the chart title is never squeezed.
 *   - The chart's long engineering footer is suppressed via
 *     `showFooter={false}` — bucket/smoothing detail belongs on
 *     the Analytics page, not the dashboard.
 *   - The MUI built-in chart legend is hidden via `hideLegend` because
 *     the custom header legend above is now the source of truth.
 *   - The "Open Analytics" deep-link pill was removed earlier; the
 *     Analytics nav link in the sidebar is the discoverable entry point.
 *   - Series order + legend/tooltip labels are grouped by yard: hives
 *     from the same location appear adjacent in the chart and read as
 *     "ShortLocation · HiveName" in both the legend pills and the
 *     chart tooltip. The location context flows in via the
 *     `hiveLocations` map supplied by the Dashboard page (the fleet
 *     API itself doesn't return `locationName` per hive).
 */
export default function FleetComparisonSection({
  fleetTimeline,
  hasMultipleHives,
  range,
  hiveLocations,
  className = '',
}) {
  const rawComparison = fleetTimeline.data;

  // Merge `hiveLocations` into each hive so downstream consumers
  // (legend + chart) can group by yard. The fleet API doesn't return
  // `locationName`; the dashboard already loaded it via `useHiveStatus`
  // and threads it down as a Map<hiveId, locationName>.
  const comparison = useMemo(() => {
    if (!rawComparison) return rawComparison;
    const hives = rawComparison.hives ?? [];
    if (!hives.length || !hiveLocations || typeof hiveLocations.get !== 'function') {
      return rawComparison;
    }
    const enriched = hives.map(hive => {
      const id = getHiveId(hive);
      const locationName = id != null ? hiveLocations.get(id) : null;
      return locationName ? { ...hive, locationName } : hive;
    });
    return { ...rawComparison, hives: enriched };
  }, [rawComparison, hiveLocations]);

  const legendHives = sortFleetHives(comparison?.hives ?? []);
  const showChart = hasMultipleHives && !fleetTimeline.error;

  return (
    // No top margin on the outer <section> — the dashboard's Fleet
    // Overview wrapper (see Dashboard.jsx) supplies the `mt-10` and
    // `space-y-*` so the Fleet Trend / Fleet Status pair reads as
    // one grouped area. If this section is ever rendered outside
    // that wrapper, the parent should supply its own spacing.
    //
    // The chart wrapper is `min-h-[300px]` — exactly the chart's
    // intrinsic height (300px) — so the loaded chart fills the
    // wrapper with no dead space below. The StateBlock inside still
    // has its own `min-h-[220px]`, so empty / loading / error
    // states stay visually consistent.
<section className={className}>
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
            Fleet Trend
          </div>
          <h2 className="text-[20px] font-extrabold leading-[1.2] text-white">
            24h Fleet Temperature
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-snug text-ink-secondary">
            Internal temperature across the fleet, last 24 hours.
          </p>
        </div>
        {showChart && legendHives.length > 0 && (
          <FleetLegend hives={legendHives} hasExternal={Boolean(comparison?.locationId)} />
        )}
      </div>
      <div className="flex min-h-[300px] flex-col">
        {!hasMultipleHives ? (
          <EmptyState
            title="Comparison unavailable"
            detail="The fleet graph appears when this account has at least two hives with data."
          />
        ) : fleetTimeline.error ? (
          <ErrorState message={fleetTimeline.error} />
        ) : (
          <Suspense fallback={<LoadingState label="Loading chart renderer…" />}>
            <MultiHiveComparisonChart
              comparison={comparison}
              range={range}
              loading={fleetTimeline.loading}
              showFooter={false}
              smoothFleetDisplay
              hideLegend
              // Match the Fleet Status table's precision rules:
              // internal series always show 2 decimals, the external
              // overlay always shows 1 decimal.
              internalPrecision={2}
              externalPrecision={1}
            />
          </Suspense>
        )}
      </div>
    </section>
  );
}

/**
 * Compact horizontal legend of hive colors that mirrors the palette
 * used by the chart. Lives in the chart card header so the user sees
 * "which line is which hive" right next to the title, not floating
 * at the top of the chart area.
 *
 * Wraps to a new row when there are many hives (or on narrow
 * viewports). Each pill is a 12px-wide color swatch + hive name.
 * The external-temperature pill is appended at the end when a
 * location comparison is on screen.
 */
function FleetLegend({ hives, hasExternal }) {
  const items = hives
    .map((hive, index) => ({ hive, index }))
    .filter(({ hive }) => getHiveId(hive) != null);

  return (
    <div
      className="flex max-w-full flex-wrap items-center gap-x-3.5 gap-y-3 text-[12px] uppercase tracking-[0.06em] text-ink-secondary"
      aria-label="Fleet hive color legend"
    >
      {items.map(({ hive, index }) => {
        const id = getHiveId(hive);
        const { name, locationName } = getFleetHiveDisplay(hive);
        const hoverLabel = locationName ? `${locationName} · ${name}` : name;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1.5"
            title={hoverLabel}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-3.5 shrink-0 self-center rounded-full"
              style={{ backgroundColor: getFleetHiveColor(index) }}
            />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-extrabold text-ink-secondary">
                {name}
              </span>
              {locationName && (
                <span className="truncate text-[10px] tracking-[0.06em] text-ink-muted">
                  {locationName}
                </span>
              )}
            </span>
          </span>
        );
      })}
      {hasExternal && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: '#22D3EE' }}
          />
          External
        </span>
      )}
    </div>
  );
}
