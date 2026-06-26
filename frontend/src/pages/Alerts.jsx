import { useEffect, useMemo, useState } from 'react';
import HamburgerBtn from '../components/HamburgerBtn';
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
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#60a5fa',
};

const statGridClass = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4';
const fieldLabelClass = 'mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted';
const selectClass = 'w-full rounded-md border border-line bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none focus:border-amber';
const inputClass = 'flex-[1_1_220px] rounded-md border border-line bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none focus:border-amber';
const primaryBtnClass = 'cursor-pointer rounded-pill border-none bg-amber px-3.5 py-2.5 text-[12px] font-black text-navy transition disabled:cursor-not-allowed disabled:opacity-55';
const ghostBtnClass = 'cursor-pointer rounded-pill border border-line bg-white/[0.05] px-3 py-2 text-[12px] font-extrabold text-ink-secondary transition hover:border-amber/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-55';

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
    <div className="app-shell flex min-h-screen">
      <Navigation />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="mx-auto w-full max-w-content px-7 py-7">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2.5">
                <HamburgerBtn />
                <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">Activity</div>
              </div>
              <h1 className="text-[clamp(26px,4vw,42px)] font-black leading-none text-white">Alerts</h1>
              <p className="mt-2 text-[14px] text-ink-secondary">Temperature threshold activity across all owned hives.</p>
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

          <div className={statGridClass}>
            <StatCard label="Total Alerts" value={metricsLoading ? '—' : String(counts.total)} detail="Loaded from the activity API" />
            <StatCard label="Active" value={metricsLoading ? '—' : String(counts.active)} detail="Unresolved alerts" tone="warning" />
            <StatCard label="Warnings" value={metricsLoading ? '—' : String(counts.warning)} tone="warning" />
            <StatCard label="Critical" value={metricsLoading ? '—' : String(counts.critical)} tone="critical" />
          </div>

          {isDemoAccount && (
            <div className="mt-4.5 border-amber/35 p-3.5 text-ink-secondary">
              <strong className="text-amber">Demo account:</strong> alert resolution is disabled for shared demo data.
            </div>
          )}

          <DashboardSection title="Alert Stream" eyebrow="Multi-Hive">
            <div className="mb-3.5 p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" className={severityFilter === 'all' ? primaryBtnClass : ghostBtnClass} onClick={() => setSeverityFilter('all')}>All Severity</button>
                <button type="button" className={severityFilter === 'critical' ? primaryBtnClass : ghostBtnClass} onClick={() => setSeverityFilter('critical')}>Critical</button>
                <button type="button" className={severityFilter === 'warning' ? primaryBtnClass : ghostBtnClass} onClick={() => setSeverityFilter('warning')}>Warning</button>
                <button type="button" className={statusFilter === 'active' ? primaryBtnClass : ghostBtnClass} onClick={() => setStatusFilter('active')}>Active</button>
                <button type="button" className={statusFilter === 'resolved' ? primaryBtnClass : ghostBtnClass} onClick={() => setStatusFilter('resolved')}>Resolved</button>
                <button type="button" className={statusFilter === 'all' ? primaryBtnClass : ghostBtnClass} onClick={() => setStatusFilter('all')}>All Status</button>
                <input
                  className={inputClass}
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
              <div className="grid gap-2.5">
                {filtered.map(alert => {
                  const severityColor = SEVERITY_COLORS[alert.severity] || 'rgba(255,255,255,0.45)';
                  return (
                    <article
                      key={alert.id}
                      className="p-4"
                      style={{
                        borderLeft: `4px solid ${severityColor}`,
                        opacity: alert.status === 'resolved' ? 0.72 : 1,
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-[1_1_360px]">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <StatusBadge status={alert.severity} />
                            <StatusBadge status={alert.status === 'resolved' ? 'healthy' : 'warning'} label={titleCase(alert.status)} />
                            <span className="text-[12px] text-ink-muted">{formatDateTime(alert.time)}</span>
                          </div>
                          <div className="text-[15px] font-extrabold text-white">{alert.title}</div>
                          <div className="mt-1 text-[13px] text-ink-secondary">
                            {alert.description}
                          </div>
                          <div className="mt-2 text-[12px] text-ink-muted">
                            {alert.hiveName} · Device {alert.deviceId ?? '—'}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2.5">
                          <div className="text-right">
                            <div className={fieldLabelClass}>Reading</div>
                            <div className="text-[20px] font-black text-white">{formatTemperature(alert.temperature)}</div>
                            <div className="text-[12px] text-ink-muted">Threshold {formatTemperature(alert.threshold)}</div>
                          </div>
                          {alert.status !== 'resolved' && alert.severity === 'warning' && (
                            <button type="button" className={primaryBtnClass} onClick={() => handleResolve(alert.id)} disabled={isDemoAccount}>
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
