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
  CHART_AXIS_TICK_STYLE,
  buildHourlyTicks,
  shouldLabelTick,
} from '../../utils/chartStyles';
import { nullableNumber, sortPointsByBucketAt } from '../../utils/chartSeries';

const CHART_MARGINS = {
  left: 72,
  right: 24,
  top: 16,
  bottom: 42,
};

function toEpochMs(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function buildLabeledTimeTicks(start, end) {
  return buildHourlyTicks(start, end).filter(tick => shouldLabelTick(tick));
}

export default function DashboardHiveTemperatureChart({
  timeline,
  hiveName,
  loading = false,
  height = 320,
}) {
  if (loading) return <LoadingState label="Loading selected hive telemetry…" />;

  const points = sortPointsByBucketAt(timeline?.points ?? []);

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

  const axisStart = Number.isFinite(parsedDomainStart) ? parsedDomainStart : xValues[0];
  const axisEnd = Number.isFinite(parsedDomainEnd)
    ? parsedDomainEnd
    : xValues[xValues.length - 1];

  const timeTicks = buildLabeledTimeTicks(axisStart, axisEnd);
  const [yMin, yMax] = paddedTemperatureDomain([...internal, ...outside]);

  const chartKey = [
    rows.length,
    axisStart,
    axisEnd,
    xValues[0],
    xValues[xValues.length - 1],
    timeTicks.join(','),
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

            // Stable dashboard axis:
            // MUI gets only the ticks that should have labels.
            // No blank hourly labels, no raw start/end labels, no x-axis title
            // competing for space during refresh.
            tickInterval: timeTicks,
            valueFormatter: (value, context) => {
              const tickMs = toEpochMs(value);

              if (context?.location !== 'tick') {
                return formatChartTooltipTime(tickMs ?? value);
              }

              return Number.isFinite(tickMs)
                ? formatChartTime(tickMs, '1d')
                : '';
            },
            tickLabelStyle: CHART_AXIS_TICK_STYLE,
          },
        ]}
        yAxis={[
          {
            width: CHART_MARGINS.left,
            min: yMin,
            max: yMax,
            valueFormatter: value => `${value}°F`,
            tickLabelStyle: CHART_AXIS_TICK_STYLE,
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