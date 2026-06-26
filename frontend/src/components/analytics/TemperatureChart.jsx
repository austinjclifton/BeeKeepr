import { LineChart } from '@mui/x-charts/LineChart';
import { EmptyState, LoadingState } from './StateBlocks';
import {
  EXTERNAL_TEMPERATURE_COLOR,
  formatAggregationInterval,
  formatChartTemperature,
  formatChartTime,
  formatChartTooltipTime,
  paddedTemperatureDomain,
} from '../../utils/analyticsFormat';
import { chartSx } from '../../utils/chartStyles';
import { nullableNumber } from '../../utils/chartSeries';

export default function TemperatureChart({ series, range, bucketSize, loading = false, height = 320 }) {
  if (loading) return <LoadingState label="Loading temperature trend…" />;

  const points = (series || []).filter(point => point?.bucketAt);
  const average = points.map(point => nullableNumber(point.averageTemperature));
  const minimum = points.map(point => nullableNumber(point.minTemperature));
  const maximum = points.map(point => nullableNumber(point.maxTemperature));
  const external = points.map(point => nullableNumber(point.externalTemperature));
  const hasInternal = [...average, ...minimum, ...maximum].some(value => value != null);
  const hasExternal = external.some(value => value != null);

  if (!points.length || (!hasInternal && !hasExternal)) {
    return (
      <EmptyState
        title="No temperature data"
        detail="Internal or outside temperature points will appear here after data is available in this range."
      />
    );
  }

  const timestamps = points.map(point => new Date(point.bucketAt));
  const isRawBucket = bucketSize === '10m';
  const tickEvery = Math.max(1, Math.ceil(timestamps.length / 8));
  const showMarks = points.length <= 48;
  const yValues = isRawBucket
    ? [...average, ...external]
    : [...average, ...minimum, ...maximum, ...external];
  const [yMin, yMax] = paddedTemperatureDomain(yValues);
  const chartSeries = isRawBucket
    ? [
      {
        data: average,
        label: 'Internal °F',
        color: '#F5B942',
        showMark: showMarks,
        curve: 'monotoneX',
        valueFormatter: formatChartTemperature,
      },
      ...(hasExternal
        ? [
          {
            data: external,
            label: 'External °F',
            color: EXTERNAL_TEMPERATURE_COLOR,
            showMark: showMarks,
            curve: 'monotoneX',
            valueFormatter: formatChartTemperature,
          },
        ]
        : []),
    ]
    : [
      {
        data: maximum,
        label: 'Max °F',
        color: '#FB7185',
        showMark: showMarks,
        curve: 'monotoneX',
        valueFormatter: formatChartTemperature,
      },
      {
        data: average,
        label: 'Average °F',
        color: '#F5B942',
        showMark: showMarks,
        curve: 'monotoneX',
        valueFormatter: formatChartTemperature,
      },
      {
        data: minimum,
        label: 'Min °F',
        color: '#60A5FA',
        showMark: showMarks,
        curve: 'monotoneX',
        valueFormatter: formatChartTemperature,
      },
      ...(hasExternal
        ? [
          {
            data: external,
            label: 'External °F',
            color: EXTERNAL_TEMPERATURE_COLOR,
            showMark: showMarks,
            curve: 'monotoneX',
            valueFormatter: formatChartTemperature,
          },
        ]
        : []),
    ];

  return (
    <>
      <LineChart
        height={height}
        skipAnimation
        margin={{ left: 52, right: 20, top: 24, bottom: 54 }}
        xAxis={[{
          data: timestamps,
          scaleType: 'time',
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
          label: 'Temperature (°F)',
          min: yMin,
          max: yMax,
          valueFormatter: value => `${value}°F`,
          tickLabelStyle: { fill: 'rgba(255,255,255,0.58)', fontSize: 11 },
          labelStyle: { fill: 'rgba(255,255,255,0.5)', fontSize: 11 },
        }]}
        series={chartSeries}
        grid={{ horizontal: true, vertical: true }}
        axisHighlight={{ x: 'line' }}
        slotProps={{ tooltip: { trigger: 'axis', anchor: 'pointer' } }}
        sx={chartSx}
      />
      <div className="-mt-1.5 text-[12px] leading-snug text-ink-muted">
        {isRawBucket
          ? 'Each point is one stored 10-minute internal or outside temperature bucket.'
          : `Each point is a ${formatAggregationInterval(bucketSize)}; source readings are stored in 10-minute ingest buckets and outside temperature is averaged across matching weather buckets.`}
        {!hasExternal ? ' Outside conditions are unavailable for this hive location.' : ''}
      </div>
    </>
  );
}
