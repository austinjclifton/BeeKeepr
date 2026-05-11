export function LoadingState({ label = 'Loading data…' }) {
  return (
    <div className="state-block">
      <div className="state-pulse" />
      <div>{label}</div>
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="state-block state-block-error">
      <div>{message}</div>
      {onRetry && (
        <button type="button" className="ghost-btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'No data yet', detail }) {
  return (
    <div className="state-block">
      <div style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{title}</div>
      {detail && <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{detail}</div>}
    </div>
  );
}
