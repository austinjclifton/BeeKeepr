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
  formatChartTime,
  formatChartTooltipTime,
  paddedTemperatureDomain,
} from '../../utils/analyticsFormat';
import { parseChartTime, smoothSeries, sortPointsByBucketAt } from '../../utils/chartSeries';

const COLORS = ['#F5B942', '#22C55E', '#60A5FA', '#FB7185', '#A78BFA', '#2DD4BF', '#F97316', '#E879F9', '#84CC16', '#F43F5E'];

const chartSx = {
  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: 'rgba(255,255,255,0.18)' },
  '& .MuiChartsAxis-tickLabel': { fill: 'rgba(255,255,255,0.58)', fontSize: 11 },
  '& .MuiChartsLegend-label': { fill: 'rgba(255,255,255,0.72)' },
  '& .MuiChartsGrid-line': { stroke: 'rgba(255,255,255,0.08)' },
  '& .MuiLineElement-root': { strokeLinecap: 'round', strokeLinejoin: 'round' },
  '& .MuiChartsTooltip-paper': {
    backgroundColor: '#151515',
    border: '1px solid #2A2A2A',
    color: '#fff',
  },
  '& .MuiChartsAxisHighlight-root': { stroke: 'rgba(245,185,66,0.38)' },
};

export default function MultiHiveComparisonChart({
  comparison,
  range,
  loading = false,
  height = 340,
  showBucketRangeInTooltip = true,
  smoothFleetDisplay = false,
  smoothComparisonDisplay = false,
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
      color: COLORS[index % COLORS.length],
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
      ),
    });
  }
  const [yMin, yMax] = comparisonTemperatureDomain(allValues, comparison);

  return (
    <>
      <LineChart
        height={height}
        skipAnimation
        margin={{ left: 52, right: 20, top: 24, bottom: 58 }}
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
          tickLabelStyle: { fill: 'rgba(255,255,255,0.58)', fontSize: 11 },
          labelStyle: { fill: 'rgba(255,255,255,0.5)', fontSize: 11 },
        }]}
        yAxis={[{
          label: 'Avg temperature (°F)',
          min: yMin,
          max: yMax,
          valueFormatter: value => `${value}°F`,
          tickLabelStyle: { fill: 'rgba(255,255,255,0.58)', fontSize: 11 },
          labelStyle: { fill: 'rgba(255,255,255,0.5)', fontSize: 11 },
        }]}
        series={series}
        grid={{ horizontal: true, vertical: true }}
        axisHighlight={{ x: 'line' }}
        slots={{ tooltip: SortedAxisTooltip }}
        slotProps={{
          tooltip: { trigger: 'axis', anchor: 'pointer' },
          line: { strokeLinecap: 'round', strokeLinejoin: 'round' },
        }}
        sx={chartSx}
      />
      <div className="chart-meta">
        Source readings are stored in 10-minute ingest buckets.
        {useDashboardFleetSmoothing ? ' Fleet overview lines use 10-minute display buckets with a 9-point trend average; bucket averages remain available in tooltips when they differ.' : ''}
        {useComparisonSmoothing ? ' Multi-hive comparison lines are display-smoothed for the selected interval; bucket averages remain available in tooltips when they differ.' : ''}
        {comparison?.locationId ? ' External temperature for the selected location is overlaid when weather data is available.' : ''}
        {comparison?.locationId && !hasExternalSeries ? ' Outside conditions are unavailable for this location.' : ''}
      </div>
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

function nullableNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function formatFahrenheit(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}°F` : 'No data';
}

function formatFahrenheitWithBucket(
  value,
  context,
  bucketTimes,
  bucketSize,
  showBucketRangeInTooltip,
  rawData,
  rawLabel,
) {
  const rawValue = rawData?.[context?.dataIndex];
  const base = formatFahrenheitWithRaw(value, rawValue, rawLabel);
  if (!showBucketRangeInTooltip) return base;
  const bucketAt = bucketTimes?.[context?.dataIndex];
  if (!bucketAt) return base;
  const endAt = addBucketEnd(bucketAt, bucketSize);
  return `${base} · ${formatBucketRange(bucketAt, endAt, bucketSize)}`;
}

function formatFahrenheitWithRaw(value, rawValue, rawLabel = 'raw') {
  const base = formatFahrenheit(value);
  const display = sortableTemperature(value);
  const raw = sortableTemperature(rawValue);
  if (display == null || raw == null || Math.abs(display - raw) < 0.05) return base;
  return `${base} trend · ${rawLabel} ${formatFahrenheit(raw)}`;
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

function parseTimelineDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
