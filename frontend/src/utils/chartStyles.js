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
