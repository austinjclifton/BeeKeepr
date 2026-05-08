import { useState, useEffect } from 'react';
import Navigation from "../components/Navigation";
import { apiFetch } from '../api';
import { useAuth } from '../hooks/useAuth';

const PREF_KEY = 'asheville_settings_v1';

function loadLocalPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (parseFloat(p.criticalLow) < 60 || parseFloat(p.criticalHigh) < 60) {
        return { ...p, criticalLow: '91', criticalHigh: '104', optimalLow: '93', optimalHigh: '99', tempUnit: 'fahrenheit' };
      }
      return p;
    }
  } catch {}
  return { criticalLow: '91', criticalHigh: '104', optimalLow: '93', optimalHigh: '99', alertEmail: '', interval: '10', tempUnit: 'fahrenheit', enableCritical: true, enableWarning: true, enableInfo: false, enableEmail: true, enableSMS: false, role: 'Beekeeper', phoneNum: '' };
}
function saveLocalPrefs(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {} }

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* Hamburger trigger */
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

/* ── Threshold Slider ─────────────────────────────────────────── */
function ThresholdSlider({ label, value, min, max, onChange, color, alertText }) {
  const pct = Math.max(0, Math.min(100, ((parseFloat(value) - min) / (max - min)) * 100));
  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color }}>{parseFloat(value).toFixed(1)}°F</span>
      </div>
      <input
        type="range" min={min} max={max} step={0.5} value={parseFloat(value)}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: `linear-gradient(to right, ${color} ${pct}%, #e2e8f0 ${pct}%)`, '--slider-color': color, borderRadius: '0' }}
      />
      {alertText && <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px', lineHeight: 1.5 }}>{alertText}</p>}
    </div>
  );
}

/* ── Toggle Row ───────────────────────────────────────────────── */
function ToggleRow({ icon, label, description, checked, onChange, activeColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: '36px', height: '36px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#94a3b8' }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e2d4a' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{description}</div>
      </div>
      <button
        role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        style={{ width: '46px', height: '26px', border: 'none', background: checked ? (activeColor || '#1e2d4a') : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, borderRadius: '0' }}
      >
        <span style={{ position: 'absolute', top: '4px', left: checked ? '24px' : '4px', width: '18px', height: '18px', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', borderRadius: '0' }} />
      </button>
    </div>
  );
}

/* ── Section Card ─────────────────────────────────────────────── */
function SectionCard({ icon, title, children }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ color: '#f5a623' }}>{icon}</span>
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e2d4a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </div>
  );
}

/* ── Field Input ──────────────────────────────────────────────── */
function Field({ label, value, onChange, type = 'text', disabled }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</label>
      <input
        type={type} value={value} onChange={onChange ? e => onChange(e.target.value) : undefined}
        disabled={disabled}
        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', fontSize: '14px', color: disabled ? '#94a3b8' : '#1e2d4a', background: disabled ? '#f8fafc' : 'white', outline: 'none', cursor: disabled ? 'default' : 'text' }}
        onFocus={e => { if (!disabled) e.target.style.borderColor = '#1e2d4a'; }}
        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
      />
    </div>
  );
}

