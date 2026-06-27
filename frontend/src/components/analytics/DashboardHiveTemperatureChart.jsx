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
import {
  chartSx,
  CHART_AXIS_LABEL_STYLE,
  CHART_AXIS_TICK_STYLE,
  buildHourlyTicks,
  shouldLabelTick,
} from '../../utils/chartStyles';
import { nullableNumber, sortPointsByBucketAt } from '../../utils/chartSeries';

// `left` bumped to 84 — gives the bold y-axis tick labels like
// `100°F` comfortable headroom. `bottom` reserves room for MUI's
// single x-axis plus the bold axis-title label ("Bucket Start Time")
// underneath it. We intentionally use MUI's real x-axis here, but
// we control the tick positions ourselves via `tickInterval` so
// refresh / hard-refresh / prod-build cannot change the cadence.
const CHART_MARGINS = {
  left: 84,
  right: 24,
  top: 16,
  bottom: 60,
};

function toEpochMs(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export default function DashboardHiveTemperatureChart({
  timeline,
  hiveName,
  loading = false,
  height = 320,
}) {
  if (loading) return <LoadingState label="Loading selected hive telemetry…" />;

  const points = sortPointsByBucketAt(timeline?.points ?? []);

  // Build one aligned row array first so x-values and series values
  // cannot drift. Bad bucket timestamps are dropped instead of sending
  // NaN into MUI's time scale.
  const rows = points
    .map(point => ({
      x: toEpochMs(point.bucketAt),
      internal: nullableNumber(point.internalTemperature),
      outside: nullableNumber(point.outsideTemperature),
    }))
    .filter(row => Number.isFinite(row.x));

  const hasInternal = rows.some(row => Number.isFinite(row.internal));
  const hasExternal = rows.some(row => Number.isFinite(row.outside));

  if (!rows.length || (!hasInternal && !hasExternal)) {
    return (
      <EmptyState
        title="No 24-hour telemetry"
        detail="Internal or outside temperature points will appear when readings exist in the current 24-hour window."
      />
    );
  }

  const xValues = rows.map(row => row.x);
  const internal = rows.map(row => row.internal);
  const outside = rows.map(row => row.outside);

  const parsedDomainStart = parseTimelineDate(timeline?.startAt)?.getTime();
  const parsedDomainEnd = parseTimelineDate(timeline?.endAt)?.getTime();

  // Prefer the API's declared 24h window so the chart scale stays
  // anchored to the real bucket range, even if the first/last reading
  // is a few minutes inside the window.
  const axisStart = Number.isFinite(parsedDomainStart) ? parsedDomainStart : xValues[0];
  const axisEnd = Number.isFinite(parsedDomainEnd)
    ? parsedDomainEnd
    : xValues[xValues.length - 1];

  const hourlyTicks = buildHourlyTicks(axisStart, axisEnd);
  const [yMin, yMax] = paddedTemperatureDomain([...internal, ...outside]);

  // Force a fresh MUI chart instance when the selected hive/window changes.
  // This protects against stale internal axis state after reloads or hive swaps.
  const chartKey = [
    rows.length,
    axisStart,
    axisEnd,
    xValues[0],
    xValues[xValues.length - 1],
  ].join(':');

  return (
    <div>
      <LineChart
        key={chartKey}
        height={height}
        skipAnimation
        margin={CHART_MARGINS}
        xAxis={[
          {
            data: xValues,
            scaleType: 'time',
            min: axisStart,
            max: axisEnd,
            label: 'Bucket Start Time',

            // Deterministic dashboard axis:
            // - small MUI tick every hour
            // - text label every 3 hours
            // - first/last labels always included
            tickInterval: hourlyTicks,
            valueFormatter: (value, context) => {
              if (context.location !== 'tick') {
                return formatChartTooltipTime(value);
              }

              return shouldLabelTick(value)
                ? formatChartTime(value, '1d')
                : '';
            },
            tickLabelStyle: CHART_AXIS_TICK_STYLE,
            labelStyle: CHART_AXIS_LABEL_STYLE,
          },
        ]}
        yAxis={[
          {
            label: 'Temperature (°F)',
            // MUI x-charts v8 default yAxis.width is 45 — set it
            // explicitly so bold y-axis labels never ellipsize.
            width: CHART_MARGINS.left,
            min: yMin,
            max: yMax,
            valueFormatter: value => `${value}°F`,
            tickLabelStyle: CHART_AXIS_TICK_STYLE,
            labelStyle: CHART_AXIS_LABEL_STYLE,
          },
        ]}
        series={[
          {
            data: internal,
            label: 'Internal',
            color: INTERNAL_TEMPERATURE_COLOR,
            showMark: false,
            curve: 'monotoneX',
            valueFormatter: value => formatChartTemperature(value, 2),
          },
          {
            data: outside,
            label: 'External',
            color: EXTERNAL_TEMPERATURE_COLOR,
            showMark: false,
            curve: 'monotoneX',
            valueFormatter: value => formatChartTemperature(value, 1),
          },
        ]}
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