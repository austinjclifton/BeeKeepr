import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from "../components/Navigation";
import { apiFetch, cToF } from '../api';
import { useAuth } from '../hooks/useAuth';

const RANGE_HOURS = { '24H': 24 };
const RANGE_LIMITS = { '24H': 200 };

/* ── Hamburger helper ──────────────────────────────────────────── */
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

/* ── Setup Wizard ──────────────────────────────────────────────── */
function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [hiveName, setHiveName] = useState('');
  const [hiveNotes, setHiveNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hive, setHive] = useState(null);
  const [device, setDevice] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!hiveName.trim()) { setError('Hive name is required.'); return; }
    setError(''); setLoading(true);
    try {
      const hiveRes = await apiFetch('/api/hives', {
        method: 'POST',
        body: JSON.stringify({ name: hiveName.trim(), notes: hiveNotes.trim() || null }),
      });
      const newHive = hiveRes.hive;
      setHive(newHive);
      const deviceRes = await apiFetch(`/api/hives/${newHive.id}/devices`, {
        method: 'POST',
        body: JSON.stringify({ installedAt: new Date().toISOString() }),
      });
      setDevice(deviceRes.device);
      try {
        await apiFetch('/api/auth/alert-settings', {
          method: 'PATCH',
          body: JSON.stringify({
            alerts_enabled: true,
            warning_low_threshold: 93,
            warning_high_threshold: 99,
            critical_low_threshold: 91,
            critical_high_threshold: 104,
          }),
        });
      } catch (_) { /* non-fatal */ }
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to create hive. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.72)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 200, padding: '24px', animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: 'white',
        width: '100%', maxWidth: '440px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)', overflow: 'hidden', animation: 'fadeIn 0.25s ease',
      }}>
        <div style={{ background: '#1e2d4a', padding: '22px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '36px', height: '36px', background: '#f5a623', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2C8 2 5 5 5 9c0 2.5 1.2 4.7 3 6.1V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4.9c1.8-1.4 3-3.6 3-6.1 0-4-3-7-7-7z" fill="white"/></svg>
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: '16px' }}>{step === 1 ? 'Set Up Your Hive' : 'You\'re All Set!'}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginTop: '1px' }}>Step {step} of 2 — {step === 1 ? 'Name your hive' : 'Device registered'}</div>
            </div>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.12)' }}>
            <div style={{ height: '100%', background: '#f5a623', width: step === 1 ? '50%' : '100%', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <div style={{ padding: '24px 26px' }}>
          {step === 1 && (
            <>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>
                Give your hive a name to get started. A device will be registered automatically.
              </p>
              {error && (
                <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>{error}</div>
              )}
              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    Hive Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text" value={hiveName} onChange={e => setHiveName(e.target.value)}
                    placeholder="e.g. Backyard Hive #1" required autoFocus
                    style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', fontSize: '14px', color: '#1e2d4a', background: '#f8fafc', outline: 'none', fontFamily: 'inherit' }}
                    onFocus={e => { e.target.style.borderColor = '#1e2d4a'; e.target.style.background = 'white'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                  />
                </div>
                <div style={{ marginBottom: '22px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    Notes <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <textarea
                    value={hiveNotes} onChange={e => setHiveNotes(e.target.value)}
                    placeholder="Location, colony type, etc." rows={2}
                    style={{ width: '100%', padding: '11px 14px', resize: 'vertical', border: '1.5px solid #e2e8f0', fontSize: '14px', color: '#1e2d4a', background: '#f8fafc', outline: 'none', fontFamily: 'inherit' }}
                    onFocus={e => { e.target.style.borderColor = '#1e2d4a'; e.target.style.background = 'white'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                  />
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', border: 'none', background: loading ? '#94a3b8' : '#1e2d4a', color: 'white', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {loading ? <><span style={{ animation: 'pulse 1s infinite' }}>●</span> Setting up…</> : 'Create Hive →'}
                </button>
              </form>
            </>
          )}

          {step === 2 && device && (
            <>
              {/* Clean success confirmation — no API docs, no curl */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '14px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#15803d' }}>
                  Hive <strong>"{hive?.name}"</strong> is ready to go.
                </div>
              </div>

              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: 1.7 }}>
                Your sensor device has been registered. Power it on and it will automatically start sending data to your dashboard.
              </p>

              {/* Show device ID cleanly, without any API context */}
              <div style={{ marginBottom: '24px', padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Device ID</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e2d4a', letterSpacing: '0.02em' }}>{device.id}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Use this ID when configuring your sensor hardware.</div>
              </div>

              <button onClick={() => onComplete(hive, device)} style={{ width: '100%', padding: '13px', border: 'none', background: '#1e2d4a', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                Go to Dashboard →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── No-readings banner — clean, no developer instructions ──────── */
function NoReadingsBanner({ deviceId }) {
  return (
    <div style={{ margin: '0 16px 16px', background: '#fffbeb', border: '1px solid #fde68a', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>
            Waiting for first sensor reading
          </div>
          <div style={{ fontSize: '12px', color: '#78350f', lineHeight: 1.6 }}>
            Device <strong>{deviceId}</strong> is registered. Power on your sensor and it will connect automatically.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Chart ──────────────────────────────────────────────────────── */
function DashboardChart({ data }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const buildChart = () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      const ctx = canvasRef.current.getContext('2d');
      const Chart = window.Chart;
      const amberGrad = ctx.createLinearGradient(0,0,0,280);
      amberGrad.addColorStop(0,'rgba(245,166,35,0.22)'); amberGrad.addColorStop(1,'rgba(245,166,35,0.02)');
      const grayGrad = ctx.createLinearGradient(0,0,0,280);
      grayGrad.addColorStop(0,'rgba(148,163,184,0.22)'); grayGrad.addColorStop(1,'rgba(148,163,184,0.02)');
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: { labels: data.labels, datasets: [
          { label: 'Internal (°F)', data: data.internal, borderColor: '#f5a623', borderWidth: 2.5, backgroundColor: amberGrad, fill: true, tension: 0.45, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#f5a623', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, spanGaps: false, order: 1 },
          { label: 'External (°F)', data: data.external && data.external.some(v=>v!==null) ? data.external : data.internal.map(()=>null), borderColor: '#1e2d4a', borderWidth: 2, backgroundColor: grayGrad, fill: true, tension: 0.45, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#1e2d4a', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, spanGaps: false, order: 2 },
        ]},
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          animation: { duration: 400, easing: 'easeInOutQuart' },
          plugins: {
            legend: { display: true, position: 'bottom', labels: { color: '#64748b', font: { size: 11 }, boxWidth: 12, usePointStyle: true } },
            tooltip: { backgroundColor: 'rgba(255,255,255,0.97)', titleColor: '#1e2d4a', bodyColor: '#64748b', borderColor: '#e2e8f0', borderWidth: 1, padding: 10, boxPadding: 5, cornerRadius: 0, callbacks: { label: c => c.parsed.y!=null ? `  ${c.dataset.label}: ${c.parsed.y.toFixed(1)}` : null } },
          },
          scales: {
            x: { grid: { color: 'rgba(100,116,139,0.10)', lineWidth: 1, borderDash: [4,4] }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 10, family: "'DM Sans', system-ui" }, maxTicksLimit: 9, maxRotation: 0 } },
            y: { position: 'left', grid: { color: 'rgba(100,116,139,0.10)', lineWidth: 1, borderDash: [4,4] }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 10, family: "'DM Sans', system-ui" }, maxTicksLimit: 6, callback: v => `${v}°F` }, min: 0 },
          },
        },
      });
    };
    if (window.Chart) { buildChart(); } else {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      s.onload = buildChart; document.head.appendChild(s);
    }
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [data]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}

/* ── Temp Card ──────────────────────────────────────────────────── */
function TempCard({ title, value, unit, delta, sensor, accentColor, Icon }) {
  const isNeg = delta < 0;
  const isZero = delta === 0;
  const hasValue = value !== null && value !== undefined && value !== '…';

  return (
    <div style={{ background: 'white', overflow: 'hidden', flex: 1, boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
      <div style={{ height: '3px', background: accentColor }} />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ color: accentColor, display: 'flex', alignItems: 'center' }}><Icon /></span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{title}</span>
          </div>
          {hasValue && !isZero && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: isNeg ? '#ef4444' : '#22c55e', background: isNeg ? '#fef2f2' : '#f0fdf4', padding: '2px 7px', lineHeight: 1 }}>
              {isNeg ? '▼' : '▲'} {Math.abs(delta).toFixed(1)}°F
            </div>
          )}
        </div>

        {hasValue ? (
          <div className="temp-card-value" style={{ fontSize: '38px', fontWeight: 800, color: '#1e2d4a', letterSpacing: '-0.03em', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: '3px' }}>
            {value}
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#64748b' }}>{unit || '°F'}</span>
          </div>
        ) : (
          <div style={{ paddingTop: '4px', paddingBottom: '4px' }}>
            <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>No reading yet</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px' }}>Waiting for sensor data</div>
          </div>
        )}

        <div style={{ marginTop: '8px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>{sensor}</div>
      </div>
    </div>
  );
}

const ThermIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>;
const WindIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>;

/* ── System Events ──────────────────────────────────────────────── */
function SystemEventList({ hiveId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hiveId) { setLoading(false); return; }
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    apiFetch(`/api/readings/since?hiveId=${hiveId}&since=${since}&order=desc&limit=5`)
      .then(res => {
        const readings = res?.readings ?? [];
        const mapped = readings.map(r => {
          const tf = cToF(parseFloat(r.temperature));
          let type = 'info';
          let msg = `Temperature reading: ${tf.toFixed(1)}°F`;
          if (tf < 91) { type = 'warning'; msg = `Low temperature detected: ${tf.toFixed(1)}°F`; }
          else if (tf > 99) { type = 'warning'; msg = `High temperature detected: ${tf.toFixed(1)}°F`; }
          const d = new Date(r.bucket_at);
          return {
            type,
            time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
            message: msg,
          };
        });
        setEvents(mapped);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [hiveId]);

  const EVENT_STYLES = {
    warning: { bg: '#fffbeb', border: '#fde68a', labelBg: '#fef3c7', labelColor: '#d97706', text: 'WARNING' },
    info:    { bg: '#f0f9ff', border: '#bae6fd', labelBg: '#e0f2fe', labelColor: '#0284c7', text: 'INFO' },
    system:  { bg: '#f0fdf4', border: '#bbf7d0', labelBg: '#dcfce7', labelColor: '#16a34a', text: 'SYSTEM' },
  };

  if (loading) {
    return <div style={{ padding: '20px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>Loading events…</div>;
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: '20px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
        No recent readings. Power on your sensor to see events here.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {events.map((evt, i) => {
        const s = EVENT_STYLES[evt.type] || EVENT_STYLES.info;
        return (
          <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, padding: '11px 13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, background: s.labelBg, color: s.labelColor, padding: '2px 8px', letterSpacing: '0.05em' }}>{s.text}</span>
              <span style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {evt.time}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>{evt.message}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Dashboard ──────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const { ready: authReady, error: authError } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [latest, setLatest] = useState(null);
  const [externalCondition, setExternalCondition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [hive, setHive] = useState(null);
  const [device, setDevice] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [hasRealReadings, setHasRealReadings] = useState(false);
  const hiveIdRef = useRef(null);

  useEffect(() => {
    if (!authReady) return;
    if (authError) { setLoading(false); return; }

    async function load() {
      try {
        const hivesRes = await apiFetch('/api/hives');
        const hives = hivesRes?.hives ?? [];
        if (!hives.length) { setShowSetup(true); setLoading(false); return; }

        const foundHive = hives[0];
        setHive(foundHive);
        hiveIdRef.current = foundHive.id;

        const devicesRes = await apiFetch(`/api/hives/${foundHive.id}/devices`);
        const devices = devicesRes?.devices ?? [];
        if (devices.length > 0) setDevice(devices[0]);

        const [latestRes, extRes] = await Promise.allSettled([
          apiFetch(`/api/readings/latest?hiveId=${foundHive.id}`),
          apiFetch(`/api/external-conditions/latest?hiveId=${foundHive.id}`),
        ]);

        if (latestRes.status === 'fulfilled') {
          const r = latestRes.value?.reading ?? latestRes.value?.readings?.[0] ?? null;
          setLatest(r);
          if (r) setHasRealReadings(true);
        }
        if (extRes.status === 'fulfilled') setExternalCondition(extRes.value?.externalCondition ?? null);

        await fetchChartData(foundHive.id, '24H');
      } catch {
        setChartData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authReady, authError]);

  const fetchChartData = useCallback(async (hid, range) => {
    const id = hid ?? hiveIdRef.current;
    if (!id) { setChartData(null); return; }
    setChartLoading(true);
    try {
      const since = new Date(Date.now() - RANGE_HOURS[range] * 3600 * 1000).toISOString();
      const limit = RANGE_LIMITS[range] ?? 200;

      const [readingsRes, extRes] = await Promise.allSettled([
        apiFetch(`/api/readings/since?hiveId=${id}&since=${since}&order=asc&limit=${limit}`),
        apiFetch(`/api/external-conditions/since?hiveId=${id}&since=${since}&order=asc`),
      ]);

      const readings = readingsRes.status === 'fulfilled' ? (readingsRes.value?.readings ?? []) : [];
      const externalConditions = extRes.status === 'fulfilled' ? (extRes.value?.externalConditions ?? []) : [];

      if (readings.length > 1) {
        const extByTs = {};
        externalConditions.forEach(ec => {
          const ts = Math.floor(new Date(ec.bucket_at).getTime() / (10 * 60 * 1000));
          extByTs[ts] = ec.temperature;
        });

        const labels = readings.map(r => {
          const d = new Date(r.bucket_at);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          return `${hh}:${mm}`;
        });

        const internal = readings.map(r => cToF(parseFloat(r.temperature ?? 0)));

        const external = readings.map(r => {
          const ts = Math.floor(new Date(r.bucket_at).getTime() / (10 * 60 * 1000));
          for (const offset of [0, 1, -1]) {
            const val = extByTs[ts + offset];
            if (val !== undefined && val !== null) return parseFloat(parseFloat(val).toFixed(2));
          }
          return null;
        });
        setChartData({ labels, internal, external });
        setHasRealReadings(true);
      } else {
        setChartData(null);
      }
    } catch {
      setChartData(null);
    } finally {
      setChartLoading(false);
    }
  }, []);

  const handleManualChartRefresh = () => {
    if (hiveIdRef.current && !chartLoading) {
      fetchChartData(hiveIdRef.current, '24H');
    }
  };

  // Auto-connect: fetch external conditions immediately after setup so the
  // weather card populates without requiring any manual action from the user.
  const handleSetupComplete = async (newHive, newDevice) => {
    setHive(newHive); setDevice(newDevice);
    hiveIdRef.current = newHive.id;
    setShowSetup(false);

    try {
      await apiFetch(`/api/external-conditions/fetch?hiveId=${newHive.id}`, { method: 'POST' });
      const extRes = await apiFetch(`/api/external-conditions/latest?hiveId=${newHive.id}`);
      setExternalCondition(extRes?.externalCondition ?? null);
    } catch (_) { /* non-fatal — sensor data will appear once the device connects */ }

    fetchChartData(newHive.id, '24H');
  };

  const latestF = latest?.temperature != null ? cToF(latest.temperature) : null;

  const externalF = externalCondition?.temperature != null
    ? parseFloat(parseFloat(externalCondition.temperature).toFixed(1))
    : null;

  const internalDelta = !loading && chartData?.internal?.length >= 2
    ? parseFloat((
        chartData.internal[chartData.internal.length - 1] -
        chartData.internal[chartData.internal.length - 2]
      ).toFixed(1))
    : 0;

  const externalDelta = !loading && chartData?.external?.length >= 2
    ? (() => {
        const extVals = chartData.external.filter(v => v !== null);
        if (extVals.length >= 2) return parseFloat((extVals[extVals.length - 1] - extVals[extVals.length - 2]).toFixed(1));
        return 0;
      })()
    : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Navigation />
      {showSetup && <SetupWizard onComplete={handleSetupComplete} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {/* ── Page header ── */}
        <div className="mob-pad-top" style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <HamburgerBtn />
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1e2d4a', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Dashboard</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>HIVE:</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e2d4a' }}>
              {loading ? 'Loading…' : hive ? `#${hive.id}` : 'No hive'}
            </span>
            {!loading && (
              <span className="status-dot" style={{
                width: '10px', height: '10px',
                background: hasRealReadings ? '#22c55e' : '#f59e0b',
                display: 'inline-block',
                borderRadius: '50%',
                boxShadow: `0 0 0 3px ${hasRealReadings ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
              }} title={hasRealReadings ? 'Receiving data' : 'No readings yet'} />
            )}
          </div>
        </div>

        {/* Clean waiting banner — no curl commands */}
        {!loading && hive && !hasRealReadings && (
          device
            ? <NoReadingsBanner deviceId={device.id} />
            : (
              <div style={{ margin: '0 16px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '14px 20px', fontSize: '13px', color: '#1d4ed8', fontWeight: 500 }}>
                No device is registered to this hive yet.
              </div>
            )
        )}

        <div className="mob-pad" style={{ padding: '0 28px 28px' }}>
          {/* ── Temp cards ── */}
          <div className="dashboard-temp-row" style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <TempCard
              title="Internal Temperature"
              value={loading ? '…' : latestF}
              unit="°F"
              delta={internalDelta}
              sensor={device ? `Device ${device.id}` : 'No device registered'}
              accentColor="#f5a623"
              Icon={ThermIcon}
            />
            <TempCard
              title="External Temperature"
              value={loading ? '…' : externalF}
              unit="°F"
              delta={externalDelta}
              sensor={externalCondition?.provider ? `Provider: ${externalCondition.provider}` : 'External sensor'}
              accentColor="#1e2d4a"
              Icon={WindIcon}
            />
          </div>

          {/* ── Main grid ── */}
          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'start' }}>
            {/* Chart */}
            <div style={{ background: 'white', padding: '22px 22px 14px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e2d4a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Temperature Analysis
                    {chartLoading && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>Loading…</span>}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '3px' }}>Internal vs External (°F): Last 24 Hours</div>
                </div>
                <button
                  onClick={handleManualChartRefresh}
                  disabled={chartLoading}
                  title="Refresh chart"
                  style={{
                    padding: '5px 10px', border: '1px solid #e2e8f0',
                    background: 'white', color: chartLoading ? '#94a3b8' : '#64748b',
                    fontSize: '11px', fontWeight: 700, cursor: chartLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!chartLoading) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <svg
                    width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ animation: chartLoading ? 'spin 1s linear infinite' : 'none' }}
                  >
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Refresh
                </button>
              </div>
              <div className="dashboard-chart-wrap" style={{ height: '290px' }}>
                {chartData ? (
                  <DashboardChart data={chartData} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '28px' }}>📊</span>
                    <span style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                      {chartLoading ? 'Loading data…' : 'No readings available yet for this range.'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* System Events */}
            <div style={{ background: 'white', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e2d4a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Events</div>
                <button onClick={() => navigate('/alerts')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 800, color: '#f5a623', letterSpacing: '0.05em', textTransform: 'uppercase' }}>View All</button>
              </div>
              <SystemEventList hiveId={hive?.id} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}