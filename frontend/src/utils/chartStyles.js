/**
 * Single source of truth for chart axis text styling. Chart components
 * decide data and tick positions; this file decides how the axis text
 * looks.
 *
 * The values are passed to MUI x-charts via the `tickLabelStyle` and
 * `labelStyle` axis props on every chart. MUI applies them as inline
 * `style` on the SVG <text> element. Both this and MUI's own default
 * caption-typography style end up inline on the same element — but MUI
 * spreads the user-supplied prop LAST in the inline-style object (see
 * `useAxisTicksProps.js` in @mui/x-charts v8), so our values win
 * regardless of emotion's CSS injection order or whether the chart is
 * lazy-loaded behind <Suspense>.
 *
 * `chartSx` below handles non-text visual styling only — axis line /
 * tick stroke, grid, legend, tooltip, highlight. It deliberately does
 * NOT touch axis text. After weeks of fighting `!important` /
 * injection-order regressions on the dashboard refresh, prop-driven
 * styling proved the only deterministic path.
 */
export const CHART_AXIS_TICK_STYLE = {
  fill: 'rgba(255,255,255,0.72)',
  fontSize: 12,
  fontWeight: 800,
  // Pin the family directly rather than `inherit` — MUI x-charts
  // internally spreads `theme.typography.caption` (fontFamily: Roboto)
  // into the SVG <text> inline style before our `tickLabelStyle`.
  // `inherit` worked when body font was reliably DM Sans, but it is
  // a chain of indirection we don't actually need. Set the family
  // explicitly so the rendered text always uses DM Sans, not whatever
  // the SVG / theme cascade happens to resolve to at mount time.
  fontFamily: '"DM Sans", "Segoe UI", system-ui, sans-serif',
};

export const CHART_AXIS_LABEL_STYLE = {
  fill: 'rgba(255,255,255,0.72)',
  fontSize: 13,
  fontWeight: 800,
  fontFamily: '"DM Sans", "Segoe UI", system-ui, sans-serif',
};

/**
 * Shared MUI `sx` overrides for the analytics line charts.
 *
 * Non-text styling only — axis line / tick stroke, grid, legend,
 * tooltip paper, axis highlight. Axis text styling is controlled
 * exclusively by `CHART_AXIS_TICK_STYLE` and `CHART_AXIS_LABEL_STYLE`
 * above (passed as MUI axis props). See the top-of-file comment.
 */
export const chartSx = {
  // The `&&` doubles the parent class selector (specificity 0,3,0)
  // to beat MUI's default `.MuiChartsAxis-root .MuiChartsAxis-line`
  // rule (specificity 0,2,0) which otherwise wins by being defined
  // later and forces `stroke-width: 1px` + `shape-rendering: crispedges`
  // — and that 1px crispedges stroke can render as 0px or 2px
  // depending on sub-pixel snap, which was the "goes bold sometimes"
  // variability. We pin width, color, and shape-rendering ourselves.
  '&& .MuiChartsAxis-line, && .MuiChartsAxis-tick': {
    stroke: 'rgb(255,255,255)',
    strokeWidth: 2,
    shapeRendering: 'geometricPrecision',
  },
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

/**
 * Shared dashboard hourly x-axis helpers.
 *
 * The dashboard charts show clean whole-hour tick marks with labels
 * on every-3-hour boundaries (12 AM, 3 AM, 6 AM, 9 AM, 12 PM, 3 PM,
 * 6 PM, 9 PM). The visible ticks never include the raw window
 * start/end times (e.g. `10:13 PM`), which are kept available only
 * in tooltips via `formatChartTooltipTime`.
 */

export const HOUR_MS = 60 * 60 * 1000;
export const LABEL_EVERY_HOURS = 3;

/**
 * Build the visible tick positions for a 24h-style dashboard x-axis.
 * Returns the whole-hour timestamps strictly between `start` and
 * `end` (excludes both endpoints, so the raw start/end times like
 * `10:13 PM` never appear as visible labels). For a window of
 * `10:13 PM` → `10:13 PM` this yields 11 PM, 12 AM, 1 AM, ..., 10 PM.
 */
export function buildHourlyTicks(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return [];
  }

  // Find the first whole hour strictly AFTER start. If start is at
  // 10:13 PM, the first whole hour at or before that is 10 PM, so we
  // bump forward to 11 PM.
  const firstHour = new Date(start);
  firstHour.setMinutes(0, 0, 0);
  let nextHour = firstHour.getTime();
  if (nextHour <= start) nextHour += HOUR_MS;

  const ticks = [];
  // Loop condition `tick < end` already enforces "strictly before
  // end", so 10 PM (22:00) is included for a 10:13 PM → 10:13 PM
  // window but 11 PM (23:00) is not.
  for (let tick = nextHour; tick < end; tick += HOUR_MS) {
    ticks.push(tick);
  }
  return ticks;
}

