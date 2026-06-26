import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import {
  ChartsTooltipCell,
  ChartsTooltipContainer,
  ChartsTooltipPaper,
  ChartsTooltipRow,
  ChartsTooltipTable,
  chartsTooltipClasses,
  useAxesTooltip,
} from '@mui/x-charts/ChartsTooltip';
import { ChartsLabelMark } from '@mui/x-charts/ChartsLabel';
import { EmptyState, LoadingState } from './StateBlocks';
import {
  EXTERNAL_TEMPERATURE_COLOR,
  formatAggregationInterval,
  formatBucketRange,
  formatChartTemperature,
  formatChartTime,
  formatChartTooltipTime,
  paddedTemperatureDomain,
  parseTimelineDate,
} from '../../utils/analyticsFormat';
import {
  comparisonChartSx,
  getFleetHiveColor,
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
  showBucketRangeInTooltip = true,
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

  const hives = (comparison?.hives ?? []).map(hive => ({
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
  const displayReferenceLabel = useDisplaySmoothing
    ? `${formatAggregationInterval(displayBucketSize)} avg`
    : null;
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
  const tickEvery = Math.max(1, Math.ceil(timestamps.length / 8));
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
      label: hive.name || `Hive ${hive.hiveId}`,
      color: getFleetHiveColor(index),
      showMark: showMarks,
      curve: 'monotoneX',
      valueFormatter: (value, context) => formatFahrenheitWithBucket(
        value,
        context,
        bucketTimes,
        displayBucketSize,
        showBucketRangeInTooltip,
        useDisplaySmoothing ? rawData : null,
        displayReferenceLabel,
        internalPrecision,
      ),
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
      valueFormatter: (value, context) => formatFahrenheitWithBucket(
        value,
        context,
        bucketTimes,
        displayBucketSize,
        showBucketRangeInTooltip,
        useComparisonSmoothing ? data : null,
        displayReferenceLabel,
        externalPrecision,
      ),
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
        slots={{ tooltip: SortedAxisTooltip }}
        slotProps={{
          tooltip: { trigger: 'axis', anchor: 'pointer' },
          line: { strokeLinecap: 'round', strokeLinejoin: 'round' },
        }}
        sx={comparisonChartSx}
      />
      {showFooter && (
        <div className="-mt-1.5 text-[12px] leading-snug text-ink-muted">
          Source readings are stored in 10-minute ingest buckets.
          {useDashboardFleetSmoothing ? ' Fleet overview lines use 10-minute display buckets with a 9-point trend average; bucket averages remain available in tooltips when they differ.' : ''}
          {useComparisonSmoothing ? ' Multi-hive comparison lines are display-smoothed for the selected interval; bucket averages remain available in tooltips when they differ.' : ''}
          {comparison?.locationId ? ' External temperature for the selected location is overlaid when weather data is available.' : ''}
          {comparison?.locationId && !hasExternalSeries ? ' Outside conditions are unavailable for this location.' : ''}
        </div>
      )}
    </>
  );
}

function SortedAxisTooltip(props) {
  return (
    <ChartsTooltipContainer {...props}>
      <SortedAxisTooltipContent />
    </ChartsTooltipContainer>
  );
}

function SortedAxisTooltipContent() {
  const tooltipData = useAxesTooltip();
  if (tooltipData === null) return null;

  return (
    <ChartsTooltipPaper className={chartsTooltipClasses.paper}>
      {tooltipData.map(({ axisId, mainAxis, axisValue, axisFormattedValue, seriesItems }) => (
        <ChartsTooltipTable className={chartsTooltipClasses.table} key={axisId}>
          {axisValue != null && !mainAxis.hideTooltip ? (
            <Typography component="caption">{axisFormattedValue}</Typography>
          ) : null}
          <tbody>
            {sortTooltipSeriesItems(seriesItems).map(({ color, formattedLabel, formattedValue, markType, seriesId }) => (
              <ChartsTooltipRow className={chartsTooltipClasses.row} key={seriesId}>
                <ChartsTooltipCell
                  className={`${chartsTooltipClasses.labelCell} ${chartsTooltipClasses.cell}`}
                  component="th"
                >
                  <div className={chartsTooltipClasses.markContainer}>
                    <ChartsLabelMark
                      type={markType}
                      color={color}
                      className={chartsTooltipClasses.mark}
                    />
                  </div>
                  {formattedLabel || null}
                </ChartsTooltipCell>
                <ChartsTooltipCell
                  className={`${chartsTooltipClasses.valueCell} ${chartsTooltipClasses.cell}`}
                  component="td"
                >
                  {formattedValue}
                </ChartsTooltipCell>
              </ChartsTooltipRow>
            ))}
          </tbody>
        </ChartsTooltipTable>
      ))}
    </ChartsTooltipPaper>
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
  const baseDomain = paddedTemperatureDomain(values);

  if (comparison?.mode !== 'dashboard' || comparison?.bucketSize !== '10m') {
    return baseDomain;
  }

  return expandDomainToMinSpan(baseDomain, 12);
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

function sortTooltipSeriesItems(seriesItems) {
  return seriesItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.formattedValue != null)
    .sort((left, right) => compareTooltipSeriesItems(left.item, right.item) || left.index - right.index)
    .map(({ item }) => item);
}

function compareTooltipSeriesItems(left, right) {
  const leftValue = sortableTemperature(left.value);
  const rightValue = sortableTemperature(right.value);

  if (leftValue == null && rightValue == null) return 0;
  if (leftValue == null) return 1;
  if (rightValue == null) return -1;
  return rightValue - leftValue;
}

function sortableTemperature(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatFahrenheitWithBucket(
  value,
  context,
  bucketTimes,
  bucketSize,
  showBucketRangeInTooltip,
  rawData,
  rawLabel,
  precision = 'auto',
) {
  const rawValue = rawData?.[context?.dataIndex];
  const base = formatFahrenheitWithRaw(value, rawValue, rawLabel, precision);
  if (!showBucketRangeInTooltip) return base;
  const bucketAt = bucketTimes?.[context?.dataIndex];
  if (!bucketAt) return base;
  const endAt = addBucketEnd(bucketAt, bucketSize);
  return `${base} · ${formatBucketRange(bucketAt, endAt, bucketSize)}`;
}

function formatFahrenheitWithRaw(value, rawValue, rawLabel = 'raw', precision = 'auto') {
  const base = formatChartTemperature(value, precision);
  const display = sortableTemperature(value);
  const raw = sortableTemperature(rawValue);
  if (display == null || raw == null || Math.abs(display - raw) < 0.05) return base;
  return `${base} trend · ${rawLabel} ${formatChartTemperature(raw, precision)}`;
}

function addBucketEnd(bucketAt, bucketSize) {
  const d = new Date(bucketAt);
  if (Number.isNaN(d.getTime())) return null;
  const durations = {
    '10m': 10 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    hour: 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
  };
  const ms = durations[bucketSize];
  return ms ? new Date(d.getTime() + ms).toISOString() : null;
}
