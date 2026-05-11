import { ANALYTICS_RANGE_OPTIONS } from '../../hooks/useAnalyticsRange';

export default function TimeRangeToggle({ range, onChange, disabled = false }) {
  return (
    <div
      className="range-btn-group"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        borderRadius: '999px',
      }}
      aria-label="Analytics range"
    >
      {ANALYTICS_RANGE_OPTIONS.map(option => {
        const active = option.value === range;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            style={{
              minWidth: '44px',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '999px',
              background: active ? 'var(--amber)' : 'transparent',
              color: active ? '#050505' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: disabled ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
