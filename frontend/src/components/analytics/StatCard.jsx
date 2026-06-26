import { getTone } from './tones';

const SIZE = {
  // compact: dense stat grid (e.g. SelectedHiveSection side panel).
  compact: {
    card: 'min-h-[104px] p-3.5',
    value: 'text-[21px] leading-[1.08]',
    dot: 'h-2 w-2',
  },
  // regular: top-level cards.
  regular: {
    card: 'min-h-[128px] p-[18px]',
    value: 'text-[28px] leading-[1.08]',
    dot: 'h-2 w-2',
  },
};

/**
 * Single-stat card: micro label + value + optional detail line.
 *
 * Renders as a <button> when `onClick` is supplied so it stays
 * keyboard-accessible. A clickable card gets a hover lift, a focus ring,
 * and a subtle border-amber tint on hover.
 */
export default function StatCard({
  label,
  value,
  detail,
  tone = 'default',
  onClick,
  compact = false,
}) {
  const toneTokens = getTone(tone);
  const size = SIZE[compact ? 'compact' : 'regular'];
  const Tag = onClick ? 'button' : 'div';

  const baseClass =
    'flex w-full min-w-0 flex-col gap-2 border border-line bg-surface-elevated text-left text-ink-primary shadow-card-sm transition';
  const clickClass = onClick
    ? 'cursor-pointer hover:-translate-y-px hover:border-amber/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
    : '';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`${baseClass} ${size.card} ${clickClass} ${onClick ? toneTokens.ring : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
          {label}
        </div>
        <span aria-hidden="true" className={`mt-1 rounded-full ${size.dot} ${toneTokens.dot}`} />
      </div>
      <div className={`font-extrabold ${size.value} [overflow-wrap:anywhere]`}>
        {value}
      </div>
      {detail && (
        <div className="text-[12px] leading-snug text-ink-muted">{detail}</div>
      )}
    </Tag>
  );
}
