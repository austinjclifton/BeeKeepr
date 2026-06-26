import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  averageDefined,
  formatCompactNumber,
  formatCount,
  formatTemperature,
} from '../utils/analyticsFormat';

const DASHBOARD_RANGE_LABEL = '24 Hours';

/**
 * Build the metric configs for the operations summary strip on the dashboard.
 *
 * Owns every rollup derived from the raw hive list: health counts (including
 * offline), location count, top-1-2 locations, and the outside-temp cell for
 * those locations. Returns the final metrics array ready to drop into
 * <OperationsSummaryStrip metrics={...} />.
 *
 * Each metric may carry a `width` (xl-only column weight). The strip applies
 * these as grid-column spans at xl, so compact count metrics stay narrow and
 * the wider "Outside" cell can fit a full yard name + temperature.
 */
export function useDashboardMetrics({ hives, activeAlertCount }) {
  const navigate = useNavigate();

  // Top-line hive metrics: counts.
  const overview = useMemo(() => {
    const healthy = hives.filter(hive => hive.healthStatus === 'healthy').length;
    const warning = hives.filter(hive => hive.healthStatus === 'warning').length;
    const critical = hives.filter(hive => hive.healthStatus === 'critical').length;
    const offline = hives.filter(hive => hive.healthStatus === 'offline').length;
    return { total: hives.length, healthy, warning, critical, offline };
  }, [hives]);

  // Unique location count: prefer locationId, fall back to locationName.
  const locationCount = useMemo(() => {
    const ids = new Set();
    for (const hive of hives) {
      if (hive?.locationId != null && String(hive.locationId).trim() !== '') {
        ids.add(Number(hive.locationId) || hive.locationId);
      } else if (hive?.locationName) {
        ids.add(hive.locationName);
      }
    }
    return ids.size;
  }, [hives]);

  // Group hives by location, rank by hive count, keep top 2 for the strip.
  const topLocations = useMemo(() => {
    const groups = new Map();
    for (const hive of hives) {
      let key = null;
      if (hive?.locationId != null && String(hive.locationId).trim() !== '') {
        key = `id:${hive.locationId}`;
      } else if (hive?.locationName) {
        key = `name:${hive.locationName}`;
      }
      if (key == null) continue;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          id: hive.locationId ?? null,
          name:
            hive.locationName ||
            (hive.locationId != null ? `Location ${hive.locationId}` : 'Unknown'),
          hives: [],
        });
      }
      groups.get(key).hives.push(hive);
    }
    return Array.from(groups.values())
      .sort((a, b) => b.hives.length - a.hives.length)
      .slice(0, 2);
  }, [hives]);

  // Outside-temp cell for the top 1-2 locations, collapsed into one strip cell.
  // Each location becomes a structured row { name, temp } so the strip
  // can render each row as a small flex line — full location/yard name
  // on the left, temperature right-aligned at the far edge. This reads
  // cleanly as:
  //   "Western New York Demo Yard        82.2°F"
  //   "Blue Ridge Appalachia Demo Yard   85.5°F"
  // and avoids the "muted gray" feel of the old joined-string layout.
  //
  // The full location name is preserved so a desktop-sized Outside cell
  // can render the long yard name without abbreviating.
  const outsideLocationMetrics = useMemo(() => {
    if (topLocations.length === 0) return [];

    const rows = topLocations.map(loc => {
      const withExt = loc.hives.filter(hive => hive.externalConditionAt);
      const avg = averageDefined(withExt.map(hive => hive.externalTemperature));
      const latest = withExt
        .slice()
        .sort(
          (a, b) =>
            new Date(b.externalConditionAt).getTime() -
            new Date(a.externalConditionAt).getTime(),
        )[0];
      const temp = formatTemperature(avg ?? latest?.externalTemperature ?? null);
      return { name: loc.name, temp };
    });

    return [
      {
        label: 'Outside',
        rows,
        showDot: false,
        // 3.2× a count cell at xl so the full yard name + temperature
        // fits without abbreviation. On smaller breakpoints the strip
        // wraps and the metric is ignored.
        width: 3.2,
      },
    ];
  }, [topLocations]);

  // Final metrics array for OperationsSummaryStrip.
  // 7 metrics: 5 health counts (row 1) + Outside + Unresolved alerts (row 2).
  // Hive Avg Temp is intentionally omitted from the operations strip — the
  // same value is shown in the selected hive's metric row, so duplicating
  // it here just steals space and adds visual noise.
  const metrics = useMemo(
    () => [
      {
        label: 'Total Hives',
        value: formatCount(overview.total),
        secondary:
          locationCount > 0
            ? `${locationCount} ${locationCount === 1 ? 'location' : 'locations'}`
            : 'In fleet',
        tone: 'default',
        showDot: true,
        // Slightly wider than the other count cells (1.0) so the full
        // "TOTAL HIVES" label fits at 11px / 0.05em tracking without
        // truncating. The visual difference is small (≈12px) and the
        // strip's overall rhythm is preserved.
        width: 1.15,
      },
      {
        label: 'Healthy',
        value: formatCount(overview.healthy),
        secondary: 'Reporting normally',
        tone: 'healthy',
        showDot: true,
        width: 1,
      },
      {
        label: 'Warning',
        value: formatCount(overview.warning),
        secondary: 'Needs review',
        tone: 'warning',
        showDot: true,
        width: 1,
      },
      {
        label: 'Critical',
        value: formatCount(overview.critical),
        secondary: 'Immediate attention',
        tone: 'critical',
        showDot: true,
        width: 1,
      },
      {
        label: 'Offline',
        value: formatCount(overview.offline),
        secondary: 'Not reporting',
        tone: 'muted',
        showDot: true,
        width: 1,
      },
      ...outsideLocationMetrics,
      {
        // "Unresolved" is the literal meaning: alerts where !resolved.
        // Avoids the ambiguous "Active" reading and the runaway count feel.
        label: 'Unresolved',
        value:
          activeAlertCount == null
            ? '—'
            : formatCompactNumber(activeAlertCount, { precision: 1, fallback: '—' }),
        secondary:
          activeAlertCount == null
            ? 'Loading…'
            : activeAlertCount > 0
              ? 'Alerts pending'
              : 'All clear',
        tone: activeAlertCount > 0 ? 'warning' : 'healthy',
        showDot: true,
        onClick: () => navigate('/alerts'),
        ariaLabel:
          activeAlertCount == null
            ? 'Unresolved alerts: unknown'
            : `Unresolved alerts: ${activeAlertCount}. View all alerts.`,
        width: 1.5,
      },
    ],
    [overview, locationCount, outsideLocationMetrics, activeAlertCount, navigate],
  );

  return { metrics, rangeLabel: DASHBOARD_RANGE_LABEL };
}
