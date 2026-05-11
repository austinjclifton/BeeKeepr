import { useEffect, useMemo, useState } from 'react';
import Navigation from '../components/Navigation';
import DashboardSection from '../components/analytics/DashboardSection';
import HiveSelector from '../components/analytics/HiveSelector';
import StatCard from '../components/analytics/StatCard';
import StatusBadge from '../components/analytics/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/analytics/StateBlocks';
import { friendlyApiMessage, getAlerts, resolveAlert } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useHiveStatus } from '../hooks/useHiveStatus';
import {
  formatDateTime,
  formatTemperature,
  getHiveId,
  titleCase,
} from '../utils/analyticsFormat';

const SEVERITY_COLORS = {
  critical: 'var(--error)',
  warning: 'var(--warning)',
  info: 'var(--info)',
};

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

function mapApiAlert(alert, hiveNames) {
  const hiveId = Number(alert.hive_id);
  const dir = alert.direction === 'low' ? 'below' : 'above';
  const severity = alert.severity || 'warning';
  const threshold = Number(alert.threshold_value);
  const temperature = Number(alert.temperature);
  const hiveName = hiveNames.get(hiveId) || `Hive ${hiveId}`;

  return {
    id: Number(alert.id),
    hiveId,
    hiveName,
    deviceId: alert.device_id,
    severity,
    status: alert.resolved ? 'resolved' : 'active',
    title: `${titleCase(severity)} temperature alert`,
    description: `${hiveName} is ${dir} the ${severity} ${alert.direction} threshold.`,
    time: alert.created_at,
    temperature: Number.isFinite(temperature) ? temperature : null,
    threshold: Number.isFinite(threshold) ? threshold : null,
  };
}

