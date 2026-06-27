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
  getFleetHiveColor,
  getFleetHiveDisplay,
  pickTickValues,
  sortFleetHives,
} from '../../utils/chartStyles';
import { nullableNumber, parseChartTime, smoothSeries, sortPointsByBucketAt } from '../../utils/chartSeries';

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
  // doesn't dwarf the selected-hive area above. The Analytics page
  // overrides this with `height={400}` — see Analytics.jsx.
  // Bumped from 300 → 340 (Jun 2026 readability pass) so the x-axis
  // "Bucket Start Time" title has room to sit below the tick labels
  // without MUI hiding the ticks to make space for the title.
  height = 340,
  showFooter = true,
  smoothFleetDisplay = false,
  smoothComparisonDisplay = false,
  // The dashboard section renders its own header legend in the card
  // chrome (so the hive color pills sit to the right of the title
  // instead of floating at the top of the chart area). Pass
  // `hideLegend` to suppress the built-in MUI legend there. Defaults
  // to `false` so the Analytics page — which still uses the built-in
  // legend — is unchanged.
  hideLegend = false,
  // Tooltip precision overrides for the two temperature kinds. The
  // dashboard fleet chart passes `internalPrecision={2}` and
  // `externalPrecision={1}` so the bottom-dashboard readouts stay
  // consistent with the Fleet Status table; other callers (Analytics)
  // leave them as `'auto'` and keep the existing trim-trailing-zeros
  // behavior.
  internalPrecision = 'auto',
  externalPrecision = 'auto',
  // Series label format. 'name' returns just the hive name (default,
  // matches Analytics). 'locationName' prefixes the short location when
  // available, e.g. "Blue Ridge · Biltmore Estate Hive". The dashboard's
  // FleetComparisonSection opts in.
  labelMode = 'name',
  // Dashboard opts into a tighter chart: omit the axis labels (the
  // Fleet Trend header subtitle already explains the time range and y
  // units) and shrink the label-driven bottom/left margin to reclaim
  // vertical plot space. Default false keeps the labeled chart used by
  // Analytics unchanged.
  compact = false,
}) {
  if (loading) return <LoadingState label="Loading comparison…" />;

  // Group by yard so hives from the same location appear adjacent in
  // the chart and the legend. `FleetComparisonSection` already sorts
  // and merges `locationName` before passing `comparison` down, but
  // re-sorting defensively here keeps the chart correct even if a
  // future caller forgets to.
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
      ...hives.flatMap(hive => (hive.series ?? []).map(point => parseBucketTime(point?.bucketAt, displayBucketSize)).filter(value => value != null)),
      ...externalSeries.map(point => parseBucketTime(point?.bucketAt, displayBucketSize)).filter(value => value != null),
    ],
  )).sort((a, b) => a - b);

  const timestamps = bucketTimes.map(value => new Date(value));
  const domainStart = parseTimelineDate(comparison?.startAt);
  const domainEnd = parseTimelineDate(comparison?.endAt);
  // X-axis tick spacing.
  //   - `compact` (dashboard fleet): hand MUI an explicit array of 5
  //     evenly-spaced timestamps via `tickInterval` (see DashboardHive-
  //     TemperatureChart.jsx for the rationale on the array vs callback
  //     form). For a 24h fleet view (144 buckets) this yields labels at
  //     hours 00 / ~06:00 / ~12:00 / ~18:00 / 24:00.
  //   - non-compact (Analytics): keep the existing modulo
  //     `tickLabelInterval` strategy untouched so the Analytics fleet
  //     default behavior is preserved (visually equivalent to today).
  const xAxisTickInterval = compact
    ? pickTickValues(timestamps, 5)
    : undefined;
  const xAxisTickLabelInterval = compact
    ? undefined
    : (_, index) => index % Math.max(1, Math.ceil(timestamps.length / 29)) === 0;
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
        height={height}
        skipAnimation
        // Default margin reserves space for the x-axis "Bucket Start
        // Time" label; the compact mode drops the label and trims both
        // the bottom and left margins to reclaim plot area for the
        // dashboard's Fleet Trend card.
        margin={compact
          ? { left: 48, right: 20, top: 24, bottom: 36 }
          : { left: 56, right: 20, top: 24, bottom: 64 }}
        xAxis={[{
          data: timestamps,
          scaleType: 'time',
          min: domainStart ?? undefined,
          max: domainEnd ?? undefined,
          ...(compact ? {} : { label: 'Bucket Start Time' }),
          valueFormatter: (value, context) =>
            context.location === 'tick'
              ? formatChartTime(value, range)
              : formatChartTooltipTime(value),
          ...(compact
            ? { tickInterval: xAxisTickInterval }
            : { tickLabelInterval: xAxisTickLabelInterval }),
          tickLabelStyle: CHART_AXIS_TICK_STYLE,
          ...(compact ? {} : { labelStyle: CHART_AXIS_LABEL_STYLE }),
        }]}
        yAxis={[{
          ...(compact ? {} : { label: 'Temperature (°F)' }),
          min: yMin,
          max: yMax,
          valueFormatter: value => `${value}°F`,
          tickLabelStyle: CHART_AXIS_TICK_STYLE,
          ...(compact ? {} : { labelStyle: CHART_AXIS_LABEL_STYLE }),
        }]}
        series={series}
        grid={{ horizontal: true, vertical: true }}
        axisHighlight={{ x: 'line' }}
        hideLegend={hideLegend}
        // No custom tooltip slot — fall through to MUI's default
        // axis tooltip so the fleet chart reads identically to the
        // dashboard's solo-hive 24h chart (`DashboardHiveTemperatureChart`).
        // Both share the `chartSx`/`comparisonChartSx` styling so the
        // tooltip paper, axis labels, and series marks render the same
        // way in both charts.
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
    // 1w/1m ranges don't get artificially compressed when readings
    // happen to cluster.
    return paddedTemperatureDomain(values);
  }

  // Dashboard fleet trend: tighter padding so a stable band of
  // readings (e.g. all hives hovering 94-96°F) still shows the line
  // variation. The actual min/max of the data still drives the
  // domain — if a value drops to 90°F or climbs to 100°F, the y-axis
  // expands to fit because the span grew, without compressing the
  // rest of the chart.
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