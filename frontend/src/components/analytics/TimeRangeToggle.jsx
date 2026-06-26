import { ANALYTICS_RANGE_OPTIONS } from '../../hooks/useAnalyticsRange';

/**
 * Pill-style segmented control for picking an analytics range. The
 * selected pill uses the brand amber; the others are transparent with
 * muted text that brightens on hover. Keyboard focus shows a ring
 * (inherits the brand amber).
 */
export default function TimeRangeToggle({ range, onChange, disabled = false }) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-pill border border-line bg-white/[0.04] p-1"
      aria-label="Analytics range"
    >
      {ANALYTICS_RANGE_OPTIONS.map(option => {
        const active = option.value === range;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={
              'min-w-[44px] cursor-pointer rounded-pill border-none px-3 py-2 text-[12px] font-extrabold tracking-[0.04em] transition ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
              (active
                ? 'bg-amber text-navy'
                : 'bg-transparent text-ink-secondary hover:text-white') +
              (disabled ? ' cursor-not-allowed opacity-60' : '')
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