/* ── Change Password Modal ────────────────────────────────────── */
function ChangePasswordModal({ onClose, onSuccess }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (next !== confirm) { setError('Passwords do not match.'); return; }
    if (next.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try { await apiFetch('/api/auth/change-password', { method: 'PATCH', body: JSON.stringify({ currentPassword: current, newPassword: next }) }); onSuccess(); }
    catch (err) { setError(err.message || 'Failed to change password.'); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'white', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e2d4a' }}>Change Password</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>
        {error && <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}><Field label="Current Password" value={current} onChange={setCurrent} type="password" /></div>
          <div style={{ marginBottom: '14px' }}><Field label="New Password" value={next} onChange={setNext} type="password" /></div>
          <div style={{ marginBottom: '20px' }}><Field label="Confirm New Password" value={confirm} onChange={setConfirm} type="password" /></div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', background: 'white', fontSize: '14px', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', border: 'none', background: loading ? '#94a3b8' : '#1e2d4a', color: 'white', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Saving…' : 'Update'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Settings ────────────────────────────────────────────── */
export default function Settings() {
  const { ready: authReady, error: authError } = useAuth();
  const [localPrefs, setLocalPrefs] = useState(loadLocalPrefs);
  const [displayName, setDisplayName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [deviceLastSeen, setDeviceLastSeen] = useState(null);
  const [hiveInfo, setHiveInfo] = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(true);

  const setLocalPref = (key, val) => setLocalPrefs(p => ({ ...p, [key]: val }));

  useEffect(() => {
    if (!authReady || authError) { setDeviceLoading(false); return; }
    async function load() {
      try {
        const [meRes, hivesRes, devicesRes] = await Promise.allSettled([
          apiFetch('/api/auth/me'), apiFetch('/api/hives'), apiFetch('/api/devices'),
        ]);
        if (meRes.status === 'fulfilled') {
          const u = meRes.value?.user;
          if (u) { setDisplayName(u.username || ''); setAccountEmail(u.email || ''); if (u.phone && !localPrefs.phoneNum) setLocalPref('phoneNum', u.phone); }
        }
        let hiveId = null;
        if (hivesRes.status === 'fulfilled') {
          const h = hivesRes.value?.hives ?? [];
          if (h.length) { setHiveInfo(h[0]); hiveId = h[0].id; }
        }
        if (devicesRes.status === 'fulfilled') {
          const d = devicesRes.value?.devices ?? [];
          if (d.length) {
            setDeviceId(d[0].id);
            let lastSeen = d[0].last_seen_at;
            // ingest doesn't call touchLastSeen, so check latest reading too
            if (hiveId) {
              try {
                const latestRes = await apiFetch(`/api/readings/latest?hiveId=${hiveId}`);
                const rt = latestRes?.reading?.received_at ?? latestRes?.reading?.bucket_at;
                if (rt && (!lastSeen || new Date(rt) > new Date(lastSeen))) lastSeen = rt;
              } catch {}
            }
            setDeviceLastSeen(lastSeen);
            // One-time silent sync: push local defaults to backend if never done before
            const syncKey = 'asheville_thresholds_synced_v1';
            if (!localStorage.getItem(syncKey)) {
              const p = loadLocalPrefs();
              const cl = parseFloat(p.criticalLow);
              const ch = parseFloat(p.criticalHigh);
              const ol = parseFloat(p.optimalLow);
              const oh = parseFloat(p.optimalHigh);
              if (cl < ol && ol < oh && oh < ch) {
                try {
                  await apiFetch('/api/auth/alert-settings', {
                    method: 'PATCH',
                    body: JSON.stringify({
                      alerts_enabled: true,
                      warning_low_threshold: ol,
                      warning_high_threshold: oh,
                      critical_low_threshold: cl,
                      critical_high_threshold: ch,
                    }),
                  });
                  localStorage.setItem(syncKey, '1');
                } catch (_) { /* non-fatal */ }
              }
            }
          }
        }
      } catch {} finally { setDeviceLoading(false); }
    }
    load();
  }, [authReady, authError]);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); };

  const handleSave = async () => {
    setSaving(true);
    const cl = parseFloat(localPrefs.criticalLow), ch = parseFloat(localPrefs.criticalHigh);
    const ol = parseFloat(localPrefs.optimalLow), oh = parseFloat(localPrefs.optimalHigh);

    if (isNaN(cl) || isNaN(ch) || isNaN(ol) || isNaN(oh)) {
      showToast('All thresholds must be valid numbers.', false); setSaving(false); return;
    }
    if (cl >= ch) {
      showToast('Critical low must be less than critical high.', false); setSaving(false); return;
    }
    if (ol >= oh) {
      showToast('Warning low must be less than warning high.', false); setSaving(false); return;
    }
    if (ol <= cl || oh >= ch) {
      showToast('Warning range must be strictly within the critical range.', false); setSaving(false); return;
    }

    const toSave = { ...localPrefs, tempUnit: 'fahrenheit' };
    saveLocalPrefs(toSave);
    setLocalPrefs(toSave);

    try {
      await apiFetch('/api/auth/alert-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          alerts_enabled: true,
          warning_low_threshold: ol,
          warning_high_threshold: oh,
          critical_low_threshold: cl,
          critical_high_threshold: ch,
        }),
      });
      showToast('Settings saved successfully');
    } catch (err) {
      showToast(err.message || 'Alert settings update failed.', false);
    }

    setSaving(false);
  };

  const isOnline = !!(deviceLastSeen && (Date.now() - new Date(deviceLastSeen).getTime()) < 30 * 60 * 1000);
  const sensorId = deviceId != null ? String(deviceId) : '—';
  const firmwareVersion = 'V.2.4.1';

  const statusLabel = deviceLoading
    ? '—'
    : deviceId != null
      ? (isOnline ? 'Online' : 'Offline')
      : 'No Device';
  const statusColor = isOnline ? '#22c55e' : '#94a3b8';
  const statusBorder = isOnline ? '#22c55e' : '#e2e8f0';
  const statusTextColor = isOnline ? '#16a34a' : '#64748b';

  const PersonIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  const BellIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  const ThermIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>;
  const ShieldIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  const MailIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      <Navigation />
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} onSuccess={() => { setShowPasswordModal(false); showToast('Password updated'); }} />}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 999, background: toast.ok ? '#1e2d4a' : '#ef4444', color: 'white', padding: '10px 18px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', animation: 'fadeIn 0.2s ease' }}>
          {toast.msg}
        </div>
      )}

      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {/* Top bar */}
        <div className="mob-topbar-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <HamburgerBtn />
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#1e2d4a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Settings</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>HIVE:</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e2d4a' }}>
              {hiveInfo ? `#${hiveInfo.id}` : '—'}
            </span>
            <span className="status-dot" style={{
              width: '10px', height: '10px',
              background: isOnline ? '#22c55e' : '#94a3b8',
              display: 'inline-block',
              borderRadius: '50%',
              boxShadow: isOnline ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none',
            }} />
          </div>
        </div>

        <div className="mob-pad" style={{ padding: '28px 32px' }}>
          {/* Config header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1e2d4a', letterSpacing: '-0.01em' }}>Configuration</h1>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Manage Preferences &amp; Alerts</div>
            </div>
            <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: saving ? '#94a3b8' : '#1e2d4a', color: 'white', border: 'none', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          {/* Operator Profile */}
          <SectionCard icon={<PersonIcon />} title="Operator Profile">
            <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <Field label="Full Name" value={displayName} disabled />
              <Field label="Role" value={localPrefs.role || 'Beekeeper'} onChange={v => setLocalPref('role', v)} />
            </div>
            <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Field label="Email Address" value={accountEmail} disabled />
              {/* <Field label="Phone Number" value={localPrefs.phoneNum || ''} onChange={v => setLocalPref('phoneNum', v)} /> */}
            </div>
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setShowPasswordModal(true)} style={{ background: 'none', border: 'none', color: '#f5a623', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Change Password →
              </button>
            </div>
          </SectionCard>

          {/* Notifications */}
          <SectionCard icon={<BellIcon />} title="Notifications">
            <ToggleRow
              icon={<MailIcon />}
              label="Email Digests"
              description="Receive daily summary reports via email."
              checked={localPrefs.enableEmail}
              onChange={v => setLocalPref('enableEmail', v)}
              activeColor="#1e2d4a"
            />
          </SectionCard>

          {/* Sensor Thresholds */}
          <SectionCard icon={<ThermIcon />} title="Sensor Thresholds">
            <div className="threshold-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '28px' }}>
              <ThresholdSlider
                label="Min Internal Temp"
                value={localPrefs.criticalLow}
                min={60} max={110}
                onChange={v => setLocalPref('criticalLow', v)}
                color="#1e2d4a"
                alertText="Alert triggers when core temperature drops below this value."
              />
              <ThresholdSlider
                label="Max Internal Temp"
                value={localPrefs.criticalHigh}
                min={90} max={140}
                onChange={v => setLocalPref('criticalHigh', v)}
                color="#f5a623"
                alertText="Alert triggers when core temperature exceeds this value."
              />
            </div>
            <div className="threshold-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <ThresholdSlider
                label="Warning Range Low"
                value={localPrefs.optimalLow}
                min={60} max={110}
                onChange={v => setLocalPref('optimalLow', v)}
                color="#3b82f6"
                alertText="Warning triggered when temperature falls below warning range."
              />
              <ThresholdSlider
                label="Warning Range High"
                value={localPrefs.optimalHigh}
                min={90} max={140}
                onChange={v => setLocalPref('optimalHigh', v)}
                color="#3b82f6"
                alertText="Warning triggered when temperature rises above warning range."
              />
            </div>
          </SectionCard>

          {/* System Information */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#94a3b8' }}><ShieldIcon /></span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>System Information</span>
            </div>
            <div className="settings-sysinfo-grid" style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Firmware Ver.</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e2d4a' }}>{firmwareVersion}</div>
              </div>

              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Last Sync</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e2d4a' }}>
                  {deviceLoading ? '—' : timeAgo(deviceLastSeen)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Sensor ID</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e2d4a' }}>
                  {deviceLoading ? '—' : sensorId}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Status</div>
                {deviceLoading ? (
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>—</div>
                ) : (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '3px 10px',
                    border: `1px solid ${statusBorder}`,
                    fontSize: '11px', fontWeight: 700,
                    color: statusTextColor,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    {deviceId != null && (
                      <span style={{
                        width: '6px', height: '6px',
                        background: statusColor,
                        display: 'inline-block',
                        borderRadius: '50%',
                        flexShrink: 0,
                      }} />
                    )}
                    {statusLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}