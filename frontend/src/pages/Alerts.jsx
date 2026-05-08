import { useState, useEffect } from 'react';
import Navigation from "../components/Navigation";
import { apiFetch } from '../api';
import { useAuth } from '../hooks/useAuth';

const PREF_KEY = 'asheville_settings_v1';

function loadLocalPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { optimalLow: '93', optimalHigh: '99' };
}

function fmtAlertTime(dateStr) {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  return `${months[d.getMonth()]} ${d.getDate()}, ${hh}:${mm}`;
}

function mapApiAlert(alert) {
  const dir = alert.direction === 'low' ? 'below' : 'above';
  const sevLabel = alert.severity === 'critical' ? 'Critical' : 'Warning';
  const temp = parseFloat(alert.temperature).toFixed(1);
  const thresh = parseFloat(alert.threshold_value).toFixed(1);
  const description =
    `Hive ${alert.hive_id} temperature at ${temp}°F is ${dir} the ` +
    `${alert.severity} ${alert.direction} threshold of ${thresh}°F.` +
    (alert.severity === 'critical' ? ' Immediate attention required.' : ' Monitor closely.');
  return {
    id: alert.id,
    severity: alert.severity,
    status: alert.resolved ? 'resolved' : 'active',
    title: `Temperature ${dir === 'below' ? 'Below' : 'Above'} ${sevLabel} Threshold`,
    description,
    time: fmtAlertTime(alert.created_at),
    sensor: `Device ${alert.device_id}`,
    temperature: parseFloat(alert.temperature),
  };
}

function buildInfoEntry(hiveId, temp, formattedTime, sensor, uniqueId) {
  if (temp == null || isNaN(temp)) return null;
  const prefs = loadLocalPrefs();
  const optLow  = parseFloat(prefs.optimalLow);
  const optHigh = parseFloat(prefs.optimalHigh);
  const inRange = !isNaN(optLow) && !isNaN(optHigh) && temp >= optLow && temp <= optHigh;
  return {
    id: uniqueId || 'normal-state',
    severity: 'info',
    status: 'active',
    title: inRange ? 'Normal Operating Conditions' : 'Latest Sensor Reading',
    description: inRange
      ? `Hive ${hiveId} temperature at ${temp.toFixed(1)}°F is within the normal range (${optLow}°F – ${optHigh}°F). All systems operating normally.`
      : `Hive ${hiveId} temperature at ${temp.toFixed(1)}°F. See alerts below for threshold details.`,
    time:   formattedTime || fmtAlertTime(new Date().toISOString()),
    sensor: sensor || 'Sensor',
    temperature: temp,
  };
}

const SEVERITY_COLORS = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

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

