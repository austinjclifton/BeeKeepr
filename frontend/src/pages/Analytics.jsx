import { useState, useEffect, useRef, useCallback } from 'react';
import Navigation from "../components/Navigation";
import { apiFetch } from '../api';
import { useAuth } from '../hooks/useAuth';

/* ── Hamburger trigger ─────────────────────────────────────────── */
function HamburgerBtn() {
  return (
    <button
      className="mobile-menu-btn"
      onClick={() => window.dispatchEvent(new Event('openMobileNav'))}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
  );
}

function fmtDate(d) {
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function fmtTime(d) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function buildChartDataFromAPI(readings, externalConditions, range = '24H') {
  if (!readings || readings.length === 0) return null;

  let processedReadings = readings;
  if (range === '7D') {
    const dayBuckets = {};
    readings.forEach(r => {
      const d = new Date(r.bucket_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!dayBuckets[key]) dayBuckets[key] = { temps: [], rssis: [], bucket_at: r.bucket_at };
      dayBuckets[key].temps.push(parseFloat(r.temperature));
      if (r.rssi != null) dayBuckets[key].rssis.push(r.rssi);
    });
    processedReadings = Object.entries(dayBuckets).map(([, data]) => ({
      bucket_at: data.bucket_at,
      temperature: data.temps.reduce((a, b) => a + b, 0) / data.temps.length,
      rssi: data.rssis.length ? data.rssis.reduce((a, b) => a + b, 0) / data.rssis.length : null,
    }));
  }

  const extByTs = {};
  if (externalConditions && externalConditions.length > 0) {
    externalConditions.forEach(ec => {
      const ts = Math.floor(new Date(ec.bucket_at).getTime() / (10 * 60 * 1000));
      extByTs[ts] = ec.temperature;
    });
  }

  const labels = processedReadings.map(r => {
    const d = new Date(r.bucket_at);
    if (range === '24H') return fmtTime(d);
    if (range === '7D') return fmtDate(d);
    return `${fmtDate(d)} ${fmtTime(d)}`;
  });

  const internalAvg = processedReadings.map(r => parseFloat(parseFloat(r.temperature).toFixed(1)));

  const externalAvg = processedReadings.map(r => {
    const ts = Math.floor(new Date(r.bucket_at).getTime() / (10 * 60 * 1000));
    for (const offset of [0, 1, -1]) {
      const val = extByTs[ts + offset];
      if (val !== undefined && val !== null) return parseFloat(parseFloat(val).toFixed(1));
    }
    return null;
  });

  const tempDiff = internalAvg.map((intT, i) => {
    const extT = externalAvg[i];
    return extT !== null ? parseFloat((intT - extT).toFixed(1)) : null;
  });

  return { labels, internalAvg, externalAvg, tempDiff };
}

function buildSummaries(readings, externalConditions) {
  if (!readings || readings.length === 0) return [];

  const extByTs = {};
  if (externalConditions && externalConditions.length > 0) {
    externalConditions.forEach(ec => {
      const ts = Math.floor(new Date(ec.bucket_at).getTime() / (10 * 60 * 1000));
      extByTs[ts] = ec.temperature;
    });
  }

  const dayMap = {};
  readings.forEach(r => {
    const d = new Date(r.bucket_at);
    const day = fmtDate(d);
    if (!dayMap[day]) dayMap[day] = { temps: [], extTemps: [], rssis: [] };
    dayMap[day].temps.push(parseFloat(r.temperature));
    if (r.rssi != null) dayMap[day].rssis.push(r.rssi);
    const ts = Math.floor(d.getTime() / (10 * 60 * 1000));
    for (const offset of [0, 1, -1]) {
      const val = extByTs[ts + offset];
      if (val !== undefined && val !== null) { dayMap[day].extTemps.push(parseFloat(val)); break; }
    }
  });

  return Object.entries(dayMap)
    .sort(([a], [b]) => {
      const toMs = s => { const [m, d] = s.split('/'); return new Date(new Date().getFullYear(), m - 1, d).getTime(); };
      return toMs(b) - toMs(a);
    })
    .map(([date, { temps, extTemps, rssis }]) => {
      const intAvgVal = temps.reduce((a, b) => a + b, 0) / temps.length;
      const extAvgVal = extTemps.length ? extTemps.reduce((a, b) => a + b, 0) / extTemps.length : null;
      const diffVal   = extAvgVal !== null ? intAvgVal - extAvgVal : null;
      const isNormal  = diffVal !== null ? (diffVal >= 9 && diffVal <= 45) : true;
      const avgRssi   = rssis.length ? Math.round(rssis.reduce((a, b) => a + b, 0) / rssis.length) : null;
      return {
        date,
        intAvg:  `${intAvgVal.toFixed(1)}°`,
        extAvg:  extAvgVal !== null ? `${extAvgVal.toFixed(1)}°` : 'N/A',
        diff:    diffVal !== null ? `${diffVal >= 0 ? '+' : ''}${diffVal.toFixed(1)}°` : 'N/A',
        status:  isNormal ? 'Normal' : 'Warning',
        avgRssi: avgRssi !== null ? `${avgRssi} dBm` : 'N/A',
      };
    });
}

function AnalyticsChart({ data, view }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const buildChart = () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      const ctx = canvasRef.current.getContext('2d');
      const Chart = window.Chart;

      const datasets = view === 'comparison'
        ? [
            { type: 'bar', label: 'Temp Difference (°F)', data: data.tempDiff, backgroundColor: 'rgba(34,197,94,0.75)', borderWidth: 0, barPercentage: 0.85, categoryPercentage: 0.9, order: 3 },
            { type: 'line', label: 'Internal Avg (°F)', data: data.internalAvg, borderColor: '#f5a623', borderWidth: 2.5, backgroundColor: 'transparent', fill: false, tension: 0.3, pointRadius: 0, spanGaps: false, order: 1 },
            { type: 'line', label: 'External Avg (°F)', data: data.externalAvg, borderColor: '#1e2d4a', borderWidth: 2, borderDash: [5, 4], backgroundColor: 'transparent', fill: false, tension: 0.45, pointRadius: 0, spanGaps: false, order: 2 },
          ]
        : [
            { type: 'line', label: 'Internal Avg (°F)', data: data.internalAvg, borderColor: '#f5a623', borderWidth: 2.5, backgroundColor: 'rgba(245,166,35,0.15)', fill: true, tension: 0.3, pointRadius: 0, spanGaps: false, order: 1 },
            { type: 'line', label: 'External Avg (°F)', data: data.externalAvg, borderColor: '#1e2d4a', borderWidth: 2, backgroundColor: 'rgba(30,45,74,0.10)', fill: true, tension: 0.45, pointRadius: 0, spanGaps: false, order: 2 },
          ];

      chartRef.current = new Chart(ctx, {
        data: { labels: data.labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          animation: { duration: 500 },
          plugins: {
            legend: {
              display: true, position: 'bottom', align: 'start',
              labels: { color: '#64748b', font: { size: 11, family: "'DM Sans', system-ui" }, boxWidth: 12, boxHeight: 12, padding: 20, usePointStyle: true, pointStyleWidth: 12 },
            },
            tooltip: {
              backgroundColor: 'rgba(255,255,255,0.97)', titleColor: '#1e2d4a', bodyColor: '#64748b',
              borderColor: '#e2e8f0', borderWidth: 1, padding: 10, cornerRadius: 0,
              callbacks: { label: (c) => c.parsed.y != null ? `  ${c.dataset.label}: ${c.parsed.y.toFixed(1)}` : null },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(100,116,139,0.10)', borderDash: [3,3] }, border: { display: false },
              ticks: { color: '#94a3b8', font: { size: 10, family: "'DM Sans', system-ui" }, maxRotation: 0, autoSkip: true },
            },
            y: {
              position: 'left', grid: { color: 'rgba(100,116,139,0.10)', borderDash: [3,3] }, border: { display: false },
              ticks: { color: '#94a3b8', font: { size: 10, family: "'DM Sans', system-ui" }, maxTicksLimit: 6, callback: v => `${v}°F` }, min: 0,
            },
          },
        },
      });
    };

    if (window.Chart) { buildChart(); } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      script.onload = buildChart;
      document.head.appendChild(script);
    }

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [data, view]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}

