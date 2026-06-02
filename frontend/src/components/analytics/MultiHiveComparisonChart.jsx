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

const COLORS = ['#F5B942', '#22C55E', '#60A5FA', '#FB7185', '#A78BFA', '#2DD4BF', '#F97316', '#E879F9', '#84CC16', '#F43F5E'];

const chartSx = {
  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: 'rgba(255,255,255,0.18)' },
  '& .MuiChartsAxis-tickLabel': { fill: 'rgba(255,255,255,0.58)', fontSize: 11 },
  '& .MuiChartsLegend-label': { fill: 'rgba(255,255,255,0.72)' },
  '& .MuiChartsGrid-line': { stroke: 'rgba(255,255,255,0.08)' },
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
}) {
  if (loading) return <LoadingState label="Loading comparison…" />;

  const hives = comparison?.hives ?? [];
  const externalSeries = comparison?.externalSeries ?? [];
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

  const bucketTimes = Array.from(new Set(
    [
      ...hives.flatMap(hive => (hive.series ?? []).map(point => parseBucketTime(point?.bucketAt)).filter(value => value != null)),
      ...externalSeries.map(point => parseBucketTime(point?.bucketAt)).filter(value => value != null),
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
    );
    const data = bucketTimes.map(bucket => nullableNumber(byBucket.get(bucket)));
    allValues.push(...data);
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
        comparison?.bucketSize,
        showBucketRangeInTooltip,
      ),
    };
  });

  if (hasExternalSeries) {
    const byBucket = toBucketValueMap(
      externalSeries,
      point => point.temperature ?? point.externalTemperature,
    );
    const data = bucketTimes.map(bucket => nullableNumber(byBucket.get(bucket)));
    allValues.push(...data);
    series.push({
      data,
      label: 'External °F',
      color: EXTERNAL_TEMPERATURE_COLOR,
      showMark: showMarks,
      curve: 'monotoneX',
      valueFormatter: (value, context) => formatFahrenheitWithBucket(
        value,
        context,
        bucketTimes,
        comparison?.bucketSize,
        showBucketRangeInTooltip,
      ),
    });
  }
  const [yMin, yMax] = paddedTemperatureDomain(allValues);

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
        slotProps={{ tooltip: { trigger: 'axis', anchor: 'pointer' } }}
        sx={chartSx}
      />
      <div className="chart-meta">
        Source readings are stored in 10-minute ingest buckets.
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

function parseBucketTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function toBucketValueMap(series, getValue) {
  const byBucket = new Map();

  for (const point of series ?? []) {
    const bucketAt = parseBucketTime(point?.bucketAt);
    if (bucketAt == null) continue;

    const value = getValue(point);
    // Keep the latest non-null value for duplicate bucket timestamps
    if (!byBucket.has(bucketAt) || nullableNumber(value) != null) {
      byBucket.set(bucketAt, value);
    }
  }

  return byBucket;
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

function formatFahrenheitWithBucket(value, context, bucketTimes, bucketSize, showBucketRangeInTooltip) {
  const base = formatFahrenheit(value);
  if (!showBucketRangeInTooltip) return base;
  const bucketAt = bucketTimes?.[context?.dataIndex];
  if (!bucketAt) return base;
  const endAt = addBucketEnd(bucketAt, bucketSize);
  return `${base} · ${formatBucketRange(bucketAt, endAt, bucketSize)}`;
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
