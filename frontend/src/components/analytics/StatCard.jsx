export default function StatCard({ label, value, detail, tone = 'default', onClick, compact = false }) {
  const toneColor = {
    default: 'var(--amber)',
    healthy: 'var(--success)',
    warning: 'var(--warning)',
    critical: 'var(--error)',
    muted: 'var(--text-muted)',
  }[tone] || 'var(--amber)';
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={`analytics-card stat-card${compact ? ' stat-card-compact' : ''}${onClick ? ' stat-card-clickable' : ''}`}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
        <div className="field-label">{label}</div>
        <span
          aria-hidden="true"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: toneColor,
            marginTop: '4px',
            boxShadow: `0 0 0 4px color-mix(in srgb, ${toneColor} 18%, transparent)`,
          }}
        />
      </div>
      <div style={{ marginTop: compact ? '8px' : '12px', fontSize: compact ? '21px' : '28px', lineHeight: 1.08, fontWeight: 850, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
        {value}
      </div>
      {detail && (
        <div style={{ marginTop: compact ? '6px' : '8px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
          {detail}
        </div>
      )}
    </Tag>
  );
}