export default function Alerts() {
  const { ready: authReady, user, error: authError } = useAuth();
  const status = useHiveStatus('1d', { enabled: authReady && !authError });
  const [hiveFilter, setHiveFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isDemoAccount =
    import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true' &&
    import.meta.env.VITE_DEMO_USERNAME &&
    user?.username === import.meta.env.VITE_DEMO_USERNAME;

  const hiveNames = useMemo(() => {
    const map = new Map();
    for (const hive of status.hives) {
      const id = getHiveId(hive);
      if (id) map.set(id, hive.name || `Hive ${id}`);
    }
    return map;
  }, [status.hives]);

  useEffect(() => {
    let cancelled = false;
    if (!authReady || authError) return () => { cancelled = true; };

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getAlerts({
          hiveId: hiveFilter === 'all' ? null : hiveFilter,
        });
        if (!cancelled) {
          setAlerts((data?.alerts ?? []).map(alert => mapApiAlert(alert, hiveNames)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load alerts');
          setAlerts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [authReady, authError, hiveFilter, hiveNames]);

  const filtered = alerts.filter(alert => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [alert.title, alert.description, alert.hiveName, `device ${alert.deviceId}`]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
    }
    return true;
  });

  const counts = useMemo(() => ({
    total: alerts.length,
    active: alerts.filter(alert => alert.status === 'active').length,
    warning: alerts.filter(alert => alert.severity === 'warning').length,
    critical: alerts.filter(alert => alert.severity === 'critical').length,
  }), [alerts]);
  const metricsLoading = loading || status.loading || !authReady;

  const handleResolve = async (alertId) => {
    setAlerts(prev => prev.map(alert => alert.id === alertId ? { ...alert, status: 'resolved' } : alert));
    try {
      await resolveAlert(alertId);
    } catch (err) {
      setAlerts(prev => prev.map(alert => alert.id === alertId ? { ...alert, status: 'active' } : alert));
      setError(friendlyApiMessage(err, 'Failed to resolve alert'));
    }
  };

  return (
    <div className="app-shell">
      <Navigation />
      <main className="page-main">
        <div className="page-content">
          <header className="page-header">
            <div>
              <div className="page-title-row">
                <HamburgerBtn />
                <div className="page-kicker">Activity</div>
              </div>
              <h1>Alerts</h1>
              <p className="page-subtitle">Temperature threshold activity across all owned hives.</p>
            </div>
            <HiveSelector
              hives={status.hives}
              selectedHiveId={hiveFilter === 'all' ? '' : hiveFilter}
              onChange={value => setHiveFilter(value || 'all')}
              label="Filter Hive"
              compact
              allowAll
            />
          </header>

          <div className="stat-grid">
            <StatCard label="Total Alerts" value={metricsLoading ? '—' : String(counts.total)} detail="Loaded from the activity API" />
            <StatCard label="Active" value={metricsLoading ? '—' : String(counts.active)} detail="Unresolved alerts" tone="warning" />
            <StatCard label="Warnings" value={metricsLoading ? '—' : String(counts.warning)} tone="warning" />
            <StatCard label="Critical" value={metricsLoading ? '—' : String(counts.critical)} tone="critical" />
          </div>

          {isDemoAccount && (
            <div className="analytics-card" style={{ padding: '14px 16px', marginTop: '18px', borderColor: 'rgba(245,185,66,0.35)', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--amber)' }}>Demo account:</strong> alert resolution is disabled for shared demo data.
            </div>
          )}

          <DashboardSection title="Alert Stream" eyebrow="Multi-Hive">
            <div className="analytics-card" style={{ padding: '16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" className={severityFilter === 'all' ? 'primary-btn' : 'ghost-btn'} onClick={() => setSeverityFilter('all')}>All Severity</button>
                <button type="button" className={severityFilter === 'critical' ? 'primary-btn' : 'ghost-btn'} onClick={() => setSeverityFilter('critical')}>Critical</button>
                <button type="button" className={severityFilter === 'warning' ? 'primary-btn' : 'ghost-btn'} onClick={() => setSeverityFilter('warning')}>Warning</button>
                <button type="button" className={statusFilter === 'active' ? 'primary-btn' : 'ghost-btn'} onClick={() => setStatusFilter('active')}>Active</button>
                <button type="button" className={statusFilter === 'resolved' ? 'primary-btn' : 'ghost-btn'} onClick={() => setStatusFilter('resolved')}>Resolved</button>
                <button type="button" className={statusFilter === 'all' ? 'primary-btn' : 'ghost-btn'} onClick={() => setStatusFilter('all')}>All Status</button>
                <input
                  className="dark-input"
                  style={{ flex: '1 1 220px' }}
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search alerts"
                />
              </div>
            </div>

            {authError ? (
              <ErrorState message="Authentication required." />
            ) : loading || status.loading ? (
              <LoadingState label="Loading alerts…" />
            ) : error ? (
              <ErrorState message={error} />
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No alerts match"
                detail={alerts.length ? 'Adjust filters to see more alerts.' : 'Alerts will appear when readings cross configured thresholds.'}
              />
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {filtered.map(alert => {
                  const severityColor = SEVERITY_COLORS[alert.severity] || 'var(--text-muted)';
                  return (
                    <article
                      key={alert.id}
                      className="analytics-card"
                      style={{
                        padding: '16px',
                        borderLeft: `4px solid ${severityColor}`,
                        opacity: alert.status === 'resolved' ? 0.72 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', gap: '16px', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0, flex: '1 1 360px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <StatusBadge status={alert.severity} />
                            <StatusBadge status={alert.status === 'resolved' ? 'healthy' : 'warning'} label={titleCase(alert.status)} />
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatDateTime(alert.time)}</span>
                          </div>
                          <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 850 }}>{alert.title}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                            {alert.description}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>
                            {alert.hiveName} · Device {alert.deviceId ?? '—'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div className="field-label">Reading</div>
                            <div style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 900 }}>{formatTemperature(alert.temperature)}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Threshold {formatTemperature(alert.threshold)}</div>
                          </div>
                          {alert.status !== 'resolved' && alert.severity === 'warning' && (
                            <button type="button" className="primary-btn" onClick={() => handleResolve(alert.id)} disabled={isDemoAccount}>
                              {isDemoAccount ? 'Read-only' : 'Resolve Warning'}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </DashboardSection>
        </div>
      </main>
    </div>
  );
}
