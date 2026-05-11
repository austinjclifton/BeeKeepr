import {
  formatCount,
  formatRelativeTime,
  formatTemperature,
  getHiveId,
} from '../../utils/analyticsFormat';
import StatusBadge from './StatusBadge';

export default function HiveStatusGrid({ hives, selectedHiveId, onSelect }) {
  return (
    <div className="hive-status-grid">
      {hives.map(hive => {
        const id = getHiveId(hive);
        const selected = String(id) === String(selectedHiveId);
        return (
          <button
            key={id}
            type="button"
            className="hive-status-card"
            onClick={() => onSelect(id)}
            style={{
              borderColor: selected ? 'var(--amber)' : 'var(--border)',
              boxShadow: selected ? '0 0 0 1px rgba(245,185,66,0.28)' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {hive.name || `Hive ${id}`}
                </div>
                <div style={{ marginTop: '3px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  {hive.locationName || 'No location'}
                </div>
              </div>
              <StatusBadge status={hive.healthStatus} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '20px' }}>
              <Metric label="Latest" value={formatTemperature(hive.latestTemperature)} />
              <Metric label="Temp Swing" value={formatTemperature(hive.temperatureSwing)} />
              <Metric label="24h Average" value={formatTemperature(hive.averageTemperature)} />
              <Metric label="Readings" value={formatCount(hive.readingCount)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                {formatRelativeTime(hive.latestReadingAt)}
              </div>
              <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 800 }}>
                <span style={{ color: hive.warningCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                  W {formatCount(hive.warningCount)}
                </span>
                <span style={{ color: hive.criticalCount > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                  C {formatCount(hive.criticalCount)}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div style={{ marginTop: '4px', color: 'var(--text-primary)', fontSize: '18px', fontWeight: 850 }}>
        {value}
      </div>
    </div>
  );
}
