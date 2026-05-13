import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Navigation from '../components/Navigation';
import DashboardSection from '../components/analytics/DashboardSection';
import HiveSelector from '../components/analytics/HiveSelector';
import StatCard from '../components/analytics/StatCard';
import StatusBadge from '../components/analytics/StatusBadge';
import TimeRangeToggle from '../components/analytics/TimeRangeToggle';
import { EmptyState, ErrorState, LoadingState } from '../components/analytics/StateBlocks';
import {
  downloadAnalyticsCsv,
  getAnalyticsLocations,
} from '../api';
import { useAnalyticsRange } from '../hooks/useAnalyticsRange';
import { useAuth } from '../hooks/useAuth';
import { useHiveAnalytics } from '../hooks/useHiveAnalytics';
import { useHiveComparison } from '../hooks/useHiveComparison';
import { useHiveStatus } from '../hooks/useHiveStatus';
import { useSelectedHive } from '../hooks/useSelectedHive';
import {
  formatAggregationInterval,
  formatCount,
  formatDateTime,
  formatMetric,
  formatTemperature,
  getHiveId,
} from '../utils/analyticsFormat';

// Query option lists
const BUCKET_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '10m', label: '10 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: 'hour', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: 'day', label: '1 day' },
];

const EXPORT_INCLUDE_OPTIONS = [
  { key: 'includeReadings', label: 'Temperature readings' },
  { key: 'includeExternal', label: 'External conditions' },
  { key: 'includeHiveDevice', label: 'Hive/device metadata' },
  { key: 'includeAlerts', label: 'Alert data' },
];

const MultiHiveComparisonChart = lazy(() => import('../components/analytics/MultiHiveComparisonChart'));
const TemperatureChart = lazy(() => import('../components/analytics/TemperatureChart'));

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

