/**
 * Shared MUI `sx` overrides for the analytics line charts.
 *
 * Centralizes the dark-theme axis/grid/tooltip colors so every chart
 * renders identically. Kept in `utils/` because it's pure styling data
 * with no React component logic.
 *
 * Font sizes were bumped from 11 → 12 in the dashboard readability pass
 * (Jun 2026) — the 11px tick labels were too small against the
 * dashboard's other chrome. Per-axis `tickLabelStyle` / `labelStyle`
 * props on individual charts still win when they're set explicitly,
 * so the analytics page (which keeps its own scale) is unaffected.
 */
export const chartSx = {
  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: 'rgba(255,255,255,0.18)' },
  '& .MuiChartsAxis-tickLabel': { fill: 'rgba(255,255,255,0.62)', fontSize: 12 },
  '& .MuiChartsAxis-label': { fill: 'rgba(255,255,255,0.55)', fontSize: 12 },
  '& .MuiChartsLegend-label': { fill: 'rgba(255,255,255,0.78)', fontSize: 12 },
  '& .MuiChartsLegend-mark': { rx: 2 },
  '& .MuiChartsGrid-line': { stroke: 'rgba(255,255,255,0.08)' },
  '& .MuiChartsTooltip-paper': {
    backgroundColor: '#151515',
    border: '1px solid #2A2A2A',
    color: '#fff',
  },
  '& .MuiChartsAxisHighlight-root': { stroke: 'rgba(245,185,66,0.38)' },
};

/**
 * Extended `sx` used by the multi-hive comparison chart. Adds the line-cap
 * join used for the rounded series curves and a slightly thicker stroke so
 * the fleet lines read clearly against the dark surface.
 */
export const comparisonChartSx = {
  ...chartSx,
  '& .MuiLineElement-root': {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2.25,
  },
};

/**
 * Color palette for the multi-hive fleet comparison chart. Defined as
 * full literal hex strings (not Tailwind classes) because the chart
 * canvas needs inline `style={{ color }}` — the Tailwind JIT scanner
 * can't see dynamically-applied colors. The first ten colors cover
 * the realistic upper bound for one account's fleet count; indices
 * beyond that wrap.
 */
export const FLEET_HIVE_COLORS = [
  '#F5B942', // amber
  '#22C55E', // green
  '#60A5FA', // blue
  '#FB7185', // rose
  '#A78BFA', // violet
  '#2DD4BF', // teal
  '#F97316', // orange
  '#E879F9', // fuchsia
  '#84CC16', // lime
  '#F43F5E', // crimson
];

/** Pick a palette color for a given hive index (wraps after the palette length). */
export function getFleetHiveColor(index) {
  return FLEET_HIVE_COLORS[index % FLEET_HIVE_COLORS.length];
}
