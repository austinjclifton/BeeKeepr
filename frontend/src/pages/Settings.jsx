import { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
import DashboardSection from '../components/analytics/DashboardSection';
import HiveSelector from '../components/analytics/HiveSelector';
import StatCard from '../components/analytics/StatCard';
import StatusBadge from '../components/analytics/StatusBadge';
import { ErrorState, LoadingState } from '../components/analytics/StateBlocks';
import {
  apiFetch,
  friendlyApiMessage,
  getHiveDevices,
  getHiveLatestReading,
} from '../api';
import { useAuth } from '../hooks/useAuth';
import { useHiveStatus } from '../hooks/useHiveStatus';
import { useSelectedHive } from '../hooks/useSelectedHive';
import {
  LEGACY_SETTINGS_PREF_KEY,
  SETTINGS_PREF_KEY,
  readMigratedJson,
  writeJson,
} from '../storageKeys';
import {
  formatDateTime,
  formatTemperature,
  getHiveId,
} from '../utils/analyticsFormat';

// Local settings defaults
function loadLocalPrefs() {
  const prefs = readMigratedJson(SETTINGS_PREF_KEY, LEGACY_SETTINGS_PREF_KEY);
  if (prefs) {
    if (parseFloat(prefs.criticalLow) < 60 || parseFloat(prefs.criticalHigh) < 60) {
      return defaultPrefs();
    }
    return { ...defaultPrefs(), ...prefs, tempUnit: 'fahrenheit' };
  }
  return defaultPrefs();
}

function defaultPrefs() {
  return {
    criticalLow: '91',
    criticalHigh: '104',
    optimalLow: '93',
    optimalHigh: '99',
    enableEmail: true,
    role: 'Beekeeper',
    tempUnit: 'fahrenheit',
  };
}

function saveLocalPrefs(prefs) {
  writeJson(SETTINGS_PREF_KEY, prefs);
}

// Threshold helpers
function prefsWithThresholds(prefs, source) {
  const next = { ...prefs };
  const mapping = [
    ['criticalLow', source?.critical_low_threshold],
    ['criticalHigh', source?.critical_high_threshold],
    ['optimalLow', source?.warning_low_threshold],
    ['optimalHigh', source?.warning_high_threshold],
  ];

  for (const [key, value] of mapping) {
    const n = Number(value);
    if (Number.isFinite(n)) next[key] = String(n);
  }

  return next;
}

function thresholdStateFromHive(hive, fallbackPrefs) {
  return {
    criticalLow: thresholdInputValue(hive?.criticalLowThreshold, fallbackPrefs.criticalLow),
    warningLow: thresholdInputValue(hive?.warningLowThreshold, fallbackPrefs.optimalLow),
    warningHigh: thresholdInputValue(hive?.warningHighThreshold, fallbackPrefs.optimalHigh),
    criticalHigh: thresholdInputValue(hive?.criticalHighThreshold, fallbackPrefs.criticalHigh),
  };
}

function thresholdInputValue(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n)) return String(n);
  return fallback ?? '';
}

function parseThresholds(values) {
  const parsed = {
    criticalLow: Number(values.criticalLow),
    warningLow: Number(values.warningLow),
    warningHigh: Number(values.warningHigh),
    criticalHigh: Number(values.criticalHigh),
  };

  if (Object.values(parsed).some(value => !Number.isFinite(value))) {
    throw new Error('All thresholds must be valid numbers.');
  }

  if (!(parsed.criticalLow < parsed.warningLow && parsed.warningLow < parsed.warningHigh && parsed.warningHigh < parsed.criticalHigh)) {
    throw new Error('Threshold order must be critical low, warning low, warning high, critical high.');
  }

  return parsed;
}

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

function Field({ label, value, onChange, type = 'text', disabled = false }) {
  return (
    <label style={{ display: 'grid', gap: '8px' }}>
      <span className="field-label">{label}</span>
      <input
        className="dark-input"
        type={type}
        value={value}
        disabled={disabled}
        onChange={event => onChange?.(event.target.value)}
      />
    </label>
  );
}

function ThresholdInput({ label, value, onChange, tone, disabled = false }) {
  return (
    <label className="analytics-card" style={{ display: 'grid', gap: '10px', padding: '16px' }}>
      <span className="field-label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          className="dark-input"
          type="number"
          step="0.5"
          value={value}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
        />
        <span style={{ color: tone || 'var(--amber)', fontWeight: 900 }}>°F</span>
      </div>
    </label>
  );
}

