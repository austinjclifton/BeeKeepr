import {
  formatCount,
  formatPercent,
  formatPrecipMm,
  formatPressureHpa,
  formatRelativeTime,
  formatTemperature,
  formatWindMps,
} from '../../utils/analyticsFormat';
import { TONES } from './tones';

// ============================================================================
// Text hierarchy system
// ============================================================================
//
// Every value in the selected-hive strip is assigned to one of four
// tiers, and every tier has a fixed color + size. This is what keeps
// the strip from feeling like a random mix of white and gray text.
//
//   Tier A — GROUP LABEL
//     - 11px uppercase muted gray (text-ink-muted)
//     - Examples: "LATEST", "24H INTERNAL", "OUTSIDE", "WEATHER",
//       "TELEMETRY"
//
//   Tier B — PRIMARY VALUE
//     - Large, bright, accent-colored where the data is "the" answer
//       for that group.
//     - Internal / current (Latest): amber-light
//     - External (Outside primary temp): cyan
//     - 24h Internal sub-cell values, Telemetry "Total readings":
//       white (treated as supporting "the" set of values for the
//       group, not a single headline number).
//
//   Tier C — SECONDARY / SUPPORTING VALUE
//     - Important supporting data that the user must read at a glance
//       (delta, humidity, wind, gust, clouds, pressure, rain, signal,
//       packet id, last received, yard name).
//     - WHITE (text-white) for the value portion
//     - The accompanying inline label word (e.g. "Humidity", "Wind",
//       "Signal", "Packet") stays muted gray so the value pops.
//     - Single-sentence supporting lines (yard name, "Last received
//       2m ago") use text-ink-secondary so they read as supporting
//       copy without feeling disabled.
//
//   Tier D — MICRO / META
//     - Reserved for true metadata ("No packets yet" fallback, "No
//       external reading" fallback, the "·" separator between paired
//       values).
//     - 12px text-ink-muted or text-ink-muted/60 for the separator.
// ============================================================================

// Tier A — group label.
const LABEL_CLASS =
  'text-[11px] font-extrabold uppercase leading-[1.2] tracking-[0.05em] text-ink-muted';

// Tier C — single-sentence supporting copy (yard name, "Last received
// 2m ago" when treated as a single supporting line).
const SUPPORTING_TEXT_CLASS =
  'text-[12.5px] leading-[1.2] text-ink-secondary';

// Tier D — meta fallback ("No packets yet", "No external reading").
const META_TEXT_CLASS =
  'text-[12px] leading-[1.2] text-ink-muted';

// Cyan accent color for the outside/external primary value. Kept
// inline so the Tailwind JIT scanner picks it up.
const CYAN_CLASS = 'text-[#22D3EE]';

// Amber accent for internal/latest primary values (via TONES.default).

// Dot-separator color: muted but still visible at small sizes.
const DOT_CLASS = 'text-ink-muted/70';

// CSS-grid border management for the 5 grouped sections.
//
// Layout breakpoints:
//   - default (mobile, <md): 1 column stacked — every cell except the
//     last gets a bottom border (line-soft).
//   - md (≥768px): 3 columns, 2 rows (Latest · 24h Internal · Outside
//     on row 1; Weather · Telemetry on row 2). The right-most cell in
//     each row drops its right border; the bottom row drops its bottom
//     border.
//   - lg (≥1024px): 5 columns, 1 row. Cells 1-4 have a right border,
//     cell 5 has no right border; no bottom border anywhere.
//
// The strip's outer `border border-line` provides the strong outer
// frame; these inner borders are intentionally weaker (line-soft) so
// the section groups read as a single unit.
//
// Each cell uses `grid-rows-[auto_auto]` (two auto rows: label + content)
// so cells shrink to fit their own content. The previous `auto_1fr_auto`
// pattern stretched every cell to match the tallest neighbour, which
// pushed short cells (Latest) to the vertical middle — fixed here.
//
// `content-start` (= align-content: start) keeps the two grid rows at
// their natural auto heights and lets any leftover vertical space fall
// below the content, instead of stretching the rows to fill the cell.
// Combined with `items-start` (per-item top alignment) this guarantees
// the cell's content sits flush at the top of the cell.
const CELL_BASE =
  'grid grid-rows-[auto_auto] content-start gap-1 px-4 py-3 border-line-soft min-w-0 items-start justify-start';
