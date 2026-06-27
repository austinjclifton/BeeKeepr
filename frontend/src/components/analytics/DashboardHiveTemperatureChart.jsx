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
} from '../../utils/chartStyles';
import { nullableNumber, sortPointsByBucketAt } from '../../utils/chartSeries';

const HOUR_MS = 60 * 60 * 1000;
const LABEL_EVERY_HOURS = 3;

// `bottom` reserves room for MUI's single x-axis.
// We intentionally use MUI's real x-axis here, but we control the tick
// positions ourselves so refresh/hard-refresh cannot change the cadence.
const CHART_MARGINS = {
  left: 60,
  right: 24,
  top: 16,
  bottom: 36,
};

function toEpochMs(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function buildHourlyTicks(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return [];
  }

  const ticks = [start];
  const firstHour = new Date(start);
  firstHour.setMinutes(0, 0, 0);

  let nextHour = firstHour.getTime();
  if (nextHour <= start) nextHour += HOUR_MS;

  for (let tick = nextHour; tick < end; tick += HOUR_MS) {
    ticks.push(tick);
  }

  ticks.push(end);
  return ticks;
}

function shouldLabelTick(value, start, end) {
  if (value === start || value === end) return true;

  const tickDate = new Date(value);
  return tickDate.getMinutes() === 0 && tickDate.getHours() % LABEL_EVERY_HOURS === 0;
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

            // Deterministic dashboard axis:
            // - small MUI tick every hour
            // - text label every 3 hours
            // - first/last labels always included
            tickInterval: hourlyTicks,
            valueFormatter: (value, context) => {
              if (context.location !== 'tick') {
                return formatChartTooltipTime(value);
              }

              return shouldLabelTick(value, axisStart, axisEnd)
                ? formatChartTime(value, '1d')
                : '';
            },
            tickLabelStyle: CHART_AXIS_TICK_STYLE,
          },
        ]}
        yAxis={[
          {
            label: 'Temperature (°F)',
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