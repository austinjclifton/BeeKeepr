import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import DashboardSection from '../components/analytics/DashboardSection';
import HiveMetricsTable from '../components/analytics/HiveMetricsTable';
import HiveSelector from '../components/analytics/HiveSelector';
import HiveStatusGrid from '../components/analytics/HiveStatusGrid';
import StatCard from '../components/analytics/StatCard';
import StatusBadge from '../components/analytics/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/analytics/StateBlocks';
import {
  getAlerts,
  getDashboardFleetTemperature24h,
  getDashboardHiveTemperature24h,
} from '../api';
import { useAuth } from '../hooks/useAuth';
import { useHiveAnalytics } from '../hooks/useHiveAnalytics';
import { useHiveStatus } from '../hooks/useHiveStatus';
import { useSelectedHive } from '../hooks/useSelectedHive';
import {
  averageDefined,
  formatCount,
  formatDateTime,
  formatPercent,
  formatPrecipMm,
  formatPressureHpa,
  formatTemperature,
  formatWindMps,
  getHiveId,
} from '../utils/analyticsFormat';

// Fixed dashboard range
const DASHBOARD_RANGE = '1d';
const DashboardHiveTemperatureChart = lazy(() => import('../components/analytics/DashboardHiveTemperatureChart'));
const MultiHiveComparisonChart = lazy(() => import('../components/analytics/MultiHiveComparisonChart'));

