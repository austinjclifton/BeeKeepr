import { LineChart } from '@mui/x-charts/LineChart';
import { EmptyState, LoadingState } from './StateBlocks';
import {
  EXTERNAL_TEMPERATURE_COLOR,
  formatChartTemperature,
  formatChartTime,
  formatChartTooltipTime,
  paddedTemperatureDomain,
  parseTimelineDate,
} from '../../utils/analyticsFormat';
import { chartSx } from '../../utils/chartStyles';
import { nullableNumber, sortPointsByBucketAt } from '../../utils/chartSeries';

export default function DashboardHiveTemperatureChart({
  timeline,
  hiveName,
  loading = false,
  height = 280,
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
    <div className="-mt-1">
      <LineChart
        height={height}
        skipAnimation
        margin={{ left: 48, right: 12, top: 8, bottom: 36 }}
        xAxis={[{
          data: timestamps,
          scaleType: 'time',
          min: domainStart ?? undefined,
          max: domainEnd ?? undefined,
          valueFormatter: (value, context) =>
            context.location === 'tick'
              ? formatChartTime(value, '1d')
              : formatChartTooltipTime(value),
          tickLabelInterval: (_, index) => index % tickEvery === 0,
          tickLabelStyle: { fill: 'rgba(255,255,255,0.58)', fontSize: 11 },
        }]}
        yAxis={[{
          min: yMin,
          max: yMax,
          valueFormatter: value => `${value}°F`,
          tickLabelStyle: { fill: 'rgba(255,255,255,0.58)', fontSize: 11 },
        }]}
        series={[
          {
            data: internal,
            label: 'Internal',
            color: '#F5B942',
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
