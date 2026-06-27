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

// `left` bumped to 96 — the fleet chart's wider y-axis values like
// `94.5°F` were ellipsizing at 72 because MUI's `shortenLabels`
// measures available width off the axis config and reserves extra
// room for the tick + gap. 96 leaves comfortable headroom for the
// longest bold value at any domain / tick-spacing combo.
const FLEET_COMPACT_LEFT_MARGIN = 96;
const FLEET_COMPACT_RIGHT_MARGIN = 24;

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
  // Dashboard fleet overview wants a compact chart so the bottom half
  // doesn't dwarf the selected-hive area above. Analytics overrides this
  // with `height={400}`.
  height = 340,
  showFooter = true,
  smoothFleetDisplay = false,
  smoothComparisonDisplay = false,
  // Dashboard renders its own header legend in the card chrome. Analytics
  // keeps the built-in MUI legend.
  hideLegend = false,
  // Dashboard fleet passes fixed precision so tooltip/readouts match the
  // Fleet Status table. Analytics keeps the existing auto-trim behavior.
  internalPrecision = 'auto',
  externalPrecision = 'auto',
  // 'name' matches Analytics. 'locationName' is used by the dashboard
  // fleet card to disambiguate hives across yards.
  labelMode = 'name',
  // Compact mode is dashboard-only. It removes axis titles and uses
  // deterministic hourly x ticks so the dashboard fleet chart matches
  // the selected-hive chart.
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
  const hourlyTicks = compact ? buildHourlyTicks(axisStart, axisEnd) : undefined;

  // Force a fresh MUI chart instance whenever the underlying data shifts
  // (different hives, different range, different bucket times). Without
  // this, React reconciles the existing chart in place and any axis
  // styling that MUI x-charts applies during the initial mount — including
  // `tickLabelStyle` / `labelStyle` — can survive stale across re-renders,
  // which is what produced the intermittent "x-axis not bold" symptom on
  // the fleet chart. Mirrors DashboardHiveTemperatureChart's `chartKey`.
  const chartKey = [
    hives.length,
    axisStart,
    axisEnd,
    xValues[0],
    xValues[xValues.length - 1],
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
          ? { left: FLEET_COMPACT_LEFT_MARGIN, right: FLEET_COMPACT_RIGHT_MARGIN, top: 24, bottom: 32 }
          : { left: 56, right: 20, top: 24, bottom: 64 }}
        xAxis={[{
          data: xValues,
          scaleType: 'time',
          min: axisStart,
          max: axisEnd,
          ...(compact ? {} : { label: 'Bucket Start Time' }),

          // Dashboard compact mode uses explicit hourly ticks so soft
          // reloads, hard refreshes, and prod builds keep the same cadence.
          // Exact edge times like 9:42 PM stay useful in tooltips, but the
          // visible axis only labels clean 3-hour clock boundaries.
          ...(compact ? { tickInterval: hourlyTicks } : {}),

          valueFormatter: (value, context) => {
            if (context.location !== 'tick') {
              return formatChartTooltipTime(value);
            }

            if (!compact) {
              return formatChartTime(value, range);
            }

            return shouldLabelTick(value)
              ? formatChartTime(value, range)
              : '';
          },
          tickLabelStyle: CHART_AXIS_TICK_STYLE,
          ...(compact ? {} : {
            label: 'Bucket Start Time',
            labelStyle: CHART_AXIS_LABEL_STYLE,
          }),
        }]}
        yAxis={[{
          ...(compact ? {} : {
            label: 'Temperature (°F)',
            labelStyle: CHART_AXIS_LABEL_STYLE,
          }),
          // MUI x-charts v8 default yAxis.width is 45 — not driven by
          // margin.left. Bump it explicitly so bold labels like `94.5°F`
          // have enough room and MUI's `shortenLabels` doesn't ellipsize.
          width: FLEET_COMPACT_LEFT_MARGIN,
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
    // Analytics page comparison — keep the existing wider padding so
    // 1w/1m ranges don't get artificially compressed when readings cluster.
    return paddedTemperatureDomain(values);
  }

  // Dashboard fleet trend: tighter padding so stable 94-96°F bands still
  // show variation, while larger swings naturally expand the domain.
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