/**
 * Decide whether a tick value should render a visible label. Labels
 * appear only on whole-hour 3-hour boundaries — never on the raw
 * window start/end, which may be e.g. `10:13 PM`. Tick marks (small
 * hash marks on the axis) still render on every whole hour; this
 * function only gates the text label.
 */
export function shouldLabelTick(value) {
  if (!Number.isFinite(value)) return false;
  const tickDate = new Date(value);
  return tickDate.getMinutes() === 0 && tickDate.getHours() % LABEL_EVERY_HOURS === 0;
}

/**
 * Derive a compact, human-readable short label from a full location
 * name. Used by the fleet comparison chart to prefix legend/tooltip
 * labels with the yard so hives from the same location group together
 * visually and at a glance.
 *
 * Rules:
 *   - Trim and collapse internal whitespace.
 *   - Strip a trailing "Demo Yard" suffix (with optional surrounding
 *     whitespace) — the demo accounts all carry it and it adds nothing
 *     to a short label.
 *   - Take the first two whitespace-delimited words so the result stays
 *     compact even when the remaining name is long.
 *   - Falls back to the original string when it's already short, and
 *     to an empty string when the input is empty/null.
 *
 * Examples:
 *   "Blue Ridge Appalachia Demo Yard" → "Blue Ridge"
 *   "Rochester Demo Yard"            → "Rochester"
 *   "Central Park"                   → "Central Park"
 *   "Pisgah"                         → "Pisgah"
 */
export function shortLocationName(name) {
  if (typeof name !== 'string') return '';
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const withoutYard = cleaned.replace(/\s*Demo Yard\s*$/i, '').trim();
  if (!withoutYard) return cleaned;
  const words = withoutYard.split(' ');
  return words.slice(0, 2).join(' ');
}

/**
 * Build the structured display payload used by the fleet chart legend
 * pills and the chart tooltip row. Returns the hive's display name and
 * the short location label as separate fields so callers can stack
 * them as two visual lines (name on top, location below in muted
 * text) instead of gluing them together with a separator.
 *
 * Fallback chain for `name`: trim of `hive.name`, then `Hive <id>`,
 * then an empty string.
 *
 * `locationName` is the short form (see `shortLocationName`) and may
 * be the empty string when the hive has no location attached.
 */
export function getFleetHiveDisplay(hive) {
  const name = (hive?.name || '').trim()
    || (hive?.hiveId != null ? `Hive ${hive.hiveId}` : '');
  const locationName = shortLocationName(hive?.locationName);
  return { name, locationName };
}

/**
 * Stable sort for fleet chart hives. Order is:
 *   1. `locationName` ascending (locale-aware); empty/null sent to the end
 *      via the '\uFFFF' sentinel so hives with a real location come first.
 *   2. `name` ascending (locale-aware).
 *   3. Hive id ascending as a final deterministic tiebreaker.
 *
 * The chart applies `getFleetHiveColor(index)` to the sorted array, so
 * hives in the same yard end up adjacent in the palette — which reads
 * as a coherent color group in the legend.
 */
export function sortFleetHives(hives) {
  if (!Array.isArray(hives)) return [];
  const NO_LOCATION = '\uFFFF';
  return [...hives].sort((a, b) => {
    const aLoc = (a?.locationName || '').trim() || NO_LOCATION;
    const bLoc = (b?.locationName || '').trim() || NO_LOCATION;
    if (aLoc !== bLoc) return aLoc.localeCompare(bLoc);
    const aName = (a?.name || '').trim();
    const bName = (b?.name || '').trim();
    if (aName !== bName) return aName.localeCompare(bName);
    const aId = Number(a?.hiveId ?? a?.id) || 0;
    const bId = Number(b?.hiveId ?? b?.id) || 0;
    return aId - bId;
  });
}
