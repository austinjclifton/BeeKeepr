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
import {
  CHART_AXIS_LABEL_STYLE,
  CHART_AXIS_TICK_STYLE,
  comparisonChartSx,
  buildHourlyTicks,
  getFleetHiveColor,
  getFleetHiveDisplay,
  shouldLabelTick,
  sortFleetHives,
} from '../../utils/chartStyles';
import { nullableNumber, parseChartTime, smoothSeries, sortPointsByBucketAt } from '../../utils/chartSeries';

const FLEET_COMPACT_LEFT_MARGIN = 96;
const FLEET_COMPACT_RIGHT_MARGIN = 24;
const FLEET_COMPACT_BOTTOM_MARGIN = 42;

function toEpochMs(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function buildLabeledTimeTicks(start, end) {
  return buildHourlyTicks(start, end).filter(tick => shouldLabelTick(tick));
}

// Format a hive series label. When `labelMode === 'locationName'` and the
// hive has a location, the label is prefixed with the short location name:
//   "Blue Ridge · Biltmore Estate Hive"
// Without a location, the hive name is used as-is. Default 'name' returns
// the bare hive name (matches Analytics behavior).
function formatHiveLabel(hive, labelMode) {
  const display = getFleetHiveDisplay(hive);
  if (labelMode === 'locationName' && display.locationName) {
    return `${display.locationName} · ${display.name}`;
  }
  return display.name || (hive?.hiveId != null ? `Hive ${hive.hiveId}` : '');
}

export default function MultiHiveComparisonChart({
  comparison,
  range,
  loading = false,
  height = 340,
  showFooter = true,
  smoothFleetDisplay = false,
  smoothComparisonDisplay = false,
  hideLegend = false,
  internalPrecision = 'auto',
  externalPrecision = 'auto',
  labelMode = 'name',
  compact = false,
}) {
  if (loading) return <LoadingState label="Loading comparison…" />;

  const hives = sortFleetHives(comparison?.hives ?? []).map(hive => ({
    ...hive,
    series: sortPointsByBucketAt(hive?.series ?? []),
  }));

  const externalSeries = sortPointsByBucketAt(comparison?.externalSeries ?? []);
  const isLocationComparison = comparison?.locationId != null;
  const hasExternalSeries = externalSeries.some(point =>
    nullableNumber(point?.temperature ?? point?.externalTemperature) != null,
  );
  const withData = hives.filter(hive => (hive.series ?? []).length > 0);

  if (!isLocationComparison && hives.length < 2) {
    return (
      <EmptyState
        title="Comparison unavailable"
        detail="Select at least two hives to compare trends."
      />
    );
  }

  if (isLocationComparison && !hives.length && !hasExternalSeries) {
    return (
      <EmptyState
        title="No location data"
        detail="Outside conditions are unavailable for this location in the selected range."
      />
    );
  }

  if (!withData.length && !hasExternalSeries) {
    return (
      <EmptyState
        title="No comparison data"
        detail={isLocationComparison
          ? 'There are no bucketed readings or outside conditions for this location in the selected range.'
          : 'There are no bucketed readings for the selected hives in this range.'}
      />
    );
  }

  const useDashboardFleetSmoothing =
    smoothFleetDisplay &&
    comparison?.mode === 'dashboard' &&
    comparison?.bucketSize === '10m';
  const useComparisonSmoothing =
    smoothComparisonDisplay &&
    !useDashboardFleetSmoothing &&
    comparison?.mode !== 'dashboard';
  const useDisplaySmoothing = useDashboardFleetSmoothing || useComparisonSmoothing;
  const displayBucketSize = comparison?.bucketSize;
  const smoothingOptions = getSmoothingOptions(displayBucketSize);

  const bucketTimes = Array.from(new Set(
    [
      ...hives.flatMap(hive =>
        (hive.series ?? [])
          .map(point => parseBucketTime(point?.bucketAt, displayBucketSize))
          .filter(value => value != null),
      ),
      ...externalSeries
        .map(point => parseBucketTime(point?.bucketAt, displayBucketSize))
        .filter(value => value != null),
    ],
  )).sort((a, b) => a - b);

  const domainStart = parseTimelineDate(comparison?.startAt)?.getTime();
  const domainEnd = parseTimelineDate(comparison?.endAt)?.getTime();

  const xValues = bucketTimes;
  const axisStart = Number.isFinite(domainStart) ? domainStart : xValues[0];
  const axisEnd = Number.isFinite(domainEnd) ? domainEnd : xValues[xValues.length - 1];
  const timeTicks = compact ? buildLabeledTimeTicks(axisStart, axisEnd) : undefined;

  const chartKey = [
    hives.length,
    axisStart,
    axisEnd,
    xValues[0],
    xValues[xValues.length - 1],
    compact ? timeTicks?.join(',') : 'analytics',
  ].join(':');

  const showMarks = bucketTimes.length <= 36 && (hives.length + (hasExternalSeries ? 1 : 0)) <= 4;
  const allValues = [];

  const series = hives.map((hive, index) => {
    const byBucket = toBucketValueMap(
      hive.series,
      point => point.averageTemperature ?? point.temperature,
      displayBucketSize,
    );
    const rawData = bucketTimes.map(bucket => nullableNumber(byBucket.get(bucket)));
    const data = useDisplaySmoothing
      ? smoothSeries(rawData, smoothingOptions)
      : rawData;

    allValues.push(...data, ...rawData);

    return {
      data,
      label: formatHiveLabel(hive, labelMode),
      color: getFleetHiveColor(index),
      showMark: showMarks,
      curve: 'monotoneX',
      valueFormatter: value => formatChartTemperature(value, internalPrecision),
    };
  });

  if (hasExternalSeries) {
    const byBucket = toBucketValueMap(
      externalSeries,
      point => point.temperature ?? point.externalTemperature,
      displayBucketSize,
    );
    const data = bucketTimes.map(bucket => nullableNumber(byBucket.get(bucket)));
    const displayData = useComparisonSmoothing
      ? smoothSeries(data, smoothingOptions)
      : data;

    allValues.push(...displayData, ...data);

    series.push({
      data: displayData,
      label: 'External °F',
      color: EXTERNAL_TEMPERATURE_COLOR,
      showMark: showMarks,
      curve: 'monotoneX',
      valueFormatter: value => formatChartTemperature(value, externalPrecision),
    });
  }

  const [yMin, yMax] = comparisonTemperatureDomain(allValues, comparison);

  return (
    <>
      <LineChart
        key={chartKey}
        height={height}
        skipAnimation
        margin={compact
          ? { left: FLEET_COMPACT_LEFT_MARGIN, right: FLEET_COMPACT_RIGHT_MARGIN, top: 24, bottom: FLEET_COMPACT_BOTTOM_MARGIN }
          : { left: 56, right: 20, top: 24, bottom: 64 }}
        xAxis={[{
          data: xValues,
          scaleType: 'time',
          min: axisStart,
          max: axisEnd,

          // Compact dashboard mode gets only real visible time-label ticks.
          // No blank hourly labels, no raw start/end labels, no x-axis title
          // competing for space during refresh.
          ...(compact
            ? { tickInterval: timeTicks }
            : {
                label: 'Bucket Start Time',
                labelStyle: CHART_AXIS_LABEL_STYLE,
              }),

          valueFormatter: (value, context) => {
            const tickMs = toEpochMs(value);

            if (context?.location !== 'tick') {
              return formatChartTooltipTime(tickMs ?? value);
            }

            if (!compact) {
              return Number.isFinite(tickMs)
                ? formatChartTime(tickMs, range)
                : '';
            }

            return Number.isFinite(tickMs)
              ? formatChartTime(tickMs, range)
              : '';
          },
          tickLabelStyle: CHART_AXIS_TICK_STYLE,
        }]}
        yAxis={[{
          ...(compact
            ? {}
            : {
                label: 'Temperature (°F)',
                labelStyle: CHART_AXIS_LABEL_STYLE,
              }),
          width: compact ? FLEET_COMPACT_LEFT_MARGIN : 56,
          min: yMin,
          max: yMax,
          valueFormatter: value => `${value}°F`,
          tickLabelStyle: CHART_AXIS_TICK_STYLE,
        }]}
        series={series}
        grid={{ horizontal: true, vertical: true }}
        axisHighlight={{ x: 'line' }}
        hideLegend={hideLegend}
        slotProps={{
          tooltip: { trigger: 'axis', anchor: 'pointer' },
          line: { strokeLinecap: 'round', strokeLinejoin: 'round' },
        }}
        sx={comparisonChartSx}
      />

      {showFooter && (
        <div className="-mt-1.5 text-[12px] leading-snug text-ink-muted">
          Source readings are stored in 10-minute ingest buckets.
          {useDashboardFleetSmoothing ? ' Fleet overview lines use 10-minute display buckets with a 9-point trend average for visual clarity.' : ''}
          {useComparisonSmoothing ? ' Multi-hive comparison lines are display-smoothed for the selected interval for visual clarity.' : ''}
          {comparison?.locationId ? ' External temperature for the selected location is overlaid when weather data is available.' : ''}
          {comparison?.locationId && !hasExternalSeries ? ' Outside conditions are unavailable for this location.' : ''}
        </div>
      )}
    </>
  );
}

function parseBucketTime(value, bucketSize) {
  const parsedTime = parseChartTime(value);
  if (parsedTime == null) return null;

  const date = new Date(parsedTime);
  const normalized = normalizeBucketDate(date, bucketSize);
  const bucketTime = normalized?.getTime();

  return Number.isFinite(bucketTime) ? bucketTime : null;
}

function toBucketValueMap(series, getValue, bucketSize) {
  const aggregates = new Map();

  for (const point of series ?? []) {
    const bucketAt = parseBucketTime(point?.bucketAt, bucketSize);
    if (bucketAt == null) continue;

    const value = nullableNumber(getValue(point));
    if (value == null) continue;

    const current = aggregates.get(bucketAt);
    if (current) {
      current.sum += value;
      current.count += 1;
    } else {
      aggregates.set(bucketAt, { sum: value, count: 1 });
    }
  }

  return new Map(Array.from(aggregates.entries())
    .sort(([left], [right]) => left - right)
    .map(([bucketAt, aggregate]) => [
      bucketAt,
      aggregate.sum / aggregate.count,
    ]));
}

function comparisonTemperatureDomain(values, comparison) {
  const isDashboardFleet =
    comparison?.mode === 'dashboard' && comparison?.bucketSize === '10m';

  if (!isDashboardFleet) {
    return paddedTemperatureDomain(values);
  }

  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return paddedTemperatureDomain(values);

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;
  const pad = span === 0 ? 1.5 : Math.max(0.5, span * 0.1);

  return [
    Math.floor((min - pad) * 10) / 10,
    Math.ceil((max + pad) * 10) / 10,
  ];
}

function getSmoothingOptions(bucketSize) {
  if (bucketSize === '10m') {
    return { windowSize: 9, preserveSpikeThreshold: 2 };
  }

  if (bucketSize === '30m') {
    return { windowSize: 5, preserveSpikeThreshold: 2 };
  }

  if (bucketSize === 'hour') {
    return { windowSize: 3, preserveSpikeThreshold: 2 };
  }

  return { windowSize: 3, preserveSpikeThreshold: 2.5 };
}

function normalizeBucketDate(date, bucketSize) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const normalized = new Date(date);
  normalized.setUTCSeconds(0, 0);

  if (bucketSize === 'day') {
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
  }

  if (bucketSize === '6h') {
    normalized.setUTCMinutes(0, 0, 0);
    normalized.setUTCHours(Math.floor(normalized.getUTCHours() / 6) * 6, 0, 0, 0);
    return normalized;
  }

  if (bucketSize === 'hour') {
    normalized.setUTCMinutes(0, 0, 0);
    return normalized;
  }

  if (bucketSize === '30m') {
    normalized.setUTCMinutes(Math.floor(normalized.getUTCMinutes() / 30) * 30, 0, 0);
    return normalized;
  }

  normalized.setUTCMinutes(Math.floor(normalized.getUTCMinutes() / 10) * 10, 0, 0);
  return normalized;
}