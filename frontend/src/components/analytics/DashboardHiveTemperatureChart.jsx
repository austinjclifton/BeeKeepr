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
import { chartSx } from '../../utils/chartStyles';
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
  // X-axis tick spacing. `tickLabelInterval` returns true every Nth
  // index to mark a tick as a label candidate; MUI then space-filters
  // the candidates so adjacent labels don't overlap. The math:
  //   - (50)         → 50 minutes per candidate
  //   - / 10         → divide by the 10-minute bucket size
  //   = 5 indices per candidate label
  // On a 24h chart (144 ten-minute buckets) that's ~29 candidates,
  // which MUI renders as ~5 visible labels — dense enough to read
  // the time axis without crowding.
  const tickEvery = Math.max(1, Math.round(50 / 10));
  const [yMin, yMax] = paddedTemperatureDomain([...internal, ...outside]);

  return (
    <div>
      <LineChart
        height={height}
        skipAnimation
        margin={{ left: 60, right: 12, top: 16, bottom: 16 }}
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
          tickLabelInterval: (_, index) => index % tickEvery === 0,
          tickLabelStyle: { fill: 'rgba(255,255,255,0.62)', fontSize: 12 },
          labelStyle: { fill: 'rgba(255,255,255,0.65)', fontSize: 13 },
        }]}
        yAxis={[{
          label: 'Temperature (°F)',
          min: yMin,
          max: yMax,
          valueFormatter: value => `${value}°F`,
          tickLabelStyle: { fill: 'rgba(255,255,255,0.62)', fontSize: 12 },
          labelStyle: { fill: 'rgba(255,255,255,0.65)', fontSize: 13 },
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
