import { getHiveId } from '../../utils/analyticsFormat';
import StatusBadge from './StatusBadge';

export default function HiveSelector({
  hives,
  selectedHiveId,
  onChange,
  label = 'Hive',
  compact = false,
  allowAll = false,
  allLabel = 'All hives',
}) {
  return (
    <label style={{ display: 'grid', gap: '8px', minWidth: compact ? '180px' : '240px' }}>
      <span className="field-label">{label}</span>
      <select
        value={selectedHiveId || ''}
        onChange={event => onChange(event.target.value)}
        disabled={!hives.length}
        className="dark-select"
      >
        {allowAll && <option value="">{allLabel}</option>}
        {!hives.length && !allowAll && <option value="">No hives</option>}
        {hives.map(hive => {
          const id = getHiveId(hive);
          return (
            <option key={id} value={id}>
              {hive.name || `Hive ${id}`}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function HiveQuickList({ hives, selectedHiveId, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {hives.map(hive => {
        const id = getHiveId(hive);
        const active = String(id) === String(selectedHiveId);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '999px',
              border: active ? '1px solid var(--amber)' : '1px solid var(--border)',
              background: active ? 'rgba(245,185,66,0.14)' : 'rgba(255,255,255,0.04)',
              color: active ? 'var(--amber)' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {hive.name || `Hive ${id}`}
            <StatusBadge status={hive.healthStatus} />
          </button>
        );
      })}
    </div>
  );
}