const RANGE_DAYS   = { '24H': 1, '2D': 2, '7D': 7 };
const RANGE_LIMITS = { '24H': 300, '2D': 600, '7D': 1500 };
const FILTER_OPTIONS = ['All', 'Normal', 'Warning'];
const AUTO_REFRESH_MS = 5 * 60 * 1000;

// Exports the raw chart readings (matching the selected graph range exactly)
function exportChartToCSV(readings, externalConditions, range) {
  const extByTs = {};
  (externalConditions || []).forEach(ec => {
    const ts = Math.floor(new Date(ec.bucket_at).getTime() / (10 * 60 * 1000));
    extByTs[ts] = ec.temperature;
  });

  const header = 'Time,Internal Temp (°F),External Temp (°F)\n';
  const rows = readings.map(r => {
    const d = new Date(r.bucket_at);
    const label = range === '7D'
      ? fmtDate(d)
      : `${fmtDate(d)} ${fmtTime(d)}`;
    const intTemp = parseFloat(r.temperature).toFixed(1);
    const ts = Math.floor(d.getTime() / (10 * 60 * 1000));
    let extTemp = '';
    for (const offset of [0, 1, -1]) {
      const val = extByTs[ts + offset];
      if (val !== undefined && val !== null) { extTemp = parseFloat(val).toFixed(1); break; }
    }
    return `${label},${intTemp},${extTemp}`;
  }).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `beehive-analytics-${range}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function Analytics() {
  const { ready: authReady, error: authError } = useAuth();
  const [range, setRange] = useState('24H');
  const [view] = useState('ranges');
  const [chartData, setChartData] = useState(null);
  const [allSummaries, setAllSummaries] = useState([]);
  const [filterIdx, setFilterIdx] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);
  const [toast, setToast] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [hiveId, setHiveId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const hiveIdRef = useRef(null);
  // Store the raw chart readings and external conditions for export
  const chartReadingsRef = useRef([]);
  const chartExtRef = useRef([]);

  useEffect(() => {
    if (!authReady || authError) return;
    apiFetch('/api/hives')
      .then(res => {
        const hives = res?.hives ?? [];
        if (hives.length > 0) {
          hiveIdRef.current = hives[0].id;
          setHiveId(hives[0].id);
          loadData('24H', hives[0].id);
        }
      })
      .catch(() => {});
  }, [authReady, authError]);

  const loadData = useCallback(async (selectedRange, hId) => {
    const id = hId ?? hiveIdRef.current;
    if (!id) return;

    const days = RANGE_DAYS[selectedRange];
    const limit = RANGE_LIMITS[selectedRange] ?? 500;
    setDataLoading(true);
    try {
      const chartSince = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
      const summarySince = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      const [chartReadingsRes, chartExtRes, summaryReadingsRes, summaryExtRes] = await Promise.allSettled([
        apiFetch(`/api/readings/since?hiveId=${id}&since=${chartSince}&order=asc&limit=${limit}`),
        apiFetch(`/api/external-conditions/since?hiveId=${id}&since=${chartSince}&order=asc&limit=${limit}`),
        apiFetch(`/api/readings/since?hiveId=${id}&since=${summarySince}&order=asc&limit=5000`),
        apiFetch(`/api/external-conditions/since?hiveId=${id}&since=${summarySince}&order=asc&limit=5000`),
      ]);

      const chartReadings = chartReadingsRes.status === 'fulfilled' ? (chartReadingsRes.value?.readings ?? []) : [];
      const chartExt      = chartExtRes.status === 'fulfilled'      ? (chartExtRes.value?.externalConditions ?? []) : [];
      const summaryReadings = summaryReadingsRes.status === 'fulfilled' ? (summaryReadingsRes.value?.readings ?? []) : [];
      const summaryExt      = summaryExtRes.status === 'fulfilled'      ? (summaryExtRes.value?.externalConditions ?? []) : [];

      // Store raw chart data for export so it always matches the selected range
      chartReadingsRef.current = chartReadings;
      chartExtRef.current = chartExt;

      const realData = buildChartDataFromAPI(chartReadings, chartExt, selectedRange);
      setChartData(realData ?? null);

      const summaryData = buildSummaries(summaryReadings, summaryExt);
      setAllSummaries(summaryData);
    } catch {
      chartReadingsRef.current = [];
      chartExtRef.current = [];
      setChartData(null);
      setAllSummaries([]);
    } finally {
      setDataLoading(false);
      setVisibleCount(7);
    }
  }, []);

  useEffect(() => {
    if (!authReady || authError) return;
    if (hiveIdRef.current) {
      loadData(range, hiveIdRef.current);
    }
  }, [range, loadData, authReady, authError]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (hiveIdRef.current) loadData(range, hiveIdRef.current);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [range, loadData, autoRefresh]);

  const handleRefresh = () => {
    if (hiveIdRef.current && !dataLoading) loadData(range, hiveIdRef.current);
  };

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const handleExport = () => {
    if (!chartReadingsRef.current.length) return;
    exportChartToCSV(chartReadingsRef.current, chartExtRef.current, range);
    showToast(`Exported ${chartReadingsRef.current.length} rows as CSV`);
  };

  const handleFilterCycle = () => {
    setFilterIdx(i => (i + 1) % FILTER_OPTIONS.length);
  };

  const currentFilter = FILTER_OPTIONS[filterIdx];
  const filteredSummaries = currentFilter === 'All'
    ? allSummaries
    : allSummaries.filter(r => r.status === currentFilter);
  const visibleSummaries = filteredSummaries.slice(0, visibleCount);
  const hasMore = visibleCount < filteredSummaries.length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Navigation />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0, position: 'relative' }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {toast && (
          <div style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
            background: toast.ok ? '#1e2d4a' : '#ef4444',
            color: 'white', padding: '10px 18px',
            fontSize: '13px', fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'fadeIn 0.2s ease',
          }}>
            {toast.msg}
          </div>
        )}

        {/* ── Page header ── */}
        <div className="analytics-topbar mob-topbar-pad" style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <HamburgerBtn />
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e2d4a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Analytics</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>HIVE:</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e2d4a' }}>
              {hiveId ? `#${hiveId}` : '—'}
            </span>
            <span className="status-dot" style={{ width: '10px', height: '10px', background: '#22c55e', display: 'inline-block', borderRadius: '50%', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
          </div>
        </div>

        <div className="mob-pad" style={{ padding: '24px 28px 28px' }}>

          {/* ── Section header with range + export ── */}
          <div className="analytics-topbar" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1e2d4a', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Performance Reports</h1>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Data aggregation: {range === '7D' ? 'daily avg' : '10 mins'}
                {dataLoading && ' · Loading…'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <div className="range-btn-group" style={{ display: 'flex', background: 'white', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                {['24H', '2D', '7D'].map(r => (
                  <button key={r} onClick={() => setRange(r)} style={{
                    padding: '7px 16px', border: 'none',
                    background: range === r ? '#1e2d4a' : 'white',
                    color: range === r ? 'white' : '#64748b',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    opacity: dataLoading ? 0.6 : 1,
                  }}>{r}</button>
                ))}
              </div>
              <button
                onClick={handleExport}
                disabled={!chartData}
                style={{
                  padding: '7px 14px', border: '1.5px solid #e2e8f0',
                  background: 'white', color: '#1e2d4a', fontSize: '12px', fontWeight: 700,
                  cursor: !chartData ? 'not-allowed' : 'pointer',
                  opacity: !chartData ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
              </button>
            </div>
          </div>

          {/* ── Chart ── */}
          <div style={{ background: 'white', padding: '22px 22px 14px', boxShadow: 'var(--shadow-sm)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e2d4a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Insulation Efficiency</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                  {range === '7D' ? 'Daily averages (°F)' : 'Raw readings (°F)'}
                </div>
              </div>
              {/* ── Refresh controls ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => setAutoRefresh(v => !v)}
                  title={autoRefresh
                    ? 'Auto-refresh ON (every 5 min) — click to disable'
                    : 'Auto-refresh OFF — click to enable'}
                  style={{
                    padding: '5px 10px',
                    border: '1px solid #e2e8f0',
                    background: autoRefresh ? '#1e2d4a' : 'white',
                    color: autoRefresh ? 'white' : '#94a3b8',
                    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Auto: {autoRefresh ? 'ON' : 'OFF'}
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={dataLoading}
                  title="Refresh chart"
                  style={{
                    padding: '5px 10px', border: '1px solid #e2e8f0',
                    background: 'white', color: dataLoading ? '#94a3b8' : '#64748b',
                    fontSize: '11px', fontWeight: 700, cursor: dataLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}
                  onMouseEnter={e => { if (!dataLoading) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <svg
                    width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ animation: dataLoading ? 'spin 1s linear infinite' : 'none' }}
                  >
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
            <div className="analytics-chart-wrap" style={{ height: '300px' }}>
              {dataLoading || !chartData ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '32px' }}>📈</span>
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                    {dataLoading ? 'Loading chart data…' : 'No readings available for the selected range.'}
                  </span>
                </div>
              ) : (
                <AnalyticsChart data={chartData} view={view} />
              )}
            </div>
          </div>

          {/* ── Daily Summaries ── */}
          <div style={{ background: 'white', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e2d4a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Daily Summaries
                <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 500, color: '#94a3b8', textTransform: 'none', letterSpacing: 0 }}>
                  {filteredSummaries.length} rows
                </span>
              </div>
              <button
                onClick={handleFilterCycle}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px',
                  border: '1.5px solid #e2e8f0', background: currentFilter !== 'All' ? '#1e2d4a' : 'white',
                  fontSize: '11px', fontWeight: 700,
                  color: currentFilter !== 'All' ? 'white' : '#64748b',
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                {currentFilter}
              </button>
            </div>
            <div className="table-scroll-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
                <thead>
                  <tr style={{ background: '#fafbfc' }}>
                    {[
                      { label: 'DATE',     color: '#94a3b8' },
                      { label: 'INT. AVG', color: '#f5a623' },
                      { label: 'EXT. AVG', color: '#1e2d4a' },
                      { label: 'DELTA',    color: '#22c55e' },
                      { label: 'STATUS',   color: '#94a3b8' },
                      { label: 'AVG RSSI', color: '#94a3b8' },
                    ].map(h => (
                      <th key={h.label} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: '10px', fontWeight: 700, color: h.color,
                        letterSpacing: '0.07em', textTransform: 'uppercase',
                        borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
                      }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleSummaries.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        {dataLoading ? 'Loading summaries…' : 'No records found. Send readings from your sensor to see data here.'}
                      </td>
                    </tr>
                  ) : (
                    visibleSummaries.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#1e2d4a', whiteSpace: 'nowrap' }}>{row.date}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#f5a623', fontWeight: 700 }}>{row.intAvg}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1e2d4a', fontWeight: 600 }}>{row.extAvg}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#22c55e', fontWeight: 700 }}>{row.diff}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 10px', fontSize: '11px', fontWeight: 700,
                            background: row.status === 'Normal' ? '#dcfce7' : '#fef3c7',
                            color: row.status === 'Normal' ? '#16a34a' : '#d97706',
                          }}>{row.status}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{row.avgRssi}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '14px', textAlign: 'center' }}>
              {hasMore ? (
                <button
                  onClick={() => setVisibleCount(c => c + 5)}
                  style={{
                    padding: '8px 28px', border: '1.5px solid #e2e8f0',
                    background: 'white', fontSize: '12px', fontWeight: 700,
                    color: '#1e2d4a', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}
                >
                  Load More ({filteredSummaries.length - visibleCount} remaining)
                </button>
              ) : (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {filteredSummaries.length === 0 ? 'No data to display' : `All ${filteredSummaries.length} rows shown`}
                </span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}