const CELL_BORDERS = {
  // Row 1 / Col 1 — narrow, just a temp (the "Xm ago" lives in
  // Telemetry / HivePicker now).
  latest:
    'border-b border-line-soft md:border-r md:border-b lg:border-b-0 lg:border-r',
  // Row 1 / Col 2 — medium, 2x2 sub-grid.
  internal:
    'border-b border-line-soft md:border-r md:border-b lg:border-b-0 lg:border-r',
  // Row 1 / Col 3 — wide, the most context (yard + temp + delta + H/W).
  outside:
    'border-b border-line-soft md:border-r-0 md:border-b lg:border-b-0 lg:border-r',
  // Row 2 / Col 1 — wide/medium, the stacked weather details
  // (Gust, Clouds, Pressure, Rain).
  weather:
    'border-b border-line-soft md:border-r md:border-b-0 lg:border-b-0 lg:border-r',
  // Last cell at every breakpoint — no borders (the strip's outer
  // frame serves on the right and bottom).
  telemetry: '',
};

/**
 * Hive-vs-outside delta copy (Tier C — supporting value, white).
 *
 *   positive       → "Hive is X.X°F warmer"
 *   negative       → "Hive is X.X°F cooler"
 *   near-zero      → "Equal to outside"
 *   missing values → "Hive is —" (safe fallback)
 */
function getDeltaCopy(tempDelta) {
  if (!Number.isFinite(Number(tempDelta))) {
    return 'Hive is —';
  }
  const d = Number(tempDelta);
  const absDelta = Math.abs(d).toFixed(1);
  if (Math.abs(d) < 0.05) {
    return 'Equal to outside';
  }
  if (d > 0) {
    return `Hive is ${absDelta}°F warmer`;
  }
  return `Hive is ${absDelta}°F cooler`;
}

/**
 * Compact, grouped metrics strip above the 24-hour temperature chart.
 *
 * Five-section layout that combines internal + external + telemetry +
 * secondary weather data into one polished panel above the chart:
 *
 *   1. Latest      — latest internal temp only (narrow). Freshness
 *                    ("Xm ago") deliberately lives in Telemetry +
 *                    HivePicker to avoid three different "Xm ago"
 *                    sources on one row.
 *   2. 24h Internal — Max / Avg / Min / Swing in a 2×2 sub-grid
 *                    (left col: Max/Min, right col: Avg/Swing)
 *   3. Outside     — yard name, external temp, "Hive is X°F
 *                    warmer/cooler" delta, humidity, wind
 *   4. Weather     — Gust, Clouds, Pressure, Rain stacked top-to-bottom
 *                    in a single column (no dot pairing)
 *   5. Telemetry   — Total readings, Signal, Packet, then "Last received"
 *                    anchored at the bottom of the cell
 *
 * All five cells share the same text hierarchy system (see the
 * `LABEL_CLASS` / `SUPPORTING_TEXT_CLASS` / `META_TEXT_CLASS` block
 * above the borders section). Labels and inline label words are
 * muted gray; primary and supporting values are white or accent.
 */
