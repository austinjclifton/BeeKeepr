import { LineChart } from '@mui/x-charts/LineChart';
import { EmptyState, LoadingState } from './StateBlocks';
import {
  EXTERNAL_TEMPERATURE_COLOR,
  formatChartTemperature,
  formatChartTime,
  formatChartTooltipTime,
  INTERNAL_TEMPERATURE_COLOR,
  paddedTemperatureDomain,
  parseTimelineDate,
} from '../../utils/analyticsFormat';
import { chartSx, CHART_AXIS_TICK_STYLE, CHART_AXIS_LABEL_STYLE, pickTickValues } from '../../utils/chartStyles';
import { nullableNumber, sortPointsByBucketAt } from '../../utils/chartSeries';

export default function DashboardHiveTemperatureChart({
  timeline,
  hiveName,
  loading = false,
  // Bumped from 280 → 320 (Jun 2026 readability pass). The axis title
  // ("Bucket Start Time") now lives under the tick labels, so the chart
  // needs more vertical room for ticks + title + breathing space. 320
  // keeps the card from feeling cramped while leaving room for the
  // 12px tick labels and 13px axis title without one clipping the other.
  height = 320,
}) {
  if (loading) return <LoadingState label="Loading selected hive telemetry…" />;

  const points = sortPointsByBucketAt(timeline?.points ?? []);
  const hasInternal = points.some(point => Number.isFinite(Number(point.internalTemperature)));
  const hasExternal = points.some(point => Number.isFinite(Number(point.outsideTemperature)));

  if (!points.length || (!hasInternal && !hasExternal)) {
    return (
      <EmptyState
        title="No 24-hour telemetry"
        detail="Internal or outside temperature points will appear when readings exist in the current 24-hour window."
      />
    );
  }

  const timestamps = points.map(point => new Date(point.bucketAt));
  const domainStart = parseTimelineDate(timeline?.startAt);
  const domainEnd = parseTimelineDate(timeline?.endAt);
  const internal = points.map(point => nullableNumber(point.internalTemperature));
  const outside = points.map(point => nullableNumber(point.outsideTemperature));
  // X-axis tick labels: hand MUI a fixed array of 6 evenly-spaced
  // timestamps (first and last always included) via `tickInterval`.
  //
  // We use `tickInterval` (array form) instead of a `tickLabelInterval`
  // callback because on continuous time scales MUI's callback receives
  // the **tick index** (D3-generated), not the data index — see MUI
  // x-charts `models/axis.d.ts`. An index predicate keyed on
  // `timestamps.length` silently misaligns with MUI's shorter tick
  // array and most/all labels vanish in production. Passing explicit
  // values via `tickInterval` sidesteps that mismatch entirely.
  //
  // For a 24h chart with 144 ten-minute buckets the 6 evenly-spaced
  // candidates land at hours 00 / ~04:50 / ~09:40 / ~14:20 / ~19:00 /
  // 24:00, which is readable without being crowded.
  const tickInterval = pickTickValues(timestamps, 6);
  const [yMin, yMax] = paddedTemperatureDomain([...internal, ...outside]);

  return (
    <div>
      <LineChart
        height={height}
        skipAnimation
        // Bottom margin bumped 16 → 40 (Jun 2026 chart-stability pass).
        // The chart renders both 12px tick labels AND the 13px "Bucket
        // Start Time" axis title on the same bottom edge; with `16` MUI
        // had to drop the ticks to fit the title in the stricter prod
        // layout path. 40 keeps both visible at `height={320}` while
        // leaving ~192px of plot area (320 − 60 − 12 − 16 − 40).
        margin={{ left: 60, right: 12, top: 16, bottom: 40 }}
        xAxis={[{
          data: timestamps,
          scaleType: 'time',
          min: domainStart ?? undefined,
          max: domainEnd ?? undefined,
          label: 'Bucket Start Time',
          valueFormatter: (value, context) =>
            context.location === 'tick'
              ? formatChartTime(value, '1d')
              : formatChartTooltipTime(value),
          tickInterval,
          tickLabelStyle: CHART_AXIS_TICK_STYLE,
          labelStyle: CHART_AXIS_LABEL_STYLE,
        }]}
        yAxis={[{
          label: 'Temperature (°F)',
          min: yMin,
          max: yMax,
          valueFormatter: value => `${value}°F`,
          tickLabelStyle: CHART_AXIS_TICK_STYLE,
          labelStyle: CHART_AXIS_LABEL_STYLE,
        }]}
        series={[
          {
            data: internal,
            label: 'Internal',
            color: INTERNAL_TEMPERATURE_COLOR,
            showMark: false,
            curve: 'monotoneX',
            // Internal hive temps — always 2 decimals so the 1/10 °F
            // diff between adjacent readings stays visible in the tooltip
            // (matches the Fleet Status table's internal-temp column).
            valueFormatter: value => formatChartTemperature(value, 2),
          },
          {
            data: outside,
            label: 'External',
            color: EXTERNAL_TEMPERATURE_COLOR,
            showMark: false,
            curve: 'monotoneX',
            // External temps — always 1 decimal (matches the weather
            // strip / external-readout convention used elsewhere).
            valueFormatter: value => formatChartTemperature(value, 1),
          },
        ]}
        // Hide the built-in legend; SelectedHiveSection renders its
        // own compact legend in the chart header so it sits next to the
        // title instead of floating at the bottom of the card.
        hideLegend
        grid={{ horizontal: true, vertical: false }}
        axisHighlight={{ x: 'line' }}
        slotProps={{
          tooltip: { trigger: 'axis', anchor: 'pointer' },
        }}
        sx={chartSx}
      />
      {!hasInternal ? (
        <div className="mt-1.5 text-[11px] text-ink-muted">
          Internal hive readings are unavailable for this window.
        </div>
      ) : !hasExternal ? (
        <div className="mt-1.5 text-[11px] text-ink-muted">
          Outside conditions are unavailable for this hive location.
        </div>
      ) : null}
    </div>
  );
}
