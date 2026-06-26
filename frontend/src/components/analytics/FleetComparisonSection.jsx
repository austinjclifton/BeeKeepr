import { lazy, Suspense, useMemo } from 'react';
import { EmptyState, ErrorState, LoadingState } from './StateBlocks';
import {
  getFleetHiveColor,
  getFleetHiveDisplay,
  sortFleetHives,
} from '../../utils/chartStyles';
import {
  EXTERNAL_TEMPERATURE_DOT_CLASS,
  getHiveId,
} from '../../utils/analyticsFormat';

const MultiHiveComparisonChart = lazy(() => import('./MultiHiveComparisonChart'));

/**
 * 24-hour fleet temperature comparison panel. Renders the multi-hive line
 * chart when the user has 2+ hives with data, an empty state when they
 * don't, and an error state if the request fails.
 *
 * The header row is bespoke (not DashboardSection) so the hive color
 * legend can sit to the right of the title and wrap on narrow viewports.
 * The chart's MUI built-in legend is hidden — the FleetLegend below is
 * the source of truth.
 *
 * Series + legend/tooltip labels are grouped by yard via the
 * `hiveLocations` map supplied by the Dashboard page (the fleet API
 * itself doesn't return `locationName` per hive).
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
    // Overview wrapper (see Dashboard.jsx) supplies `mt-10` so the
    // Fleet Trend / Fleet Status pair reads as one grouped area.
    // Chart wrapper is `min-h-[340px]` to match the chart's intrinsic
    // height; StateBlock has its own `min-h-[220px]` so empty / loading
    // / error states stay visually consistent.
    //
    // Header is a 2-column grid at lg+: title (260–340px) on the left,
    // legend right-aligned on the right. Below lg the columns stack
    // so the title gets full width and the legend wraps underneath.
    <section className={className}>
      <div className="mb-3.5 grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0">
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
          <div className="min-w-0 lg:flex lg:justify-end">
            <FleetLegend hives={legendHives} hasExternal={Boolean(comparison?.locationId)} />
          </div>
        )}
      </div>
      <div className="flex min-h-[340px] flex-col">
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
              // Dashboard opts into "Location · Hive" series labels so
              // the chart tooltip matches the legend pills.
              labelMode="locationName"
              // Dashboard opts out of the chart axis labels (the header
              // subtitle already explains time range + units) and the
              // label-driven bottom margin, reclaiming vertical plot
              // space. Analytics keeps the labeled default.
              compact
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
 * used by the chart. Each pill is a swatch + the hive name (bold) with
 * the short location name as a muted second line. Wraps freely so long
 * location-prefixed labels in the chart tooltip don't squeeze the
 * section title. The full "Location · Hive" string stays on the hover
 * tooltip.
 */
function FleetLegend({ hives, hasExternal }) {
  const items = hives
    .map((hive, index) => ({ hive, index }))
    .filter(({ hive }) => getHiveId(hive) != null);

  return (
    <div
      className="flex flex-wrap items-center gap-x-3.5 gap-y-3 text-[12px] uppercase tracking-[0.06em] text-ink-secondary"
      aria-label="Fleet hive color legend"
    >
      {items.map(({ hive, index }) => {
        const id = getHiveId(hive);
        const { name, locationName } = getFleetHiveDisplay(hive);
        const hoverLabel = locationName ? `${locationName} · ${name}` : name;
        return (
          <span
            key={id}
            className="inline-flex min-w-0 max-w-[14rem] flex-col leading-tight"
            title={hoverLabel}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: getFleetHiveColor(index) }}
              />
              <span className="truncate font-extrabold text-white">
                {name}
              </span>
            </span>
            {locationName && (
              <span className="ml-5 truncate text-[10px] tracking-[0.06em] text-ink-muted">
                {locationName}
              </span>
            )}
          </span>
        );
      })}
      {hasExternal && (
        <span className="inline-flex min-w-0 max-w-[14rem] flex-col leading-tight">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1.5 w-3.5 shrink-0 rounded-full ${EXTERNAL_TEMPERATURE_DOT_CLASS}`}
            />
            <span className="truncate font-extrabold text-white">External</span>
          </span>
          <span className="ml-5 truncate text-[10px] tracking-[0.06em] text-ink-muted">
            outside °F
          </span>
        </span>
      )}
    </div>
  );
}