function toLocalDateTimeInput(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function defaultStartInput() {
  return toLocalDateTimeInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
}

function defaultEndInput() {
  return toLocalDateTimeInput(new Date());
}

function describeQuery(query) {
  if (query?.range) {
    const label = {
      '1d': 'Last 1 day',
      '3d': 'Last 3 days',
      '7d': 'Last 7 days',
      '1m': 'Last 1 month',
    }[query.range];
    return label || query.range.toUpperCase();
  }

  return `${formatDateTime(query?.start)} to ${formatDateTime(query?.end)}`;
}

function withQueryOptions(baseQuery, bucket, locationId) {
  const next = baseQuery?.range
    ? { range: baseQuery.range }
    : { start: baseQuery?.start, end: baseQuery?.end };

  if (bucket && bucket !== 'auto') next.bucket = bucket;
  if (locationId) next.locationId = Number(locationId);
  return next;
}

function locationDisplayName(location) {
  if (!location) return 'All locations';
  if (location.displayName) return location.displayName;
  if (location.name) return location.name;
  const lat = Number(location.lat);
  const lon = Number(location.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  return `Location ${location.id}`;
}

function presetWindow(range) {
  const end = new Date();
  const start = new Date(end);
  if (range === '1m') {
    start.setMonth(start.getMonth() - 1);
  } else {
    const days = { '1d': 1, '3d': 3, '7d': 7 }[range] || 7;
    start.setDate(start.getDate() - days);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function resolveExportWindow(rangeMode, appliedQuery, customStartInput, customEndInput) {
  if (rangeMode === 'all') return {};

  if (rangeMode === 'active') {
    if (appliedQuery.range) return presetWindow(appliedQuery.range);
    return { start: appliedQuery.start, end: appliedQuery.end };
  }

  if (['1d', '3d', '7d', '1m'].includes(rangeMode)) {
    return presetWindow(rangeMode);
  }

  const start = new Date(customStartInput);
  const end = new Date(customEndInput);
  if (!customStartInput || !customEndInput || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Choose a valid export start and end date.');
  }
  if (start.getTime() >= end.getTime()) {
    throw new Error('Export start must be before export end.');
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function Analytics() {
  // Query and export state
  const { ready: authReady, error: authError } = useAuth();
  const { range, setRange } = useAnalyticsRange('7d');
  const [mode, setMode] = useState('preset');
  const [bucket, setBucket] = useState('auto');
  const [locationId, setLocationId] = useState('');
  const [locationsState, setLocationsState] = useState({ locations: [], loading: false, error: '' });
  const [startInput, setStartInput] = useState(defaultStartInput);
  const [endInput, setEndInput] = useState(defaultEndInput);
  const [queryError, setQueryError] = useState('');
  const [appliedQuery, setAppliedQuery] = useState(() => ({ range }));
  const [exportScope, setExportScope] = useState('user');
  const [exportHiveId, setExportHiveId] = useState('');
  const [exportLocationId, setExportLocationId] = useState('');
  const [exportRangeMode, setExportRangeMode] = useState('active');
  const [exportStartInput, setExportStartInput] = useState(defaultStartInput);
  const [exportEndInput, setExportEndInput] = useState(defaultEndInput);
  const [exportIncludes, setExportIncludes] = useState({
    includeReadings: true,
    includeExternal: true,
    includeHiveDevice: true,
    includeAlerts: false,
  });
  const [exportStatus, setExportStatus] = useState({ loading: false, error: '', success: '' });
  const queryLabel = describeQuery(appliedQuery);
  const chartRange = appliedQuery.range || 'custom';

  // Shared hive data
  const status = useHiveStatus(appliedQuery, { enabled: authReady && !authError });
  const { hives } = status;
  const { selectedHive, selectedHiveId, setSelectedHiveId } = useSelectedHive(hives);
  const selectedId = Number(selectedHiveId);
  const selectedAnalytics = useHiveAnalytics(selectedId, appliedQuery, {
    enabled: authReady && !authError && Number.isInteger(selectedId) && selectedId > 0,
  });

  const hiveIds = useMemo(
    () => hives.map(getHiveId).filter(Boolean),
    [hives],
  );
  const hiveIdsKey = hiveIds.join(',');
  const [compareIds, setCompareIds] = useState([]);
  const locations = locationsState.locations;

  // Location filter state
  const selectedLocation = useMemo(
    () => locations.find(location => String(location.id) === String(locationId)) ?? null,
    [locations, locationId],
  );

  // Load owned locations
  useEffect(() => {
    let cancelled = false;
    if (!authReady || authError) return () => { cancelled = true; };

    async function loadLocations() {
      setLocationsState(prev => ({ ...prev, loading: true, error: '' }));
      try {
        const data = await getAnalyticsLocations();
        if (!cancelled) {
          setLocationsState({
            locations: data?.locations ?? [],
            loading: false,
            error: '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setLocationsState({
            locations: [],
            loading: false,
            error: err.message || 'Failed to load locations',
          });
        }
      }
    }

    loadLocations();
    return () => { cancelled = true; };
  }, [authReady, authError]);

  // Seed comparison picks
  useEffect(() => {
    setCompareIds(prev => {
      const valid = prev.filter(id => hiveIds.includes(id));
      if (valid.length >= 2 || hiveIds.length < 2) return valid;
      return hiveIds.slice(0, Math.min(5, hiveIds.length));
    });
  }, [hiveIdsKey]);

  // Multi-hive comparison data
  const comparison = useHiveComparison(compareIds, appliedQuery, {
    enabled: authReady && !authError && compareIds.length >= 2,
  });

  // Selected hive view state
  const summary = selectedAnalytics.summary ?? {};
  const selectedName = selectedHive?.name || (selectedId ? `Hive ${selectedId}` : 'No hive selected');
  const hasStatusResults = hives.length > 0;
  const showRefreshingResults = status.loading && hasStatusResults;
  const actualBucketSize =
    selectedAnalytics.bucketSize ||
    comparison.comparison?.bucketSize ||
    status.bucketSize ||
    appliedQuery.bucket ||
    null;
  const bucketContext = bucket === 'auto'
    ? `Auto${actualBucketSize ? ` (${formatAggregationInterval(actualBucketSize)})` : ''}`
    : formatAggregationInterval(bucket);
  const locationContext = selectedLocation ? locationDisplayName(selectedLocation) : 'All locations';

  // Query controls
  const handlePresetRange = (nextRange) => {
    setMode('preset');
    setRange(nextRange);
    setQueryError('');
    setAppliedQuery(withQueryOptions({ range: nextRange }, bucket, locationId));
  };

  const applyCustomRange = () => {
    const start = new Date(startInput);
    const end = new Date(endInput);

    if (!startInput || !endInput) {
      setQueryError('Choose both a start and end date.');
      return;
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setQueryError('Choose valid start and end dates.');
      return;
    }
    if (start.getTime() >= end.getTime()) {
      setQueryError('Start date must be before end date.');
      return;
    }

    setMode('custom');
    setQueryError('');
    setAppliedQuery(withQueryOptions({
      start: start.toISOString(),
      end: end.toISOString(),
    }, bucket, locationId));
  };

  const applyCurrentOptions = (nextBucket = bucket, nextLocationId = locationId) => {
    setAppliedQuery(prev => withQueryOptions(prev, nextBucket, nextLocationId));
  };

  const handleBucketChange = (nextBucket) => {
    setBucket(nextBucket);
    setQueryError('');
    applyCurrentOptions(nextBucket, locationId);
  };

  const handleLocationChange = (nextLocationId) => {
    setLocationId(nextLocationId);
    setCompareIds([]);
    setQueryError('');
    applyCurrentOptions(bucket, nextLocationId);
    if (nextLocationId && exportScope === 'user') {
      setExportScope('location');
      setExportLocationId(nextLocationId);
    }
  };

  const toggleCompareHive = (id) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id);
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
  };

  const handleExportIncludeChange = (key) => {
    setExportIncludes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // CSV export action
  const handleDownloadCsv = async () => {
    setExportStatus({ loading: true, error: '', success: '' });
    try {
      if (!Object.values(exportIncludes).some(Boolean)) {
        throw new Error('Select at least one dataset to export.');
      }

      const dateWindow = resolveExportWindow(
        exportRangeMode,
        appliedQuery,
        exportStartInput,
        exportEndInput,
      );
      const params = {
        scope: exportScope,
        ...dateWindow,
        ...exportIncludes,
      };

      if (exportScope === 'hive') {
        const hiveId = exportHiveId || selectedHiveId;
        if (!hiveId) throw new Error('Choose a hive for this export.');
        params.hiveId = hiveId;
      }

      if (exportScope === 'location') {
        const selectedExportLocationId = exportLocationId || locationId;
        if (!selectedExportLocationId) throw new Error('Choose a location for this export.');
        params.locationId = selectedExportLocationId;
      }

      const { blob, filename } = await downloadAnalyticsCsv(params);
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setExportStatus({ loading: false, error: '', success: `Downloaded ${filename}` });
    } catch (err) {
      setExportStatus({
        loading: false,
        error: err.message || 'Failed to download CSV',
        success: '',
      });
    }
  };

  return (
    <div className="app-shell">
      <Navigation />
      <main className="page-main">
        <div className="page-content">
          <header className="page-header analytics-header">
            <div>
              <div className="page-title-row">
                <HamburgerBtn />
                <div className="page-kicker">Analytics</div>
              </div>
              <h1>Historical Analysis</h1>
              <p className="page-subtitle">Search specific windows, inspect one hive, and compare colonies over time.</p>
            </div>
            <HiveSelector
              hives={hives}
              selectedHiveId={selectedHiveId}
              onChange={setSelectedHiveId}
              compact
            />
          </header>

          {authError ? (
            <ErrorState message="Authentication required." />
          ) : (
            <>
              {/* Query controls */}
              <DashboardSection title="Query Window" eyebrow="Search">
                <div className="analytics-card query-panel">
                  <div className="query-mode-row">
                    <button
                      type="button"
                      className={mode === 'preset' ? 'primary-btn' : 'ghost-btn'}
                      onClick={() => {
                        setMode('preset');
                        setAppliedQuery(withQueryOptions({ range }, bucket, locationId));
                        setQueryError('');
                      }}
                    >
                      Presets
                    </button>
                    <button
                      type="button"
                      className={mode === 'custom' ? 'primary-btn' : 'ghost-btn'}
                      onClick={() => setMode('custom')}
                    >
                      Custom Dates
                    </button>
                    <div className="range-context-pill">Active: {queryLabel}</div>
                    <div className="range-context-pill">Bucket: {bucketContext}</div>
                    <div className="range-context-pill">Location: {locationContext}</div>
                  </div>

                  <div className="query-controls">
                    <label>
                      <div className="field-label" style={{ marginBottom: '8px' }}>Location</div>
                      <select
                        className="dark-select"
                        value={locationId}
                        onChange={event => handleLocationChange(event.target.value)}
                        disabled={locationsState.loading}
                      >
                        <option value="">All locations</option>
                        {locations.map(location => (
                          <option key={location.id} value={location.id}>
                            {locationDisplayName(location)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <div className="field-label" style={{ marginBottom: '8px' }}>Bucket Size</div>
                      <select
                        className="dark-select"
                        value={bucket}
                        onChange={event => handleBucketChange(event.target.value)}
                      >
                        {BUCKET_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px', flex: '2 1 260px' }}>
                      Source readings are stored in 10-minute ingest buckets. The backend validates bucket size against the active range.
                    </div>
                  </div>

                  {mode === 'preset' ? (
                    <div className="query-controls">
                      <div>
                        <div className="field-label" style={{ marginBottom: '8px' }}>Preset Range</div>
                        <TimeRangeToggle range={range} onChange={handlePresetRange} disabled={status.loading} />
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Preset ranges run immediately and use backend-owned bucket sizes.
                      </div>
                    </div>
                  ) : (
                    <div className="query-controls">
                      <label>
                        <div className="field-label" style={{ marginBottom: '8px' }}>Start</div>
                        <input
                          className="dark-input"
                          type="datetime-local"
                          value={startInput}
                          onChange={event => setStartInput(event.target.value)}
                        />
                      </label>
                      <label>
                        <div className="field-label" style={{ marginBottom: '8px' }}>End</div>
                        <input
                          className="dark-input"
                          type="datetime-local"
                          value={endInput}
                          onChange={event => setEndInput(event.target.value)}
                        />
                      </label>
                      <button type="button" className="primary-btn query-apply-btn" onClick={applyCustomRange}>
                        Apply Date Range
                      </button>
                    </div>
                  )}

                  {queryError && (
                    <div style={{ color: '#fca5a5', fontSize: '13px', marginTop: '12px', fontWeight: 700 }}>
                      {queryError}
                    </div>
                  )}
                  {locationsState.error && (
                    <div style={{ color: '#fca5a5', fontSize: '13px', marginTop: '12px', fontWeight: 700 }}>
                      {locationsState.error}
                    </div>
                  )}
                  {showRefreshingResults && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '12px', fontWeight: 700 }}>
                      Refreshing results while keeping your place
                    </div>
                  )}
                </div>
              </DashboardSection>

              {status.loading && !hasStatusResults ? (
                <LoadingState label="Loading analytics…" />
              ) : status.error ? (
                <ErrorState message={status.error} onRetry={status.refresh} />
              ) : !hasStatusResults ? (
                <EmptyState title="No hive data available" detail="This account does not have hives or readings to analyze yet." />
              ) : (
                <>
                  {/* Selected hive summary */}
                  <DashboardSection
                    title={selectedName}
                    eyebrow="Selected Hive Summary"
                    action={selectedHive && <StatusBadge status={selectedHive.healthStatus} />}
                  >
                    <div className="stat-grid">
                      <StatCard label="Latest Temp" value={formatTemperature(summary.latestTemperature)} detail={formatDateTime(summary.latestReadingAt)} />
                      <StatCard label="Average Temp" value={formatTemperature(summary.averageTemperature)} detail={`${formatCount(summary.readingCount)} readings`} />
                      <StatCard label="Min Temp" value={formatTemperature(summary.minTemperature)} />
                      <StatCard label="Max Temp" value={formatTemperature(summary.maxTemperature)} />
                      <StatCard label="Temperature Swing" value={formatTemperature(summary.temperatureSwing)} />
                      <StatCard label="Warning Alerts" value={formatCount(summary.warningCount)} tone="warning" />
                      <StatCard label="Critical Alerts" value={formatCount(summary.criticalCount)} tone="critical" />
                      <StatCard label="Bucket Size" value={selectedAnalytics.bucketSize || '—'} detail={queryLabel} tone="muted" />
                    </div>
                  </DashboardSection>

                  {/* Temperature trend */}
                  <DashboardSection title="Temperature Trend" eyebrow="Single Hive">
                    <div className="analytics-card chart-card">
                      {selectedAnalytics.error ? (
                        <ErrorState message={selectedAnalytics.error} />
                      ) : (
                        <TemperatureChart
                          series={selectedAnalytics.temperatureSeries}
                          range={chartRange}
                          bucketSize={selectedAnalytics.bucketSize}
                          loading={selectedAnalytics.loading}
                          height={380}
                        />
                      )}
                    </div>
                  </DashboardSection>

                  {/* Multi-hive comparison */}
                  <DashboardSection title={selectedLocation ? 'Location Comparison' : 'Comparison Graph'} eyebrow="Multi-Hive">
                    <div className="analytics-card chart-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {selectedLocation
                            ? `Comparing hives in ${locationDisplayName(selectedLocation)} inside the active query window.`
                            : 'Select hives to compare average temperature inside the active query window.'}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {hives.map(hive => {
                            const id = getHiveId(hive);
                            const active = compareIds.includes(id);
                            return (
                              <button
                                key={id}
                                type="button"
                                className={active ? 'primary-btn' : 'ghost-btn'}
                                onClick={() => toggleCompareHive(id)}
                              >
                                {hive.name || `Hive ${id}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {compareIds.length < 2 ? (
                        <EmptyState title="Choose another hive" detail="Multi-hive comparison needs at least two selected hives." />
                      ) : comparison.error ? (
                        <ErrorState message={comparison.error} />
                      ) : (
                        <MultiHiveComparisonChart
                          comparison={comparison.comparison}
                          range={chartRange}
                          loading={comparison.loading}
                          height={400}
                          showBucketRangeInTooltip={false}
                        />
                      )}
                    </div>
                  </DashboardSection>

                  {/* CSV export */}
                  <DashboardSection title="Export CSV" eyebrow="Download Data">
                    <div className="analytics-card query-panel">
                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 850 }}>Download database data</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                              Exports are scoped to the current beekeeper and include CSV-safe headers.
                            </div>
                          </div>
                          <button
                            type="button"
                            className="primary-btn"
                            onClick={handleDownloadCsv}
                            disabled={exportStatus.loading}
                          >
                            {exportStatus.loading ? 'Downloading…' : 'Download CSV'}
                          </button>
                        </div>

                        <div className="query-controls">
                          <label>
                            <div className="field-label" style={{ marginBottom: '8px' }}>Scope</div>
                            <select
                              className="dark-select"
                              value={exportScope}
                              onChange={event => setExportScope(event.target.value)}
                            >
                              <option value="user">All hives</option>
                              <option value="location">Selected location</option>
                              <option value="hive">Selected hive</option>
                            </select>
                          </label>

                          {exportScope === 'hive' && (
                            <label>
                              <div className="field-label" style={{ marginBottom: '8px' }}>Hive</div>
                              <select
                                className="dark-select"
                                value={exportHiveId || selectedHiveId || ''}
                                onChange={event => setExportHiveId(event.target.value)}
                              >
                                {hives.map(hive => {
                                  const id = getHiveId(hive);
                                  return (
                                    <option key={id} value={id}>
                                      {hive.name || `Hive ${id}`}
                                    </option>
                                  );
                                })}
                              </select>
                            </label>
                          )}

                          {exportScope === 'location' && (
                            <label>
                              <div className="field-label" style={{ marginBottom: '8px' }}>Location</div>
                              <select
                                className="dark-select"
                                value={exportLocationId || locationId || ''}
                                onChange={event => setExportLocationId(event.target.value)}
                              >
                                <option value="">Choose location</option>
                                {locations.map(location => (
                                  <option key={location.id} value={location.id}>
                                    {locationDisplayName(location)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}

                          <label>
                            <div className="field-label" style={{ marginBottom: '8px' }}>Export Range</div>
                            <select
                              className="dark-select"
                              value={exportRangeMode}
                              onChange={event => setExportRangeMode(event.target.value)}
                            >
                              <option value="active">Active query window</option>
                              <option value="1d">Last 1 day</option>
                              <option value="3d">Last 3 days</option>
                              <option value="7d">Last 7 days</option>
                              <option value="1m">Last 1 month</option>
                              <option value="custom">Custom dates</option>
                              <option value="all">All data</option>
                            </select>
                          </label>
                        </div>

                        {exportRangeMode === 'custom' && (
                          <div className="query-controls">
                            <label>
                              <div className="field-label" style={{ marginBottom: '8px' }}>Export Start</div>
                              <input
                                className="dark-input"
                                type="datetime-local"
                                value={exportStartInput}
                                onChange={event => setExportStartInput(event.target.value)}
                              />
                            </label>
                            <label>
                              <div className="field-label" style={{ marginBottom: '8px' }}>Export End</div>
                              <input
                                className="dark-input"
                                type="datetime-local"
                                value={exportEndInput}
                                onChange={event => setExportEndInput(event.target.value)}
                              />
                            </label>
                          </div>
                        )}

                        <div>
                          <div className="field-label" style={{ marginBottom: '8px' }}>Included Data</div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {EXPORT_INCLUDE_OPTIONS.map(option => (
                              <label
                                key={option.key}
                                className="ghost-btn"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={exportIncludes[option.key]}
                                  onChange={() => handleExportIncludeChange(option.key)}
                                  style={{ accentColor: 'var(--amber)' }}
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          This download will include {EXPORT_INCLUDE_OPTIONS.filter(option => exportIncludes[option.key]).map(option => option.label.toLowerCase()).join(', ') || 'no datasets selected'} for {exportScope === 'user' ? 'all owned hives' : exportScope === 'hive' ? 'the selected hive' : 'the selected location'}.
                          {exportRangeMode === 'all' ? ' All matching historical rows will be exported.' : ` Range: ${exportRangeMode === 'active' ? queryLabel : exportRangeMode === 'custom' ? 'custom export dates' : describeQuery({ range: exportRangeMode })}.`}
                        </div>

                        {exportStatus.error && (
                          <div style={{ color: '#fca5a5', fontSize: '13px', fontWeight: 700 }}>
                            {exportStatus.error}
                          </div>
                        )}
                        {exportStatus.success && (
                          <div style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 800 }}>
                            {exportStatus.success}
                          </div>
                        )}
                      </div>
                    </div>
                  </DashboardSection>

                  {/* Hive metrics */}
                  <DashboardSection title="Hive Metrics" eyebrow="Query Summary">
                    <div className="analytics-card" style={{ overflowX: 'auto' }}>
                      <table className="metrics-table">
                        <thead>
                          <tr>
                            <th>Hive</th>
                            <th>Health</th>
                            <th>Latest</th>
                            <th>Average</th>
                            <th>Min</th>
                            <th>Max</th>
                            <th>Temperature Swing</th>
                            <th>Readings</th>
                            <th>Warnings</th>
                            <th>Critical</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hives.map(hive => {
                            const id = getHiveId(hive);
                            return (
                              <tr key={id}>
                                <td style={{ color: 'var(--text-primary)', fontWeight: 850 }}>
                                  {hive.name || `Hive ${id}`}
                                </td>
                                <td><StatusBadge status={hive.healthStatus} /></td>
                                <td>{formatTemperature(hive.latestTemperature)}</td>
                                <td>{formatTemperature(hive.averageTemperature)}</td>
                                <td>{formatTemperature(hive.minTemperature)}</td>
                                <td>{formatTemperature(hive.maxTemperature)}</td>
                                <td>{formatMetric(hive.temperatureSwing)}°F</td>
                                <td>{formatCount(hive.readingCount)}</td>
                                <td style={{ color: hive.warningCount > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 800 }}>
                                  {formatCount(hive.warningCount)}
                                </td>
                                <td style={{ color: hive.criticalCount > 0 ? 'var(--error)' : 'var(--text-muted)', fontWeight: 800 }}>
                                  {formatCount(hive.criticalCount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </DashboardSection>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
