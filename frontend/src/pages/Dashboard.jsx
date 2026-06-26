import { useEffect, useMemo, useState } from 'react';
import Navigation from '../components/Navigation';
import DashboardSection from '../components/analytics/DashboardSection';
import FleetComparisonSection from '../components/analytics/FleetComparisonSection';
import HiveMetricsTable from '../components/analytics/HiveMetricsTable';
import HivePicker from '../components/analytics/HivePicker';
import OperationsSummaryStrip from '../components/analytics/OperationsSummaryStrip';
import SelectedHiveSection from '../components/analytics/SelectedHiveSection';
import { EmptyState, ErrorState, LoadingState } from '../components/analytics/StateBlocks';
import {
  getAlerts,
  getDashboardFleetTemperature24h,
  getDashboardHiveTemperature24h,
} from '../api';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useAuth } from '../hooks/useAuth';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useHiveAnalytics } from '../hooks/useHiveAnalytics';
import { useHiveStatus } from '../hooks/useHiveStatus';
import { useSelectedHive } from '../hooks/useSelectedHive';
import { formatRelativeTime, getHiveId } from '../utils/analyticsFormat';

// Fixed dashboard range (preset analytics range used by all dashboard queries).
const DASHBOARD_RANGE = '1d';

// Above this age the dashboard treats the data as stale even if some
// hives still report "online" status — applies to any account whose
// newest reading is older than the threshold.
const GLOBAL_STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export default function Dashboard() {
  const { ready: authReady, error: authError } = useAuth();

  // Shared hive status + selection.
  const status = useHiveStatus(DASHBOARD_RANGE, { enabled: authReady && !authError });
  const { hives } = status;
  const { selectedHive, selectedHiveId, setSelectedHiveId } = useSelectedHive(hives);
  const selectedId = Number(selectedHiveId);
  const selectedAnalytics = useHiveAnalytics(selectedId, DASHBOARD_RANGE, {
    enabled: authReady && !authError && Number.isInteger(selectedId) && selectedId > 0,
  });

  // Side-query state: unresolved alert count + two async resources
  // (selected hive timeline, fleet timeline). The two resources share
  // the {data, loading, error} shape so we use the shared hook.
  const [activeAlertCount, setActiveAlertCount] = useState(null);
  const selectedTimelineEnabled =
    authReady && !authError && Number.isInteger(selectedId) && selectedId > 0;
  const selectedTimeline = useAsyncResource(
    () => getDashboardHiveTemperature24h(selectedId),
    [authReady, authError, selectedId],
    {
      enabled: selectedTimelineEnabled,
      errorFallback: 'Failed to load selected hive timeline',
    },
  );
  const fleetTimelineEnabled = authReady && !authError && hives.length >= 2;
  const fleetTimeline = useAsyncResource(
    () => getDashboardFleetTemperature24h(),
    [authReady, authError, hives.length],
    {
      enabled: fleetTimelineEnabled,
      errorFallback: 'Failed to load fleet temperature timeline',
    },
  );

  // Global freshness: when the newest reading across every hive is
  // older than the stale threshold, surface one calm banner and
  // quieten the per-row OFFLINE indicators so the page doesn't shout
  // the same alarm N times.
  const globalStale = useMemo(() => {
    if (!hives?.length) return null;
    const lastSeenMs = hives.reduce((acc, hive) => {
      if (!hive?.latestReadingAt) return acc;
      const t = new Date(hive.latestReadingAt).getTime();
      return Number.isFinite(t) && (acc == null || t > acc) ? t : acc;
    }, null);
    if (lastSeenMs == null) return null;
    const ageMs = Date.now() - lastSeenMs;
    return ageMs > GLOBAL_STALE_THRESHOLD_MS
      ? { lastSeenIso: new Date(lastSeenMs).toISOString() }
      : null;
  }, [hives]);

  // Hive list ordering for the picker + metrics table. Group by
  // location first (alphabetical), then by hive name within each
  // location. Hive id breaks ties for a fully stable order. The
  // summary strip and selected-hive lookups don't depend on this
  // order, so the raw `hives` array continues to feed them.
  //
  // No displayOrder column exists on the location table, so the
  // chosen order is alphabetical by location name. For the demo
  // fleet this yields:
  //   Blue Ridge Appalachia Demo Yard
  //     Blue Ridge Stable Hive
  //     Pisgah Orchard Hive
  //   Western New York Demo Yard
  //     Finger Lakes Variable Hive
  //     Lake Erie Stable Hive
  //     Niagara Snowbelt Hive
  // which matches the preferred final grouped order.
  const sortedHives = useMemo(() => {
    if (!Array.isArray(hives) || hives.length === 0) return hives;
    // Sentinel for null/empty location names — sorts them to the
    // end of the list so hives with a real location come first.
    const NO_LOCATION = '\uFFFF';
    return [...hives].sort((a, b) => {
      const aLoc = (a?.locationName || '').trim() || NO_LOCATION;
      const bLoc = (b?.locationName || '').trim() || NO_LOCATION;
      if (aLoc !== bLoc) return aLoc.localeCompare(bLoc);
      const aName = (a?.name || '').trim();
      const bName = (b?.name || '').trim();
      if (aName !== bName) return aName.localeCompare(bName);
      const aId = getHiveId(a) ?? 0;
      const bId = getHiveId(b) ?? 0;
      return aId - bId;
    });
  }, [hives]);

  // Operations summary strip — owns all rollups derived from `hives`.
  const { metrics: summaryMetrics, rangeLabel: summaryRangeLabel } = useDashboardMetrics({
    hives,
    activeAlertCount,
  });

  // Count unresolved alerts.
  useEffect(() => {
    let cancelled = false;
    if (!authReady || authError) return () => { cancelled = true; };

    async function loadAlerts() {
      try {
        const data = await getAlerts();
        if (!cancelled) {
          const active = (data?.alerts ?? []).filter(alert => !alert.resolved).length;
          setActiveAlertCount(active);
        }
      } catch {
        if (!cancelled) setActiveAlertCount(null);
      }
    }

    loadAlerts();
    return () => { cancelled = true; };
  }, [authReady, authError]);

  return (
    <div className="app-shell flex min-h-screen" data-debug-dashboard>
      <Navigation />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="mx-auto w-full max-w-content px-7 py-7">
          <header className="mb-6">
            <div className="min-w-0">
              <h1 className="text-[clamp(26px,4vw,42px)] font-black leading-none text-white">
                Operations Dashboard
              </h1>
              <p className="mt-2 text-[14px] text-ink-secondary">
                Live 24-hour status across all of your hives
              </p>
            </div>
          </header>

          {authError ? (
            <ErrorState message="Authentication required." />
          ) : status.loading ? (
            <LoadingState label="Loading hive overview…" />
          ) : status.error ? (
            <ErrorState message={status.error} onRetry={status.refresh} />
          ) : hives.length === 0 ? (
            <EmptyState
              title="No hives yet"
              detail="This account does not have hive data yet. Connect a device or import historical data to get started."
            />
          ) : (
            <>
              {/* Stale / freshness banner — sits above the summary strip
                  so the user reads the freshness context BEFORE the
                  numbers, not after. Only shown when the latest reading
                  across the fleet is older than the stale threshold. */}
              {globalStale && (
                <div
                  className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber/25 bg-amber/[0.06] px-3.5 py-2 text-[12.5px] text-amber-light"
                  role="status"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber"
                  />
                  <span className="font-extrabold">Data stale</span>
                  <span className="text-ink-secondary">
                    · last reading {formatRelativeTime(globalStale.lastSeenIso)}
                  </span>
                </div>
              )}

              <OperationsSummaryStrip rangeLabel={summaryRangeLabel} metrics={summaryMetrics} />

              <DashboardSection title="Your Hives">
                <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[300px_minmax(0,1fr)]">
                  <HivePicker
                    hives={sortedHives}
                    selectedHiveId={selectedHiveId}
                    onSelect={setSelectedHiveId}
                    globalStale={Boolean(globalStale)}
                  />
                  <SelectedHiveSection
                    selectedHive={selectedHive}
                    selectedId={selectedId}
                    selectedTimeline={selectedTimeline}
                    selectedAnalytics={selectedAnalytics}
                    globalStale={Boolean(globalStale)}
                  />
                </div>
              </DashboardSection>

              {/*
                Fleet Overview area — the bottom half of the dashboard
                reads as one grouped "fleet view" surface:

                  [Selected Hive area]  →  mt-10 (40px)  →  [Fleet Trend]
                                                            space-y-1 (4px)
                                                            [Fleet Status]

                The `mt-10` is intentionally larger than the standard
                `mt-6` section break above (header→summary→Your Hives) so
                the user reads the Fleet Overview as a distinct page
                area, not just "the next section". The `space-y-1`
                inside is intentionally tight — the Fleet Trend chart
                and Fleet Status table read as related companion
                elements (chart on top, table below), not as two
                equal-weight sections. The visible gap from the chart
                bottom to the Fleet Status heading is
                space-y-1 (4px) + eyebrow height (14px) + mb-1 (4px)
                ≈ 22px, which is the dashboard's "around 20px" target
                for related-section gaps.

                `FleetComparisonSection` no longer ships its own
                `mt-6`, and the Fleet Status `DashboardSection` drops
                its `className="mt-3"` override — the wrapper's
                `mt-10` + `space-y-1` is the single source of truth
                for this area's rhythm.

                (Why a wrapper instead of `mt-*` on each child: it
                keeps the related-section gap explicit and makes the
                "grouped area" intent visible in the JSX.)
              */}
              <div className="mt-10 space-y-1">
                <FleetComparisonSection
                  fleetTimeline={fleetTimeline}
                  hasMultipleHives={hives.length >= 2}
                  range={DASHBOARD_RANGE}
                />
                <DashboardSection
                  title="Fleet Status"
                  eyebrow="All Hives"
                >
                  <HiveMetricsTable hives={sortedHives} />
                </DashboardSection>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