function HamburgerBtn() {
  return (
    <button
      className="mobile-menu-btn"
      type="button"
      onClick={() => window.dispatchEvent(new Event('openMobileNav'))}
      aria-label="Open navigation"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { ready: authReady, error: authError } = useAuth();

  // Shared hive status and selection
  const status = useHiveStatus(DASHBOARD_RANGE, { enabled: authReady && !authError });
  const { hives } = status;
  const { selectedHive, selectedHiveId, setSelectedHiveId } = useSelectedHive(hives);
  const selectedId = Number(selectedHiveId);
  const selectedAnalytics = useHiveAnalytics(selectedId, DASHBOARD_RANGE, {
    enabled: authReady && !authError && Number.isInteger(selectedId) && selectedId > 0,
  });

  const hiveIds = useMemo(
    () => hives.map(getHiveId).filter(Boolean),
    [hives],
  );
  const hiveIdsKey = hiveIds.join(',');
  const compareIds = useMemo(
    () => hiveIds.slice(0, Math.min(10, hiveIds.length)),
    [hiveIdsKey],
  );

  // Side queries for cards and charts
  const [activeAlertCount, setActiveAlertCount] = useState(null);
  const [selectedTimeline, setSelectedTimeline] = useState({ data: null, loading: false, error: '' });
  const [fleetTimeline, setFleetTimeline] = useState({ data: null, loading: false, error: '' });

  // Outside weather rollup
  const externalStats = useMemo(() => {
    const withExternal = hives.filter(hive => hive.externalConditionAt);
    const latest = withExternal
      .slice()
      .sort((a, b) => new Date(b.externalConditionAt).getTime() - new Date(a.externalConditionAt).getTime())[0];

    return {
      averageTemperature: averageDefined(withExternal.map(hive => hive.externalTemperature)),
      latestTemperature: latest?.externalTemperature ?? null,
      latestAt: latest?.externalConditionAt ?? null,
    };
  }, [hives]);

  // Count unresolved alerts
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

  // Load selected hive timeline
  useEffect(() => {
    let cancelled = false;
    if (!authReady || authError || !Number.isInteger(selectedId) || selectedId <= 0) {
      setSelectedTimeline({ data: null, loading: false, error: '' });
      return () => { cancelled = true; };
    }

    async function loadSelectedTimeline() {
      setSelectedTimeline(prev => ({ ...prev, loading: true, error: '' }));
      try {
        const data = await getDashboardHiveTemperature24h(selectedId);
        if (!cancelled) setSelectedTimeline({ data, loading: false, error: '' });
      } catch (err) {
        if (!cancelled) {
          setSelectedTimeline({
            data: null,
            loading: false,
            error: err.message || 'Failed to load selected hive timeline',
          });
        }
      }
    }

    loadSelectedTimeline();
    return () => { cancelled = true; };
  }, [authReady, authError, selectedId]);

  // Load fleet timeline
  useEffect(() => {
    let cancelled = false;
    if (!authReady || authError || hives.length < 2) {
      setFleetTimeline({ data: null, loading: false, error: '' });
      return () => { cancelled = true; };
    }

    async function loadFleetTimeline() {
      setFleetTimeline(prev => ({ ...prev, loading: true, error: '' }));
      try {
        const data = await getDashboardFleetTemperature24h();
        if (!cancelled) setFleetTimeline({ data, loading: false, error: '' });
      } catch (err) {
        if (!cancelled) {
          setFleetTimeline({
            data: null,
            loading: false,
            error: err.message || 'Failed to load fleet temperature timeline',
          });
        }
      }
    }

    loadFleetTimeline();
    return () => { cancelled = true; };
  }, [authReady, authError, hiveIdsKey, hives.length]);

  // Top-line hive metrics
  const overview = useMemo(() => {
    const healthy = hives.filter(hive => hive.healthStatus === 'healthy').length;
    const warning = hives.filter(hive => hive.healthStatus === 'warning').length;
    const critical = hives.filter(hive => hive.healthStatus === 'critical').length;
    const avgTemp = averageDefined(hives.map(hive => hive.averageTemperature ?? hive.latestTemperature));

    return {
      total: hives.length,
      healthy,
      warning,
      critical,
      avgTemp,
    };
  }, [hives]);

  // Selected hive detail
  const selectedSummary = selectedAnalytics.summary ?? {};
  const selectedName = selectedHive?.name || (selectedId ? `Hive ${selectedId}` : 'No hive selected');
  const selectedLocationName = selectedHive?.locationName || 'No location';
  const outsideTemp = externalStats.averageTemperature ?? externalStats.latestTemperature;
  const selectedExternalTemp = selectedHive?.externalTemperature ?? null;
  const selectedTempDelta =
    Number.isFinite(Number(selectedSummary.latestTemperature)) &&
      Number.isFinite(Number(selectedExternalTemp))
      ? Number(selectedSummary.latestTemperature) - Number(selectedExternalTemp)
      : null;

  return (
    <div className="app-shell">
      <Navigation />
      <main className="page-main">
        <div className="page-content">
          <header className="page-header">
            <div>
              <div className="page-title-row">
                <HamburgerBtn />
                <div className="page-kicker">Operations</div>
              </div>
              <h1>Operations Dashboard</h1>
              <p className="page-subtitle">Live 24-hour status across every BeeKeepr hive.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'end', gap: '14px', flexWrap: 'wrap' }}>
              <HiveSelector
                hives={hives}
                selectedHiveId={selectedHiveId}
                onChange={setSelectedHiveId}
                compact
              />
              <div className="range-context-pill">24 Hours</div>
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
              detail="This account does not have hive data yet. Demo accounts should be preloaded separately."
            />
          ) : (
            <>
              {/* Overview cards */}
              <div className="stat-grid dashboard-stat-grid">
                <StatCard label="Total Hives" value={formatCount(overview.total)} detail="Owned hives in BeeKeepr" />
                <StatCard label="Healthy Hives" value={formatCount(overview.healthy)} detail="Reporting normally" tone="healthy" />
                <StatCard label="Warning Hives" value={formatCount(overview.warning)} detail="Needs review" tone="warning" />
                <StatCard label="Critical Hives" value={formatCount(overview.critical)} detail="Immediate attention" tone="critical" />
                <StatCard label="Hive Avg Temp" value={formatTemperature(overview.avgTemp)} detail="Internal average, 24h" />
                <StatCard label="Outside Temp" value={formatTemperature(outsideTemp)} detail={externalStats.latestAt ? `Latest ${formatDateTime(externalStats.latestAt)}` : 'Weather data unavailable'} tone="muted" />
                <StatCard
                  label="Active Alerts"
                  value={activeAlertCount == null ? '—' : formatCount(activeAlertCount)}
                  detail="Unresolved alert stream"
                  tone={activeAlertCount > 0 ? 'warning' : 'healthy'}
                  onClick={() => navigate('/alerts')}
                />
              </div>

              {/* Hive status grid */}
              <DashboardSection title="Hive Status" eyebrow="Operational Overview">
                <HiveStatusGrid
                  hives={hives}
                  selectedHiveId={selectedHiveId}
                  onSelect={setSelectedHiveId}
                />
              </DashboardSection>

              {/* Selected hive detail */}
              <DashboardSection
                title={selectedHive ? (
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                    <span>{selectedName}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>
                      {selectedLocationName}
                    </span>
                  </span>
                ) : selectedName}
                eyebrow="Selected Hive 24h Graph and Summary"
                action={selectedHive && <StatusBadge status={selectedHive.healthStatus} />}
              >
                {selectedAnalytics.error || selectedTimeline.error ? (
                  <ErrorState message={selectedAnalytics.error || selectedTimeline.error} />
                ) : (
                  <Box
                    className="selected-hive-layout"
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(340px, 0.65fr)' },
                      gap: 2,
                      alignItems: 'start',
                    }}
                  >
                    <div className="analytics-card chart-card selected-hive-chart-card">
                      <div style={{ marginBottom: '10px' }}>
                        <div className="section-eyebrow">24 Hour Temperature Trend</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          Internal hive temperature and outside conditions displayed in 10-minute buckets
                        </div>
                      </div>
                      <Suspense fallback={<LoadingState label="Loading chart renderer…" />}>
                        <DashboardHiveTemperatureChart
                          timeline={selectedTimeline.data}
                          hiveName={selectedName}
                          loading={selectedTimeline.loading}
                        />
                      </Suspense>
                    </div>

                    <div className="selected-hive-side">
                      <Box
                        className="selected-hive-stats-grid compact-stat-grid"
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                          gap: 1.5,
                        }}
                      >
                        <StatCard compact label="Latest" value={formatTemperature(selectedSummary.latestTemperature)} detail={formatDateTime(selectedSummary.latestReadingAt)} />
                        <StatCard compact label="Average" value={formatTemperature(selectedSummary.averageTemperature)} detail={`${formatCount(selectedSummary.readingCount)} readings`} />
                        <StatCard compact label="Minimum" value={formatTemperature(selectedSummary.minTemperature)} />
                        <StatCard compact label="Maximum" value={formatTemperature(selectedSummary.maxTemperature)} />
                        <StatCard compact label="Temperature Swing" value={formatTemperature(selectedSummary.temperatureSwing)} />
                        <StatCard compact label="Latest Packet" value={selectedAnalytics.latestReading ? `#${selectedAnalytics.latestReading.id}` : '—'} detail={formatDateTime(selectedAnalytics.latestReading?.receivedAt)} tone="muted" />
                        <StatCard
                          compact
                          label="Warning Alerts"
                          value={formatCount(selectedSummary.warningCount)}
                          detail={selectedSummary.latestWarningAt ? `Most recent ${formatDateTime(selectedSummary.latestWarningAt)}` : 'No recent warnings'}
                          tone="warning"
                        />
                        <StatCard
                          compact
                          label="Critical Alerts"
                          value={formatCount(selectedSummary.criticalCount)}
                          detail={selectedSummary.latestCriticalAt ? `Most recent ${formatDateTime(selectedSummary.latestCriticalAt)}` : 'No recent critical alerts'}
                          tone="critical"
                        />
                      </Box>
                    </div>
                  </Box>
                )}
              </DashboardSection>

              {/* Outside conditions */}
              <DashboardSection title="Outside Conditions" eyebrow={selectedHive?.locationName || 'Selected Hive Location'}>
                <Box
                  className="outside-condition-grid compact-stat-grid"
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <StatCard compact label="Outside Temperature" value={formatTemperature(selectedExternalTemp)} detail={formatDateTime(selectedHive?.externalConditionAt)} tone="muted" />
                  <StatCard compact label="Hive vs Outside" value={formatTemperature(selectedTempDelta)} detail="Latest internal minus outside" tone="muted" />
                  <StatCard compact label="Humidity" value={formatPercent(selectedHive?.externalHumidityPct)} detail="Latest outside condition" tone="muted" />
                  <StatCard compact label="Wind" value={formatWindMps(selectedHive?.externalWindMps)} detail="Latest sustained wind" tone="muted" />
                  <StatCard compact label="Wind Gust" value={formatWindMps(selectedHive?.externalWindGustMps)} detail="Latest gust speed" tone="muted" />
                  <StatCard compact label="Cloud Cover" value={formatPercent(selectedHive?.externalCloudPct)} detail="Latest cloud cover" tone="muted" />
                  <StatCard compact label="Pressure" value={formatPressureHpa(selectedHive?.externalPressureHpa)} detail="Latest barometric pressure" tone="muted" />
                  <StatCard compact label="Precipitation" value={formatPrecipMm(selectedHive?.externalPrecipMm)} detail="Latest bucket precipitation" tone="muted" />
                </Box>
              </DashboardSection>

              {/* Fleet comparison */}
              <DashboardSection
                title="24h Fleet Temperature"
                eyebrow="Multi-Hive"
                action={<button type="button" className="ghost-btn" onClick={() => navigate('/analytics')}>Open Analytics</button>}
              >
                <div className="analytics-card chart-card">
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                    Internal temperature trends for active hives over the previous 24 hours, summarized from 10-minute readings.
                  </div>
                  {compareIds.length < 2 ? (
                    <EmptyState
                      title="Comparison unavailable"
                      detail="The fleet graph appears when this account has at least two hives with data."
                    />
                  ) : fleetTimeline.error ? (
                    <ErrorState message={fleetTimeline.error} />
                  ) : (
                    <Suspense fallback={<LoadingState label="Loading chart renderer…" />}>
                      <MultiHiveComparisonChart
                        comparison={fleetTimeline.data}
                        range={DASHBOARD_RANGE}
                        loading={fleetTimeline.loading}
                        showBucketRangeInTooltip={false}
                        smoothFleetDisplay
                      />
                    </Suspense>
                  )}
                </div>
              </DashboardSection>

              {/* Hive metrics table */}
              <DashboardSection title="Hive Metrics" eyebrow="Dashboard 24h Summary">
                <HiveMetricsTable hives={hives} />
              </DashboardSection>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
