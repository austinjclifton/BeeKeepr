import { useEffect, useState } from 'react';
import HamburgerBtn from '../components/HamburgerBtn';
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

const fieldLabelClass = 'text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted';
const inputClass = 'w-full rounded-md border border-line bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none focus:border-amber';
const primaryBtnClass = 'cursor-pointer rounded-pill border-none bg-amber px-3.5 py-2.5 text-[12px] font-black text-navy transition disabled:cursor-not-allowed disabled:opacity-55';
const ghostBtnClass = 'cursor-pointer rounded-pill border border-line bg-white/[0.05] px-3 py-2 text-[12px] font-extrabold text-ink-secondary transition hover:border-amber/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-55';
const statGridClass = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4';

function Field({ label, value, onChange, type = 'text', disabled = false }) {
  return (
    <label className="grid gap-2">
      <span className={fieldLabelClass}>{label}</span>
      <input
        className={inputClass}
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
    <label className="grid gap-2.5 p-4">
      <span className={fieldLabelClass}>{label}</span>
      <div className="flex items-center gap-2.5">
        <input
          className={inputClass}
          type="number"
          step="0.5"
          value={value}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
        />
        <span className="font-black" style={{ color: tone || '#f5b942' }}>°F</span>
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
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[430px] p-6"
      >
        <div className="mb-[18px] flex justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">Account Security</div>
            <h2 className="text-[20px] text-white">Change Password</h2>
          </div>
          <button type="button" className={ghostBtnClass} onClick={onClose}>Close</button>
        </div>
        {error && <ErrorState message={error} />}
        <div className="grid gap-3.5">
          <Field label="Current Password" value={current} onChange={setCurrent} type="password" />
          <Field label="New Password" value={next} onChange={setNext} type="password" />
          <Field label="Confirm New Password" value={confirm} onChange={setConfirm} type="password" />
          <button type="submit" className={primaryBtnClass} disabled={loading}>
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
    <div className="app-shell flex min-h-screen">
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
        <div
          className="fixed right-5 top-5 z-[999] rounded-md border px-3.5 py-2.5 text-[13px] font-extrabold shadow-card-md"
          style={{
            background: toast.ok ? '#151515' : 'rgba(239,68,68,0.18)',
            color: toast.ok ? '#ffffff' : '#fecaca',
            borderColor: toast.ok ? '#2a2a2a' : 'rgba(239,68,68,0.45)',
          }}
        >
          {toast.msg}
        </div>
      )}

      <main className="flex-1 min-w-0 overflow-auto">
        <div className="mx-auto w-full max-w-content px-7 py-7">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2.5">
                <HamburgerBtn />
                <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">Settings</div>
              </div>
              <h1 className="text-[clamp(26px,4vw,42px)] font-black leading-none text-white">Configuration</h1>
              <p className="mt-2 text-[14px] text-ink-secondary">Manage account details, global alert defaults, and selected-hive device context.</p>
            </div>
            <button type="button" className={primaryBtnClass} onClick={handleSave} disabled={saving || isDemoAccount}>
              {isDemoAccount ? 'Read-Only Demo' : saving ? 'Saving…' : 'Save Settings'}
            </button>
          </header>

          {authError ? (
            <ErrorState message="Authentication required." />
          ) : (
            <>
              {/* Read-only notice */}
              {isDemoAccount && (
                <div className="mb-4.5 border-amber/35 p-3.5 text-ink-secondary">
                  <strong className="text-amber">Demo account:</strong> settings are read-only so shared demo data stays intact.
                </div>
              )}

              {/* Project overview */}
              <DashboardSection title="About BeeKeepr" eyebrow="Project">
                <div className="p-[18px] text-[14px] leading-[1.65] text-ink-secondary">
                  BeeKeepr is a hive monitoring system built to help beekeepers track hive conditions, identify temperature issues, and review long-term colony trends from a central dashboard. The system combines physical sensor hardware, ESP32-based device logic, LoRa communication, backend data ingestion, PostgreSQL storage, alerting, external weather context, analytics, and operational visualizations.

                  Each hive is designed to use a temperature sensor connected to an ESP32 board. The ESP32 reads the hive temperature at regular intervals, formats the reading, and sends it wirelessly through a LoRa module. LoRa allows the device to transmit data over longer distances while using low power, which makes it useful for outdoor hive environments where Wi-Fi may be unreliable or unavailable. This allows hive data to be collected from the field without requiring each hive to have a direct internet connection.

                  On the software side, the backend receives the sensor readings, stores them in PostgreSQL using time-based reading buckets, checks each reading against warning and critical temperature thresholds, and makes the data available to the dashboard. BeeKeepr also supports multiple hives, multiple locations, hive-specific alert thresholds, historical analytics, CSV export, and external weather comparisons so users can understand both individual hive behavior and broader environmental conditions.
                </div>
              </DashboardSection>

              {/* Account details */}
              <DashboardSection title="Account" eyebrow="Profile">
                <div className="p-[18px]">
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    <Field label="Full Name" value={displayName} disabled />
                    <Field label="Role" value={localPrefs.role || 'Beekeeper'} onChange={value => setLocalPref('role', value)} />
                    <Field label="Email Address" value={accountEmail} disabled />
                    <div className="flex items-end">
                      <button type="button" className={ghostBtnClass} onClick={() => setShowPasswordModal(true)} disabled={isDemoAccount}>
                        Change Password
                      </button>
                    </div>
                  </div>
                </div>
              </DashboardSection>

              {/* Global defaults */}
              <DashboardSection title="Global Alert Defaults" eyebrow="Defaults">
                <div className="mb-3 text-[13px] text-ink-secondary">
                  Global defaults apply to all active hives when saved. Individual hive thresholds can be adjusted afterward in the per-hive editor below.
                </div>
                <div className={statGridClass}>
                  <ThresholdInput label="Critical Low" value={localPrefs.criticalLow} onChange={value => setLocalPref('criticalLow', value)} tone="#ef4444" />
                  <ThresholdInput label="Warning Low" value={localPrefs.optimalLow} onChange={value => setLocalPref('optimalLow', value)} tone="#f59e0b" />
                  <ThresholdInput label="Warning High" value={localPrefs.optimalHigh} onChange={value => setLocalPref('optimalHigh', value)} tone="#f59e0b" />
                  <ThresholdInput label="Critical High" value={localPrefs.criticalHigh} onChange={value => setLocalPref('criticalHigh', value)} tone="#ef4444" />
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
                <div className="mb-3 text-[13px] text-ink-secondary">
                  These values update only the selected hive. Valid order is critical low, warning low, warning high, critical high.
                </div>
                {status.loading ? (
                  <LoadingState label="Loading hive thresholds…" />
                ) : status.error ? (
                  <ErrorState message={status.error} />
                ) : !selectedHive ? (
                  <div className="p-[18px] text-ink-secondary">
                    Choose a hive to edit its thresholds.
                  </div>
                ) : (
                  <div className="p-[18px]">
                    <div className="mb-3.5 flex flex-wrap justify-between gap-3.5">
                      <div>
                        <div className="text-[15px] font-extrabold text-white">{selectedHiveName}</div>
                        <div className="text-[12px] text-ink-muted">
                          Hive ID #{getHiveId(selectedHive)} · {selectedHive.locationName || 'No location'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={primaryBtnClass}
                        onClick={handleSaveHiveThresholds}
                        disabled={hiveThresholdSaving || isDemoAccount}
                      >
                        {isDemoAccount ? 'Read-Only Demo' : hiveThresholdSaving ? 'Saving…' : 'Save Hive Thresholds'}
                      </button>
                    </div>
                    <div className={statGridClass}>
                      <ThresholdInput label="Critical Low" value={hiveThresholds.criticalLow} onChange={value => setHiveThreshold('criticalLow', value)} tone="#ef4444" disabled={isDemoAccount} />
                      <ThresholdInput label="Warning Low" value={hiveThresholds.warningLow} onChange={value => setHiveThreshold('warningLow', value)} tone="#f59e0b" disabled={isDemoAccount} />
                      <ThresholdInput label="Warning High" value={hiveThresholds.warningHigh} onChange={value => setHiveThreshold('warningHigh', value)} tone="#f59e0b" disabled={isDemoAccount} />
                      <ThresholdInput label="Critical High" value={hiveThresholds.criticalHigh} onChange={value => setHiveThreshold('criticalHigh', value)} tone="#ef4444" disabled={isDemoAccount} />
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
                  <div className={statGridClass}>
                    <StatCard label="Selected Hive" value={selectedHiveName} detail={selectedHive?.locationName || 'No location'} />
                    <StatCard label="Hive Health" value={selectedHive?.healthStatus || '—'} detail={selectedHive?.status || 'No status'} />
                    <StatCard label="Device ID" value={device?.id ? `#${device.id}` : '—'} detail={device ? 'One device per hive' : 'No device registered'} />
                    <StatCard label="Last Reading" value={formatDateTime(lastSeen)} detail={formatTemperature(latestReading?.temperature)} />
                  </div>
                )}
                {selectedHive && (
                  <div className="mt-3.5">
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