export default function Alerts() {
  const { ready: authReady, error: authError } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [hiveInfo, setHiveInfo] = useState(null);

  useEffect(() => {
    if (!authReady) return;
    if (authError) { setError('Authentication required.'); setLoading(false); return; }
    fetchAlerts();
  }, [authReady, authError]);

  async function fetchAlerts() {
    setLoading(true); setError('');
    try {
      const hivesRes = await apiFetch('/api/hives');
      const hives = hivesRes?.hives ?? [];
      let hive = null;
      if (hives.length) { hive = hives[0]; setHiveInfo(hive); }

      const alertsRes = await apiFetch('/api/alerts');
      const mappedAlerts = (alertsRes?.alerts ?? []).map(mapApiAlert);

      // Build a set of reading_ids that already have a warning/critical alert
      const alertedReadingIds = new Set(
        (alertsRes?.alerts ?? []).map(a => a.reading_id)
      );

      // ── INFO entries: one per normal-range reading ────────────────────
      let infoEntries = [];
      if (hive) {
        try {
          const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
          const readingsRes = await apiFetch(
            `/api/readings/since?hiveId=${hive.id}&since=${since}&order=desc&limit=50`
          );
          const readings = readingsRes?.readings ?? [];
          const prefs = loadLocalPrefs();
          const optLow  = parseFloat(prefs.optimalLow);
          const optHigh = parseFloat(prefs.optimalHigh);

          infoEntries = readings
            .filter(r => !alertedReadingIds.has(r.id))
            .map(r => {
              const temp = parseFloat(r.temperature);
              if (isNaN(temp)) return null;
              const inRange = !isNaN(optLow) && !isNaN(optHigh) && temp >= optLow && temp <= optHigh;
              const timeStr = fmtAlertTime(r.received_at || r.bucket_at || new Date().toISOString());
              const sensor  = r.device_id ? `Device ${r.device_id}` : 'Sensor';
              return buildInfoEntry(hive.id, temp, timeStr, sensor, `info-reading-${r.id}`);
            })
            .filter(Boolean);
        } catch (_) { /* non-fatal */ }
      }

      // Merge: sort all entries by time descending
      const combined = [...infoEntries, ...mappedAlerts].sort((a, b) => {
        // Parse "Mon DD, HH:MM" back to a comparable value via the original entries
        // We'll keep original order from API for alerts, and interleave info entries
        return 0; // preserve insertion order after merging
      });

      // Actually sort by the raw time string isn't reliable — instead we re-fetch
      // with timestamps and sort properly.
      // Simple approach: place info entries first (newest reading first), then alerts.
      setAlerts([...infoEntries, ...mappedAlerts]);
    } catch (err) {
      setError(err.message || 'Failed to load activity data.');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleResolve = async (id) => {
    setAlerts(a => a.map(x => x.id === id ? { ...x, status: 'resolved' } : x));
    try {
      await apiFetch(`/api/alerts/${id}/resolve`, { method: 'PATCH' });
    } catch {
      setAlerts(a => a.map(x => x.id === id ? { ...x, status: 'active' } : x));
    }
  };

  const dismiss = id => setAlerts(a => a.filter(x => x.id !== id));

  const filtered = alerts.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter === 'active'   && a.status === 'resolved')    return false;
    if (statusFilter === 'resolved' && a.status !== 'resolved')    return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !a.title.toLowerCase().includes(q) &&
        !a.description.toLowerCase().includes(q) &&
        !a.sensor.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const handleExport = () => {
    const lines = [
      'Time,Severity,Status,Sensor,Title,Temperature',
      ...filtered.map(a => `${a.time},${a.severity},${a.status},${a.sensor},${a.title},${a.temperature}°F`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const el   = document.createElement('a');
    el.href = url; el.download = 'activity-log.csv'; el.click();
    URL.revokeObjectURL(url);
  };

  const FBtn = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      style={{ padding: '5px 12px', border: '1px solid #e2e8f0', background: active ? '#1e2d4a' : 'white', color: active ? 'white' : '#64748b', fontSize: '11px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      <Navigation />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }} onClick={() => setOpenMenuId(null)}>

        {/* Top bar */}
        <div className="mob-topbar-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <HamburgerBtn />
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e2d4a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Activity</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <span>#{hiveInfo?.id ?? '—'}</span>
            <span className="status-dot" style={{ width: '8px', height: '8px', background: '#22c55e', display: 'inline-block', borderRadius: '50%', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
          </div>
        </div>

        <div className="mob-pad" style={{ padding: '28px 32px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1e2d4a', letterSpacing: '-0.01em' }}>System Activity</h1>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Real-Time Monitoring Logs &amp; Alerts</div>
            </div>
            <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 14px', border: '1px solid #e2e8f0', background: 'white', fontSize: '12px', fontWeight: 700, color: '#1e2d4a', cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          </div>

          {/* Filter + Search */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <div className="filter-pills-row" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>Severity:</span>
              <FBtn label="All"      active={severityFilter === 'all'}      onClick={() => setSeverityFilter('all')} />
              <FBtn label="Critical" active={severityFilter === 'critical'} onClick={() => setSeverityFilter('critical')} />
              <FBtn label="Warning"  active={severityFilter === 'warning'}  onClick={() => setSeverityFilter('warning')} />
              <FBtn label="Info"     active={severityFilter === 'info'}     onClick={() => setSeverityFilter('info')} />
              <div style={{ width: '1px', height: '20px', background: '#e2e8f0', margin: '0 2px' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>Status:</span>
              <FBtn label="All"      active={statusFilter === 'all'}      onClick={() => setStatusFilter('all')} />
              <FBtn label="Active"   active={statusFilter === 'active'}   onClick={() => setStatusFilter('active')} />
              <FBtn label="Resolved" active={statusFilter === 'resolved'} onClick={() => setStatusFilter('resolved')} />
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text" placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#1e2d4a', background: 'transparent' }}
              />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>}
            </div>
          </div>

          {/* Cards */}
          {loading ? (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '10px', animation: 'pulse 1s infinite' }}>⏳</div>
              <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>Loading activity data…</div>
            </div>
          ) : error ? (
            <div style={{ background: 'white', border: '1px solid #fecaca', padding: '40px', textAlign: 'center' }}>
              <div style={{ color: '#ef4444', fontSize: '14px', fontWeight: 600 }}>{error}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>
                {alerts.length === 0
                  ? 'No alerts yet. Alerts are generated when sensor readings cross your configured thresholds.'
                  : 'No events match the current filters'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map(alert => {
                const isResolved = alert.status === 'resolved';
                const color      = SEVERITY_COLORS[alert.severity] || '#94a3b8';
                const isMenuOpen = openMenuId === alert.id;
                return (
                  <div key={alert.id} style={{ background: 'white', borderLeft: `4px solid ${color}`, border: isResolved ? '1px solid #e2e8f0' : `1px solid ${color}` }}>
                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', background: isResolved ? '#f1f5f9' : `${color}18`, color: isResolved ? '#94a3b8' : color, padding: '2px 8px', border: `1px solid ${isResolved ? '#e2e8f0' : color}`, textTransform: 'uppercase' }}>
                            {alert.severity}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {alert.time}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{alert.sensor}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: isResolved ? '#94a3b8' : '#1e2d4a', textDecoration: isResolved ? 'line-through' : 'none', fontStyle: isResolved ? 'italic' : 'normal', lineHeight: 1.5 }}>
                          {alert.description}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                          {isResolved ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                              Resolved
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                              Active
                            </div>
                          )}
                        </div>

                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={e => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : alert.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px', lineHeight: 1, padding: '2px 4px', fontWeight: 900, letterSpacing: '1px' }}
                          >⋮</button>
                          {isMenuOpen && (
                            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #e2e8f0', zIndex: 50, minWidth: '130px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                              {!isResolved && alert.severity === 'critical' && (
                                <button onClick={() => { handleResolve(alert.id); setOpenMenuId(null); }} style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: 'none', textAlign: 'left', fontSize: '13px', color: '#16a34a', cursor: 'pointer', fontWeight: 500 }}
                                  onMouseEnter={e => e.target.style.background = '#f8fafc'} onMouseLeave={e => e.target.style.background = 'none'}>
                                  Resolve
                                </button>
                              )}
                              <button onClick={() => { dismiss(alert.id); setOpenMenuId(null); }} style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: 'none', textAlign: 'left', fontSize: '13px', color: '#ef4444', cursor: 'pointer', fontWeight: 500 }}
                                onMouseEnter={e => e.target.style.background = '#fef2f2'} onMouseLeave={e => e.target.style.background = 'none'}>
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}