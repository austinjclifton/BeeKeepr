/**
 * Single source of truth for chart axis text styling. Used both as
 * MUI x-charts per-axis `tickLabelStyle` / `labelStyle` props (which
 * win over CSS via the inline `style` attribute on the SVG <text>)
 * AND as `chartSx` CSS-class overrides (which catch anything the
 * per-axis props don't cover).
 *
 * Pinning every property — including `fontWeight` — kills the
 * "font weight looks different after a refresh / hard refresh /
 * prod build" drift that came from `fontWeight` falling through to
 * MUI x-charts' implicit defaults, which were resolved differently
 * depending on emotion's CSS injection order (matters here because
 * the dashboard chart components are `lazy()`-loaded behind
 * `<Suspense>`).
 *
 * Font sizes were bumped from 11 → 12 in the dashboard readability
 * pass (Jun 2026); the 11px tick labels were too small against the
 * dashboard's other chrome.
 */
export const CHART_AXIS_TICK_STYLE = {
  fill: 'rgba(255,255,255,0.62)',
  fontSize: 12,
  fontWeight: 400,
};

export const CHART_AXIS_LABEL_STYLE = {
  fill: 'rgba(255,255,255,0.65)',
  fontSize: 13,
  fontWeight: 500,
};

/**
 * Hard cap for visible dashboard x-axis time labels. The fleet chart
 * used to emit ~29 candidates and hope MUI's space-filter trimmed
 * them; in production the wider canvas kept too many, leaving the
 * axis crowded. `pickTickIndices` enforces this cap directly.
 */
export const DASHBOARD_TIME_TICK_LIMIT = 6;

/**
 * Time-axis tick interval (in hours) used by the selected-hive
 * dashboard chart's custom HTML label row. Decoupled from MUI's
 * SVG tick rendering on purpose — the selected-hive chart no
 * longer relies on MUI to render its visible x-axis time labels
 * (see DashboardHiveTemperatureChart.jsx for the rationale on the
 * EmptyState → LineChart mount transition that silently dropped
 * MUI tick labels on soft reload). 3h gives a readable cadence on
 * the 24h view without crowding the card.
 */
export const DASHBOARD_TIME_TICK_HOURS = 3;

/**
 * Build a deterministic subset of axis tick values, **always including
 * the first and last**. Returns the values (not indices) so the result
 * can be passed directly to MUI x-charts' `tickInterval` array form,
 * which on continuous scales (time/linear) overrides the D3-generated
 * default ticks and renders exactly these as visible labels.
 *
 * Why an array and not a callback: on continuous scales the
 * `tickLabelInterval` callback receives the **tick index**, not the
 * data index (see MUI x-charts `models/axis.d.ts` — "the index is
 * tick index, not data ones"). An index-based predicate keyed on the
 * data array length silently misaligns with MUI's shorter
 * D3-generated tick array and most/all labels vanish. Passing
 * explicit values via `tickInterval` sidesteps that mismatch.
 *
 * Behavior:
 *   - `values` empty / non-array  → returns []
 *   - `values.length <= maxLabels` → returns a copy of `values`
 *   - otherwise                    → distributes `maxLabels` indices
 *     across `[0, length-1]` via a rounded arithmetic progression so
 *     the first and last are always included, then returns the
 *     corresponding values in order.
 *
 * The visible-count minimum of 2 keeps first/last even when the
 * caller asks for a very small `maxLabels`.
 */
export function pickTickValues(values, maxLabels = DASHBOARD_TIME_TICK_LIMIT) {
  const arr = Array.isArray(values) ? values : [];
  const count = arr.length;
  const limit = Math.max(2, Number(maxLabels) || DASHBOARD_TIME_TICK_LIMIT);
  if (count <= 0) return [];
  if (count <= limit) return [...arr];

  const visibleCount = Math.max(2, Math.min(limit, count));
  const indices = new Set();

  for (let i = 0; i < visibleCount; i += 1) {
    indices.add(Math.round((i * (count - 1)) / (visibleCount - 1)));
  }

  return [...indices]
    .sort((a, b) => a - b)
    .map((index) => arr[index]);
}

/**
 * Build a deterministic subset of time-axis values spaced by a fixed
 * hour interval, **always including the first and last** values.
 *
 * Different from `pickTickValues` (which distributes by count): this
 * one walks the input in order and stamps a tick the first time the
 * cursor crosses each `intervalHours` boundary, then guarantees the
 * final value is present. That gives calendar-aligned ticks (00:00,
 * 03:00, 06:00, …) instead of evenly-spaced-by-index ticks, which
 * matters for the custom HTML time-axis label row that the selected-
 * hive chart renders below its LineChart.
 *
 * Input is expected to be epoch-millisecond numbers (the same
 * primitive shape the chart's x-axis data uses). Non-finite entries
 * are filtered out before the walk so a stray NaN can't poison the
 * result.
 *
 * Behavior:
 *   - empty / non-array input           → []
 *   - single-element input              → [first] (Set → dedup keeps it)
 *   - first === last                    → [first]
 *   - otherwise                         → ticks at first and last, plus
 *     the first value ≥ each subsequent `first + n * interval` step.
 *
 * The hour interval default is `DASHBOARD_TIME_TICK_HOURS` (3h).
 */
export function pickTimeTickValues(values, intervalHours = DASHBOARD_TIME_TICK_HOURS) {
  const arr = Array.isArray(values)
    ? values.filter((value) => Number.isFinite(Number(value)))
    : [];

  if (!arr.length) return [];

  const intervalMs =
    Math.max(1, Number(intervalHours) || DASHBOARD_TIME_TICK_HOURS) * 60 * 60 * 1000;
  const first = arr[0];
  const last = arr[arr.length - 1];
  const ticks = new Set([first]);

  let nextTarget = first + intervalMs;

  for (const value of arr) {
    if (value >= nextTarget) {
      ticks.add(value);
      nextTarget = value + intervalMs;
    }
  }

  ticks.add(last);

  return [...ticks].sort((a, b) => a - b);
}

/**
 * Shared MUI `sx` overrides for the analytics line charts.
 *
 * Centralizes the dark-theme axis/grid/tooltip colors so every chart
 * renders identically. Kept in `utils/` because it's pure styling data
 * with no React component logic.
 *
 * Axis text rules reference the shared `CHART_AXIS_TICK_STYLE` /
 * `CHART_AXIS_LABEL_STYLE` constants so the CSS-class path and the
 * per-axis props can't drift apart.
 */
export const chartSx = {
  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: 'rgba(255,255,255,0.18)' },
  '& .MuiChartsAxis-tickLabel': { ...CHART_AXIS_TICK_STYLE },
  '& .MuiChartsAxis-label': { ...CHART_AXIS_LABEL_STYLE },
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
