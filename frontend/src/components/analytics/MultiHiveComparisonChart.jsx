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
  comparisonChartSx,
  getFleetHiveColor,
  sortFleetHives,
} from '../../utils/chartStyles';
import { nullableNumber, parseChartTime, smoothSeries, sortPointsByBucketAt } from '../../utils/chartSeries';

export default function MultiHiveComparisonChart({
  comparison,
  range,
  loading = false,
  // Dashboard fleet overview wants a compact chart so the bottom half
  // doesn't dwarf the selected-hive area above. The Analytics page
  // overrides this with `height={400}` — see Analytics.jsx.
  height = 300,
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
  // X-axis tick spacing — same intent as the solo-hive chart.
  // `tickLabelInterval` marks every Nth index as a label candidate;
  // MUI space-filters the rest. Aim for ~29 candidates regardless of
  // range length so the visible label count stays roughly 5.
  const tickEvery = Math.max(1, Math.ceil(timestamps.length / 29));
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
      label: (hive?.name || '').trim() || `Hive ${hive.hiveId}`,
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
        // `bottom: 36` matches the selected-hive chart's x-axis label
        // margin. 58px (the old value) left a generous band of empty
        // space below the labels inside the chart canvas; 36px is
        // enough for 12px tick labels + a small descender buffer.
        margin={{ left: 52, right: 20, top: 24, bottom: 36 }}
        xAxis={[{
          data: timestamps,
          scaleType: 'time',
          min: domainStart ?? undefined,
          max: domainEnd ?? undefined,
          label: 'Bucket start time',
          valueFormatter: (value, context) =>
            context.location === 'tick'
              ? formatChartTime(value, range)
              : formatChartTooltipTime(value),
          tickLabelInterval: (_, index) => index % tickEvery === 0,
          tickLabelStyle: { fill: 'rgba(255,255,255,0.62)', fontSize: 12 },
          labelStyle: { fill: 'rgba(255,255,255,0.55)', fontSize: 12 },
        }]}
        yAxis={[{
          label: 'Avg temperature (°F)',
          min: yMin,
          max: yMax,
          valueFormatter: value => `${value}°F`,
          tickLabelStyle: { fill: 'rgba(255,255,255,0.62)', fontSize: 12 },
          labelStyle: { fill: 'rgba(255,255,255,0.55)', fontSize: 12 },
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

function expandDomainToMinSpan(domain, minSpan) {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return domain;

  const span = max - min;
  if (span >= minSpan) return domain;

  const pad = (minSpan - span) / 2;
  return [
    Math.floor((min - pad) * 10) / 10,
    Math.ceil((max + pad) * 10) / 10,
  ];
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