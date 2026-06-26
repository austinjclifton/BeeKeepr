import { TONES } from './tones';

// SR-only suffix for non-default tones. Helps screen readers
// distinguish "Healthy" from "Warning" without relying on color alone.
const TONE_SR_LABEL = {
  default: '',
  healthy: ' (healthy)',
  warning: ' (warning)',
  critical: ' (critical)',
  muted: '',
};

/**
 * Compact metric for the operations summary strip.
 *
 * Visual: tiny uppercase label with optional status dot, bold value,
 * optional short sublabel. Becomes a <button> when onClick is provided
 * so it stays keyboard-accessible.
 *
 * Two value shapes are supported:
 *   - `value` — single bold value string (most cells).
 *   - `rows`  — list of `{ name, temp }` pairs (Outside cell). Each
 *               row renders as a small flex line: full name on the
 *               left, temperature right-aligned at the far edge.
 */
function SummaryMetric({
  label,
  value,
  rows,
  secondary,
  tone = 'default',
  showDot = true,
  onClick,
  ariaLabel,
}) {
  const toneTokens = TONES[tone] || TONES.default;
  const srSuffix = TONE_SR_LABEL[tone] || '';
  const isInteractive = typeof onClick === 'function';
  const Tag = isInteractive ? 'button' : 'div';
  const hasSecondary = Boolean(secondary);
  const hasRows = Array.isArray(rows) && rows.length > 0;

  const computedAriaLabel =
    ariaLabel ||
    (hasRows
      ? `${label}: ${rows.map(r => `${r.name} ${r.temp}`).join(', ')}`
      : `${label}: ${value}${srSuffix}${hasSecondary ? `. ${secondary}` : ''}`);

  return (
    <Tag
      type={isInteractive ? 'button' : undefined}
      onClick={onClick}
      className={
        'group/summary-metric flex h-full min-w-0 flex-1 flex-col items-stretch gap-1 border-0 bg-transparent p-0 text-left font-inherit text-inherit ' +
        (isInteractive
          ? 'cursor-pointer rounded-md transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-[-2px] focus-visible:ring-offset-bg '
          : 'cursor-default ')
      }
      style={{ WebkitTapHighlightColor: 'transparent' }}
      aria-label={computedAriaLabel}
    >
      <div className="inline-flex max-w-full items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-extrabold uppercase leading-[1.2] tracking-[0.05em] text-ink-muted">
        {showDot && (
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneTokens.dot}`}
          />
        )}
        <span className="overflow-hidden text-ellipsis">{label}</span>
      </div>
      {hasRows ? (
        <div className="flex min-w-0 max-w-full flex-col gap-0.5 text-[14px] font-extrabold leading-[1.2] tabular-nums">
          {rows.map((row, index) => (
            <div
              key={`${row.name}-${index}`}
              className="flex min-w-0 items-baseline justify-between gap-2"
            >
              <span className="min-w-0 truncate text-white">{row.name}</span>
              <span className="shrink-0 text-amber-light">{row.temp}</span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={`min-w-0 max-w-full whitespace-pre-line text-[18px] font-extrabold leading-[1.15] tracking-[-0.01em] tabular-nums ${toneTokens.text}`}
        >
          {value}
        </div>
      )}
      {hasSecondary && (
        <div className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-medium leading-[1.2] text-ink-muted">
          {secondary}
        </div>
      )}
    </Tag>
  );
}

/**
 * Renders a compact horizontal "operations command strip" directly
 * below the dashboard header. Uses the same elevated dark surface as
 * the other dashboard cards.
 *
 * Layout rules (predictable across viewports via CSS grid):
 *   - xl (≥1280px): one row, weighted by each metric's `width` prop
 *     (default 1). Compact count cells (Total / Healthy / Warning /
 *     Critical / Offline) get 1 unit each; Outside gets ~3.2 units so
 *     the full yard name + temperature fit; Unresolved gets ~1.5 units.
 *     The grid template is built from the runtime metrics array and
 *     applied at xl via the `--ops-cols` CSS custom property + the
 *     matching media query in `index.css`.
 *   - sm  (≥640px):  4+3 split (4 cells row 1, 3 cells row 2).
 *   - <640px:        2-col grid, no dividers, no horizontal scroll.
 */
export default function OperationsSummaryStrip({
  metrics,
  rangeLabel,
  className = '',
}) {
  // Build the xl column template from per-metric widths. The sum of
  // widths is normalised to fill the available width. Below xl the
  // grid uses equal columns (2 / 4) so this template doesn't apply.
  const xlTemplate = metrics
    .map(m => `${m.width ?? 1}fr`)
    .join(' ');

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-line bg-surface-elevated shadow-card-sm ${className}`}
      role="group"
      aria-label={rangeLabel ? `Operations summary (${rangeLabel})` : 'Operations summary'}
    >
      {/* Thin amber accent line along the top edge — a quiet nod to
          the rest of the design system without dominating. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-amber/60"
      />

      <div
        data-ops-strip
        className="grid grid-cols-2 sm:grid-cols-4"
        style={{ '--ops-cols': xlTemplate }}
      >
        {metrics.map((metric, index) => {
          // sm (4 cols): drop right border on 4/8/12..., top border
          // starting at index 4.
          const isEndOfSmRow = (index + 1) % 4 === 0;
          const isStartOfSmRow2 = index >= 4;
          // Mobile (2 cols): every even-indexed cell is row-end.
          const isEndOfMobileRow = (index + 1) % 2 === 0;
          const isStartOfMobileRow2 = index >= 2;
          // xl (single row): drop the right border on the very
          // last cell and the bottom border on the whole row.
          const isLastCell = index === metrics.length - 1;

          return (
            <div
              key={`${metric.label}-${index}`}
              className={
                'min-w-0 px-4 py-3 ' +
                // Right + bottom border by default; we'll drop them
                // at row-ends and on the single xl row.
                'border-r border-b border-line-soft ' +
                // Mobile (2 cols): drop right border on even cells,
                // drop bottom border on the last row.
                `max-sm:[&:nth-child(2n)]:border-r-0 ` +
                `max-sm:[&:nth-child(n+${metrics.length - 1})]:border-b-0 ` +
                `max-sm:px-3.5 max-sm:py-2.5 ` +
                // sm (4 cols): drop right border on 4/8, top border
                // starting at index 4.
                (isEndOfSmRow
                  ? `sm:max-xl:[&:nth-child(4n)]:border-r-0 `
                  : '') +
                (isStartOfSmRow2
                  ? `sm:max-xl:[&:nth-child(n+5)]:border-t sm:max-xl:[&:nth-child(n+5)]:border-line-soft sm:max-xl:[&:nth-child(n+5)]:pt-3 `
                  : '') +
                // xl (single row): strip the right border on the
                // very last cell and the bottom border on the row.
                (isLastCell
                  ? `xl:border-r-0 `
                  : '') +
                `xl:border-b-0 ` +
                // Mobile extra rules.
                (isStartOfMobileRow2 && !isEndOfMobileRow
                  ? `max-sm:border-t max-sm:border-line-soft max-sm:pt-2.5 `
                  : '')
              }
            >
              <SummaryMetric {...metric} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
