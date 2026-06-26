/**
 * Shared wrapper for the three "non-data" states shown in cards:
 * loading, error, and empty. Centralizes the layout + min-height so
 * the three variants stay visually consistent.
 */
function StateBlock({ tone = 'default', children }) {
  const toneClass = {
    default: 'text-ink-secondary',
    error: 'text-ink-secondary', // message is colored separately
    success: 'text-ink-secondary',
  }[tone];

  return (
    <div
      className={`flex min-h-[220px] flex-col items-center justify-center gap-2.5 px-6 py-6 text-center text-sm ${toneClass}`}
    >
      {children}
    </div>
  );
}

/** Pulsing dot + label, used while a card is fetching its data. */
export function LoadingState({ label = 'Loading data…' }) {
  return (
    <StateBlock>
      <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber" />
      <div>{label}</div>
    </StateBlock>
  );
}

/** Error message + optional Retry button. The message uses the brand
 *  `error` token so it stays on-theme with the rest of the app. */
export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <StateBlock tone="error">
      <div className="text-error">{message}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-pill border border-line bg-white/5 px-3 py-1.5 text-xs font-extrabold text-ink-secondary transition hover:border-amber hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Retry
        </button>
      )}
    </StateBlock>
  );
}

/** Friendly "nothing to show" placeholder for empty cards. */
export function EmptyState({ title = 'No data yet', detail }) {
  return (
    <StateBlock>
      <div className="font-extrabold text-white">{title}</div>
      {detail && <div className="text-ink-secondary">{detail}</div>}
    </StateBlock>
  );
}