function ChangePasswordModal({ onClose, onSuccess }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (next.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      onSuccess();
    } catch (err) {
      setError(friendlyApiMessage(err, 'Failed to change password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <form className="analytics-card" onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '430px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
          <div>
            <div className="section-eyebrow">Account Security</div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '20px' }}>Change Password</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>Close</button>
        </div>
        {error && <ErrorState message={error} />}
        <div style={{ display: 'grid', gap: '14px' }}>
          <Field label="Current Password" value={current} onChange={setCurrent} type="password" />
          <Field label="New Password" value={next} onChange={setNext} type="password" />
          <Field label="Confirm New Password" value={confirm} onChange={setConfirm} type="password" />
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Saving…' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Settings() {
  // Account and selected hive state
  const { ready: authReady, user, error: authError } = useAuth();
  const status = useHiveStatus('1d', { enabled: authReady && !authError });
  const { selectedHive, selectedHiveId, setSelectedHiveId } = useSelectedHive(status.hives);
  const [localPrefs, setLocalPrefs] = useState(loadLocalPrefs);
  const [displayName, setDisplayName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [device, setDevice] = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hiveThresholdSaving, setHiveThresholdSaving] = useState(false);
  const [hiveThresholds, setHiveThresholds] = useState(() => thresholdStateFromHive(null, loadLocalPrefs()));
  const [toast, setToast] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const setLocalPref = (key, value) => setLocalPrefs(prev => ({ ...prev, [key]: value }));
  const setHiveThreshold = (key, value) => setHiveThresholds(prev => ({ ...prev, [key]: value }));
  const isDemoAccount =
    import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true' &&
    import.meta.env.VITE_DEMO_USERNAME &&
    user?.username === import.meta.env.VITE_DEMO_USERNAME;

  // Load account defaults
  useEffect(() => {
    if (!authReady || authError) return;
    let cancelled = false;

    async function loadAccount() {
      try {
        const res = await apiFetch('/api/auth/me');
        if (!cancelled && res?.user) {
          setDisplayName(res.user.username || '');
          setAccountEmail(res.user.email || '');
          setLocalPrefs(prev => prefsWithThresholds(prev, res.user));
        }
      } catch {
        if (!cancelled) setToast({ msg: 'Could not load account profile.', ok: false });
      }
    }

    loadAccount();
    return () => { cancelled = true; };
  }, [authReady, authError]);

  // Load selected hive device context
  useEffect(() => {
    const hiveId = Number(selectedHiveId);
    if (!Number.isInteger(hiveId) || hiveId <= 0) {
      setDevice(null);
      setLatestReading(null);
      return;
    }

    let cancelled = false;
    async function loadHiveContext() {
      setDeviceLoading(true);
      try {
        const [devicesRes, latestRes] = await Promise.allSettled([
          getHiveDevices(hiveId),
          getHiveLatestReading(hiveId),
        ]);
        if (!cancelled) {
          const devices = devicesRes.status === 'fulfilled' ? (devicesRes.value?.devices ?? []) : [];
          const matchingDevice = devices.find(item => Number(item.hive_id ?? item.hiveId) === hiveId) ?? devices.find(Boolean) ?? null;
          setDevice(matchingDevice);
          setLatestReading(latestRes.status === 'fulfilled' ? (latestRes.value?.reading ?? null) : null);
        }
      } finally {
        if (!cancelled) setDeviceLoading(false);
      }
    }

    loadHiveContext();
    return () => { cancelled = true; };
  }, [selectedHiveId]);

  // Sync threshold inputs with hive data
  useEffect(() => {
    setHiveThresholds(thresholdStateFromHive(selectedHive, localPrefs));
  }, [
    selectedHiveId,
    selectedHive?.warningLowThreshold,
    selectedHive?.warningHighThreshold,
    selectedHive?.criticalLowThreshold,
    selectedHive?.criticalHighThreshold,
    localPrefs.criticalLow,
    localPrefs.criticalHigh,
    localPrefs.optimalLow,
    localPrefs.optimalHigh,
  ]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  // Save global defaults
  const handleSave = async () => {
    setSaving(true);

    let thresholds;
    try {
      thresholds = parseThresholds({
        criticalLow: localPrefs.criticalLow,
        warningLow: localPrefs.optimalLow,
        warningHigh: localPrefs.optimalHigh,
        criticalHigh: localPrefs.criticalHigh,
      });
    } catch (err) {
      showToast(err.message, false);
      setSaving(false);
      return;
    }

    const toSave = { ...localPrefs, tempUnit: 'fahrenheit' };
    saveLocalPrefs(toSave);
    setLocalPrefs(toSave);

    try {
      const res = await apiFetch('/api/auth/alert-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          alerts_enabled: true,
          warning_low_threshold: thresholds.warningLow,
          warning_high_threshold: thresholds.warningHigh,
          critical_low_threshold: thresholds.criticalLow,
          critical_high_threshold: thresholds.criticalHigh,
        }),
      });
      await status.refresh();
      const count = res?.alert_settings?.propagated_hive_count;
      showToast(Number.isFinite(Number(count)) ? `Global defaults saved and applied to ${count} active hives.` : 'Global alert defaults saved.');
    } catch (err) {
      showToast(friendlyApiMessage(err, 'Alert settings update failed.'), false);
    } finally {
      setSaving(false);
    }
  };

  // Save selected hive thresholds
  const handleSaveHiveThresholds = async () => {
    const hiveId = Number(selectedHiveId);
    if (!Number.isInteger(hiveId) || hiveId <= 0) {
      showToast('Choose a hive before saving hive thresholds.', false);
      return;
    }

    let thresholds;
    try {
      thresholds = parseThresholds(hiveThresholds);
    } catch (err) {
      showToast(err.message, false);
      return;
    }

    setHiveThresholdSaving(true);
    try {
      await apiFetch(`/api/hives/${hiveId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          warning_low_threshold: thresholds.warningLow,
          warning_high_threshold: thresholds.warningHigh,
          critical_low_threshold: thresholds.criticalLow,
          critical_high_threshold: thresholds.criticalHigh,
        }),
      });
      await status.refresh();
      showToast(`${selectedHiveName} thresholds saved.`);
    } catch (err) {
      showToast(friendlyApiMessage(err, 'Hive threshold update failed.'), false);
    } finally {
      setHiveThresholdSaving(false);
    }
  };

  const selectedHiveName = selectedHive?.name || (selectedHiveId ? `Hive ${selectedHiveId}` : 'No hive selected');
  const lastSeen = latestReading?.receivedAt || latestReading?.bucketAt || device?.last_seen_at || device?.lastSeenAt;

  return (
    <div className="app-shell">
      <Navigation />
      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
            setShowPasswordModal(false);
            showToast('Password updated.');
          }}
        />
      )}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 999,
          background: toast.ok ? 'var(--surface-elevated)' : 'rgba(239,68,68,0.18)',
          color: toast.ok ? 'var(--text-primary)' : '#fecaca',
          border: `1px solid ${toast.ok ? 'var(--border)' : 'rgba(239,68,68,0.45)'}`,
          borderRadius: '14px',
          padding: '10px 14px',
          fontSize: '13px',
          fontWeight: 800,
          boxShadow: 'var(--shadow-md)',
        }}>
          {toast.msg}
        </div>
      )}

      <main className="page-main">
        <div className="page-content">
          <header className="page-header">
            <div>
              <div className="page-title-row">
                <HamburgerBtn />
                <div className="page-kicker">Settings</div>
              </div>
              <h1>Configuration</h1>
              <p className="page-subtitle">Manage account details, global alert defaults, and selected-hive device context.</p>
            </div>
            <button type="button" className="primary-btn" onClick={handleSave} disabled={saving || isDemoAccount}>
              {isDemoAccount ? 'Read-Only Demo' : saving ? 'Saving…' : 'Save Settings'}
            </button>
          </header>

          {authError ? (
            <ErrorState message="Authentication required." />
          ) : (
            <>
              {/* Read-only notice */}
              {isDemoAccount && (
                <div className="analytics-card" style={{ padding: '14px 16px', marginBottom: '18px', borderColor: 'rgba(245,185,66,0.35)', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--amber)' }}>Demo account:</strong> settings are read-only so shared demo data stays intact.
                </div>
              )}

              {/* Project overview */}
              <DashboardSection title="About BeeKeepr" eyebrow="Project">
                <div className="analytics-card" style={{ padding: '18px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.65 }}>
                  BeeKeepr is a hive monitoring system built to help beekeepers track hive conditions, identify temperature issues, and review long-term colony trends from a central dashboard. The system combines physical sensor hardware, ESP32-based device logic, LoRa communication, backend data ingestion, PostgreSQL storage, alerting, external weather context, analytics, and operational visualizations.

                  Each hive is designed to use a temperature sensor connected to an ESP32 board. The ESP32 reads the hive temperature at regular intervals, formats the reading, and sends it wirelessly through a LoRa module. LoRa allows the device to transmit data over longer distances while using low power, which makes it useful for outdoor hive environments where Wi-Fi may be unreliable or unavailable. This allows hive data to be collected from the field without requiring each hive to have a direct internet connection.

                  On the software side, the backend receives the sensor readings, stores them in PostgreSQL using time-based reading buckets, checks each reading against warning and critical temperature thresholds, and makes the data available to the dashboard. BeeKeepr also supports multiple hives, multiple locations, hive-specific alert thresholds, historical analytics, CSV export, and external weather comparisons so users can understand both individual hive behavior and broader environmental conditions.
                </div>
              </DashboardSection>

              {/* Account details */}
              <DashboardSection title="Account" eyebrow="Profile">
                <div className="analytics-card" style={{ padding: '18px' }}>
                  <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <Field label="Full Name" value={displayName} disabled />
                    <Field label="Role" value={localPrefs.role || 'Beekeeper'} onChange={value => setLocalPref('role', value)} />
                    <Field label="Email Address" value={accountEmail} disabled />
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                      <button type="button" className="ghost-btn" onClick={() => setShowPasswordModal(true)} disabled={isDemoAccount}>
                        Change Password
                      </button>
                    </div>
                  </div>
                </div>
              </DashboardSection>

              {/* Global defaults */}
              <DashboardSection title="Global Alert Defaults" eyebrow="Defaults">
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                  Global defaults apply to all active hives when saved. Individual hive thresholds can be adjusted afterward in the per-hive editor below.
                </div>
                <div className="stat-grid">
                  <ThresholdInput label="Critical Low" value={localPrefs.criticalLow} onChange={value => setLocalPref('criticalLow', value)} tone="var(--error)" />
                  <ThresholdInput label="Warning Low" value={localPrefs.optimalLow} onChange={value => setLocalPref('optimalLow', value)} tone="var(--warning)" />
                  <ThresholdInput label="Warning High" value={localPrefs.optimalHigh} onChange={value => setLocalPref('optimalHigh', value)} tone="var(--warning)" />
                  <ThresholdInput label="Critical High" value={localPrefs.criticalHigh} onChange={value => setLocalPref('criticalHigh', value)} tone="var(--error)" />
                </div>
              </DashboardSection>

              {/* Per-hive thresholds */}
              <DashboardSection
                title="Hive Alert Thresholds"
                eyebrow="Per-Hive"
                action={
                  <HiveSelector
                    hives={status.hives}
                    selectedHiveId={selectedHiveId}
                    onChange={setSelectedHiveId}
                    compact
                  />
                }
              >
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                  These values update only the selected hive. Valid order is critical low, warning low, warning high, critical high.
                </div>
                {status.loading ? (
                  <LoadingState label="Loading hive thresholds…" />
                ) : status.error ? (
                  <ErrorState message={status.error} />
                ) : !selectedHive ? (
                  <div className="analytics-card" style={{ padding: '18px', color: 'var(--text-secondary)' }}>
                    Choose a hive to edit its thresholds.
                  </div>
                ) : (
                  <div className="analytics-card" style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      <div>
                        <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 850 }}>{selectedHiveName}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          Hive ID #{getHiveId(selectedHive)} · {selectedHive.locationName || 'No location'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={handleSaveHiveThresholds}
                        disabled={hiveThresholdSaving || isDemoAccount}
                      >
                        {isDemoAccount ? 'Read-Only Demo' : hiveThresholdSaving ? 'Saving…' : 'Save Hive Thresholds'}
                      </button>
                    </div>
                    <div className="stat-grid">
                      <ThresholdInput label="Critical Low" value={hiveThresholds.criticalLow} onChange={value => setHiveThreshold('criticalLow', value)} tone="var(--error)" disabled={isDemoAccount} />
                      <ThresholdInput label="Warning Low" value={hiveThresholds.warningLow} onChange={value => setHiveThreshold('warningLow', value)} tone="var(--warning)" disabled={isDemoAccount} />
                      <ThresholdInput label="Warning High" value={hiveThresholds.warningHigh} onChange={value => setHiveThreshold('warningHigh', value)} tone="var(--warning)" disabled={isDemoAccount} />
                      <ThresholdInput label="Critical High" value={hiveThresholds.criticalHigh} onChange={value => setHiveThreshold('criticalHigh', value)} tone="var(--error)" disabled={isDemoAccount} />
                    </div>
                  </div>
                )}
              </DashboardSection>

              {/* Selected hive context */}
              <DashboardSection
                title="Selected Hive Context"
                eyebrow="Device"
                action={
                  <HiveSelector
                    hives={status.hives}
                    selectedHiveId={selectedHiveId}
                    onChange={setSelectedHiveId}
                    compact
                  />
                }
              >
                {status.loading || deviceLoading ? (
                  <LoadingState label="Loading hive device context…" />
                ) : status.error ? (
                  <ErrorState message={status.error} />
                ) : (
                  <div className="stat-grid">
                    <StatCard label="Selected Hive" value={selectedHiveName} detail={selectedHive?.locationName || 'No location'} />
                    <StatCard label="Hive Health" value={selectedHive?.healthStatus || '—'} detail={selectedHive?.status || 'No status'} />
                    <StatCard label="Device ID" value={device?.id ? `#${device.id}` : '—'} detail={device ? 'One device per hive' : 'No device registered'} />
                    <StatCard label="Last Reading" value={formatDateTime(lastSeen)} detail={formatTemperature(latestReading?.temperature)} />
                  </div>
                )}
                {selectedHive && (
                  <div style={{ marginTop: '14px' }}>
                    <StatusBadge status={selectedHive.healthStatus} />
                  </div>
                )}
              </DashboardSection>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
