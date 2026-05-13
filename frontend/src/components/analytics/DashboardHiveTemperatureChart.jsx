import { LineChart } from '@mui/x-charts/LineChart';
import { EmptyState, LoadingState } from './StateBlocks';
import {
  EXTERNAL_TEMPERATURE_COLOR,
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

export default function DashboardHiveTemperatureChart({
  timeline,
  hiveName,
  loading = false,
  height = 300,
}) {
  if (loading) return <LoadingState label="Loading selected hive telemetry…" />;

  const points = (timeline?.points ?? []).filter(point => point?.bucketAt);
  const hasInternal = points.some(point => Number.isFinite(Number(point.internalTemperature)));
  const hasExternal = points.some(point => Number.isFinite(Number(point.outsideTemperature)));

  if (!points.length || (!hasInternal && !hasExternal)) {
    return (
      <EmptyState
        title="No 24-hour telemetry"
        detail="Internal or outside temperature points will appear when readings exist in the current 24-hour window."
      />
    );
  }

  const timestamps = points.map(point => new Date(point.bucketAt));
  const domainStart = parseTimelineDate(timeline?.startAt);
  const domainEnd = parseTimelineDate(timeline?.endAt);
  const internal = points.map(point => nullableNumber(point.internalTemperature));
  const outside = points.map(point => nullableNumber(point.outsideTemperature));
  const tickEvery = Math.max(1, Math.round((3 * 60) / 10));
  const [yMin, yMax] = paddedTemperatureDomain([...internal, ...outside]);

  return (
    <>
      <LineChart
        height={height}
        skipAnimation
        margin={{ left: 52, right: 18, top: 24, bottom: 50 }}
        xAxis={[{
          data: timestamps,
          scaleType: 'time',
          min: domainStart ?? undefined,
          max: domainEnd ?? undefined,
          label: 'Bucket time',
          valueFormatter: (value, context) =>
            context.location === 'tick'
              ? formatChartTime(value, '1d')
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
        series={[
          {
            data: internal,
            label: `Internal`,
            color: '#F5B942',
            showMark: false,
            curve: 'monotoneX',
            valueFormatter: formatFahrenheit,
          },
          {
            data: outside,
            label: `External`,
            color: EXTERNAL_TEMPERATURE_COLOR,
            showMark: false,
            curve: 'monotoneX',
            valueFormatter: formatFahrenheit,
          },
        ]}
        grid={{ horizontal: true, vertical: true }}
        axisHighlight={{ x: 'line' }}
        slotProps={{ tooltip: { trigger: 'axis', anchor: 'pointer' } }}
        sx={chartSx}
      />
      <div className="chart-meta">
        Showing raw 10-minute buckets for the selected hive over the previous 24 hours.
        {!hasInternal ? ' Internal hive readings are unavailable for this window.' : ''}
        {!hasExternal ? ' Outside conditions are unavailable for this hive location.' : ''}
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

function parseTimelineDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
