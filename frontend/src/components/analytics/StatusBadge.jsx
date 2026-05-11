import { titleCase } from '../../utils/analyticsFormat';

const STATUS_COLORS = {
  healthy: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.38)' },
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.38)' },
  offline: { color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)' },
  active: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)' },
  inactive: { color: 'rgba(255,255,255,0.58)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)' },
  archived: { color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)' },
};

export default function StatusBadge({ status, label }) {
  const key = String(status || 'offline').toLowerCase();
  const s = STATUS_COLORS[key] || STATUS_COLORS.offline;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 9px',
        borderRadius: '999px',
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
        fontSize: '11px',
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: s.color,
          flexShrink: 0,
        }}
      />
      {label || titleCase(key)}
    </span>
  );
}