export default function SelectedHiveMetricRow({
  summary,
  latestReading,
  hive,
}) {
  // Internal metrics (Tier B primaries)
  const latest = summary?.latestTemperature;
  const avg = summary?.averageTemperature;
  const min = summary?.minTemperature;
  const max = summary?.maxTemperature;
  const swing = summary?.temperatureSwing;
  const readings = summary?.readingCount;

  // External / environment metrics (Tier B + C)
  const externalTemp = hive?.externalTemperature;
  const humidity = hive?.externalHumidityPct;
  const wind = hive?.externalWindMps;
  const windGust = hive?.externalWindGustMps;
  const cloudPct = hive?.externalCloudPct;
  const pressureHpa = hive?.externalPressureHpa;
  const precipMm = hive?.externalPrecipMm;
  const yardName = hive?.locationName;

  // Telemetry (Tier B + C).
  //
  // Canonical "when was the last reading received" timestamp comes from
  // `hive.latestReadingAt` — the SAME field the HivePicker row renders
  // on the left side of the dashboard. Pulling the timestamp from
  // `latestReading.receivedAt` (the analytics endpoint) instead caused
  // the picker row and the strip's "Last received" line to disagree
  // when the two endpoints had different freshness, which read as a
  // bug to the user.
  //
  // Packet id and signal (RSSI) only exist on the analytics endpoint
  // and stay sourced from `latestReading`.
  const receivedAt = hive?.latestReadingAt;
  const packetId = latestReading?.id;
  const rssi = latestReading?.rssi;

  const hasReadings = Number.isFinite(Number(readings)) && Number(readings) > 0;
  const lastSeenLabel = receivedAt ? formatRelativeTime(receivedAt) : 'No recent reading';

  // Hive vs outside delta (internal latest minus outside).
  const tempDelta =
    Number.isFinite(Number(latest)) && Number.isFinite(Number(externalTemp))
      ? Number(latest) - Number(externalTemp)
      : null;
  const deltaCopy = getDeltaCopy(tempDelta);

  // Whether any external reading exists at all. Drives the
  // "No external reading" fallback in the Outside cell.
  const hasAnyExternal =
    externalTemp != null || humidity != null || wind != null;

  // Derived sub-cell values for 24h Internal sub-grid.
  const internalCells = [
    { label: 'Max', value: formatTemperature(max) },
    { label: 'Avg', value: formatTemperature(avg) },
    { label: 'Min', value: formatTemperature(min) },
    { label: 'Swing', value: formatTemperature(swing) },
  ];

  return (
    <div
      className="rounded-lg border border-line bg-surface-elevated shadow-card-sm"
      role="group"
      aria-label="Selected hive metrics"
    >
      <div
        className={[
          'grid',
          'grid-cols-1',
          'md:grid-cols-3',
          'lg:grid-cols-[110px_minmax(0,1.3fr)_minmax(0,1.7fr)_minmax(0,1.4fr)_minmax(0,1.2fr)]',
        ].join(' ')}
      >
        {/* ------------------------------------------------------------ */}
        {/* 1. LATEST — Tier B primary only. Freshness ("Xm ago") lives   */}
        {/*    in Telemetry / HivePicker, so we keep this cell compact.  */}
        {/*    The temp is top-aligned (self-start) so it sits directly  */}
        {/*    under the label instead of vertically centering inside a  */}
        {/*    cell that's been stretched to match the tall Telemetry     */}
        {/*    cell next to it.                                           */}
        {/* ------------------------------------------------------------ */}
        <div className={`${CELL_BASE} ${CELL_BORDERS.latest}`}>
          <div className={`inline-flex items-center gap-1.5 ${LABEL_CLASS}`}>
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONES.default.dot}`}
            />
            <span>Latest</span>
          </div>
          <div
            className={`min-w-0 self-start max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[24px] font-extrabold leading-[1.05] tracking-[-0.01em] tabular-nums ${TONES.default.text}`}
          >
            {formatTemperature(latest)}
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* 2. 24H INTERNAL — 2x2 sub-grid:                                */}
        {/*    row 1: MAX   AVG   (left col Max, right col Avg)            */}
        {/*    row 2: MIN   SWING (left col Min, right col Swing)          */}
        {/*    SubCell values use `whitespace-nowrap` (no `truncate`) so   */}
        {/*    they never get clipped to "..." on tight widths.            */}
        {/* ------------------------------------------------------------ */}
        <div className={`${CELL_BASE} ${CELL_BORDERS.internal}`}>
          <div className={`inline-flex items-center gap-1.5 ${LABEL_CLASS}`}>
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONES.default.dot}`}
            />
            <span>24h Internal</span>
          </div>
          <div className="min-w-0 self-start">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {internalCells.map(cell => (
                <SubCell key={cell.label} label={cell.label} value={cell.value} />
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* 3. OUTSIDE — yard context, cyan primary, white delta + H/W    */}
        {/* ------------------------------------------------------------ */}
        <div className={`${CELL_BASE} ${CELL_BORDERS.outside}`}>
          <div className={`inline-flex items-center gap-1.5 ${LABEL_CLASS}`}>
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22D3EE]"
            />
            <span>Outside</span>
          </div>
          <div className="min-w-0 self-start space-y-1.5">
            {yardName && (
              <div className="min-w-0 truncate text-[16px] font-extrabold leading-[1.15] tracking-[-0.01em] text-white">
                {yardName}
              </div>
            )}
            <div className="flex items-baseline gap-2 flex-wrap">
              {/* Tier B primary — cyan, large */}
              <span
                className={`text-[20px] font-extrabold leading-[1.05] tracking-[-0.01em] tabular-nums ${CYAN_CLASS}`}
              >
                {formatTemperature(externalTemp)}
              </span>
              {/* Tier C delta — white, readable */}
              <span className="text-[13px] leading-[1.2] tabular-nums text-white">
                {deltaCopy}
              </span>
            </div>
            {/* Tier C supporting line — label muted, value white */}
            <div className="text-[13px] leading-[1.2]">
              {hasAnyExternal ? (
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-ink-muted">Humidity</span>
                  <span className="text-white tabular-nums">
                    {formatPercent(humidity)}
                  </span>
                  <span className={DOT_CLASS}>·</span>
                  <span className="text-ink-muted">Wind</span>
                  <span className="text-white tabular-nums">
                    {formatWindMps(wind)}
                  </span>
                </span>
              ) : (
                <span className={META_TEXT_CLASS}>No external reading</span>
              )}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* 4. WEATHER — four label/value pairs stacked top-to-bottom in  */}
        {/*    a single column. Labels muted, values white, no inline     */}
        {/*    dot separators (a vertical list reads cleaner than two     */}
        {/*    paired rows). Compact leading (1.2) keeps the cell         */}
        {/*    manageable even with four lines.                           */}
        {/* ------------------------------------------------------------ */}
        <div className={`${CELL_BASE} ${CELL_BORDERS.weather}`}>
          <div className={`inline-flex items-center gap-1.5 ${LABEL_CLASS}`}>
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22D3EE]"
            />
            <span>Weather</span>
          </div>
          <div className="min-w-0 self-start space-y-1 text-[13px] leading-[1.2] tabular-nums">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-ink-muted">Gust</span>
              <span className="text-white">{formatWindMps(windGust)}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-ink-muted">Clouds</span>
              <span className="text-white">{formatPercent(cloudPct)}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-ink-muted">Pressure</span>
              <span className="text-white">{formatPressureHpa(pressureHpa)}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-ink-muted">Rain</span>
              <span className="text-white">
                {Number.isFinite(Number(precipMm))
                  ? formatPrecipMm(precipMm)
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* 5. TELEMETRY — 4 stacked lines, each a label/value pair       */}
        {/*    (except "Last received" which is a single supporting       */}
        {/*    line). The count is no longer a "headline" big number —   */}
        {/*    it sits as the first line so the rhythm matches the       */}
        {/*    other stacked groups (Signal, Packet, then "Last          */}
        {/*    received" anchored at the bottom).                         */}
        {/* ------------------------------------------------------------ */}
        <div className={`${CELL_BASE} ${CELL_BORDERS.telemetry}`}>
          <div className={LABEL_CLASS}>
            Telemetry
          </div>
          <div className="min-w-0 self-start space-y-1 text-[13px] leading-[1.2]">
            {/* Line 1 — Total readings count (label + value). */}
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-ink-muted">Total readings</span>
              <span className="font-extrabold tabular-nums text-white">
                {formatCount(readings)}
              </span>
              <span className="text-ink-muted">· 24h</span>
            </div>
            {/* Line 2 — signal strength. */}
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-ink-muted">Signal</span>
              <span className="text-white tabular-nums">
                {rssi != null ? `${rssi} dBm` : '—'}
              </span>
            </div>
            {/* Line 3 — packet ID. */}
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-ink-muted">Packet</span>
              <span className="text-white tabular-nums">
                {hasReadings && packetId != null ? `#${packetId}` : '—'}
              </span>
            </div>
            {/* Line 4 — when the reading was received (supporting,        */}
            {/* anchored at the bottom so freshness reads last). */}
            <div className={`${SUPPORTING_TEXT_CLASS} tabular-nums`}>
              Last received {lastSeenLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact numeric cell used inside the 24h Internal section's 2×2
// sub-grid. Tier A label (muted) over Tier B value (white) — matches
// the label/value rhythm used by Weather and Telemetry.
//
// Responsive: the parent uses `grid grid-cols-2` with a small column
// gap, so on very narrow strips the columns can become tight. We use
// `whitespace-nowrap` on both label and value (instead of `truncate`)
// so the value never gets clipped to "..." — the grid will simply
// stretch vertically if a cell needs to break.
function SubCell({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="whitespace-nowrap text-[11px] font-extrabold uppercase leading-[1.2] tracking-[0.05em] text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 min-w-0 whitespace-nowrap text-[14px] font-extrabold leading-[1.2] tracking-[-0.01em] tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}
