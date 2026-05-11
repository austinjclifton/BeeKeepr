import {
  formatCount,
  formatMetric,
  formatTemperature,
  getHiveId,
} from '../../utils/analyticsFormat';
import StatusBadge from './StatusBadge';

export default function HiveMetricsTable({ hives }) {
  return (
    <div className="analytics-card" style={{ overflowX: 'auto' }}>
      <table className="metrics-table">
        <thead>
          <tr>
            <th>Hive</th>
            <th>Health</th>
            <th>Latest</th>
            <th>Average</th>
            <th>Min</th>
            <th>Max</th>
            <th>Temperature Swing</th>
            <th>Readings</th>
            <th>Warnings</th>
            <th>Critical</th>
          </tr>
        </thead>
        <tbody>
          {hives.map(hive => {
            const id = getHiveId(hive);
            return (
              <tr key={id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: 850 }}>
                  {hive.name || `Hive ${id}`}
                </td>
                <td><StatusBadge status={hive.healthStatus} /></td>
                <td>{formatTemperature(hive.latestTemperature)}</td>
                <td>{formatTemperature(hive.averageTemperature)}</td>
                <td>{formatTemperature(hive.minTemperature)}</td>
                <td>{formatTemperature(hive.maxTemperature)}</td>
                <td>{formatMetric(hive.temperatureSwing)}°F</td>
                <td>{formatCount(hive.readingCount)}</td>
                <td style={{ color: hive.warningCount > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 800 }}>
                  {formatCount(hive.warningCount)}
                </td>
                <td style={{ color: hive.criticalCount > 0 ? 'var(--error)' : 'var(--text-muted)', fontWeight: 800 }}>
                  {formatCount(hive.criticalCount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
