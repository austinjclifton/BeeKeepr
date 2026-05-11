import { LineChart } from '@mui/x-charts/LineChart';
import { EmptyState, LoadingState } from './StateBlocks';
import {
  formatAggregationInterval,
  formatChartTime,
  formatChartTooltipTime,
  paddedTemperatureDomain,
} from '../../utils/analyticsFormat';

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

export default function TemperatureChart({ series, range, bucketSize, loading = false, height = 320 }) {
  if (loading) return <LoadingState label="Loading temperature trend…" />;

  const points = (series || []).filter(point => point?.bucketAt);
  if (!points.length) {
    return (
      <EmptyState
        title="No temperature data"
        detail="Readings will appear here after the hive reports telemetry in this range."
      />
    );
  }

  const timestamps = points.map(point => new Date(point.bucketAt));
  const average = points.map(point => nullableNumber(point.averageTemperature));
  const minimum = points.map(point => nullableNumber(point.minTemperature));
  const maximum = points.map(point => nullableNumber(point.maxTemperature));
  const isRawBucket = bucketSize === '10m';
  const tickEvery = Math.max(1, Math.ceil(timestamps.length / 8));
  const showMarks = points.length <= 48;
  const yValues = isRawBucket
    ? average
    : [...average, ...minimum, ...maximum];
  const [yMin, yMax] = paddedTemperatureDomain(yValues);
  const chartSeries = isRawBucket
    ? [
      {
        data: average,
        label: 'Temperature °F',
        color: '#F5B942',
        showMark: showMarks,
        curve: 'monotoneX',
        valueFormatter: formatFahrenheit,
      },
    ]
    : [
      {
        data: maximum,
        label: 'Max °F',
        color: '#FB7185',
        showMark: showMarks,
        curve: 'monotoneX',
        valueFormatter: formatFahrenheit,
      },
      {
        data: average,
        label: 'Average °F',
        color: '#F5B942',
        showMark: showMarks,
        curve: 'monotoneX',
        valueFormatter: formatFahrenheit,
      },
      {
        data: minimum,
        label: 'Min °F',
        color: '#60A5FA',
        showMark: showMarks,
        curve: 'monotoneX',
        valueFormatter: formatFahrenheit,
      },
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
      <div className="chart-meta">
        {isRawBucket
          ? 'Each point is one stored 10-minute temperature reading.'
          : `Each point is a ${formatAggregationInterval(bucketSize)}; source readings are stored in 10-minute ingest buckets.`}
      </div>
    </>
  );
}

function nullableNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatFahrenheit(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}°F` : 'No data';
}
