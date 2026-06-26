import { useCallback, useEffect, useState } from 'react';
import { getHiveStatus } from '../api';

/**
 * Loads the per-user hive status payload (hives, range, bucketSize, startAt,
 * endAt) for the given analytics query. Exposes a `refresh` callback the UI
 * can wire to a "Retry" button.
 *
 * The query is tracked via a JSON stringified key + the resolved range, so
 * a new `query` object with the same values doesn't re-fire the request.
 */
export function useHiveStatus(query, { enabled = true } = {}) {
  const queryKey = JSON.stringify(query ?? '1d');
  const currentRange = getQueryRange(query);

  // Shared status state.
  const [state, setState] = useState({
    hives: [],
    range: currentRange,
    bucketSize: null,
    startAt: null,
    endAt: null,
    loading: enabled,
    error: '',
  });

  // Single internal loader: used both by the auto-load effect and by
  // the manual `refresh` callback exposed below.
  const load = useCallback(async () => {
    if (!enabled) {
      setState({
        hives: [],
        range: currentRange,
        bucketSize: null,
        startAt: null,
        endAt: null,
        loading: false,
        error: '',
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await getHiveStatus(query);
      setState({
        hives: data?.hives ?? [],
        range: data?.range ?? currentRange,
        bucketSize: data?.bucketSize ?? null,
        startAt: data?.startAt ?? null,
        endAt: data?.endAt ?? null,
        loading: false,
        error: '',
      });
    } catch (err) {
      setState({
        hives: [],
        range: currentRange,
        bucketSize: null,
        startAt: null,
        endAt: null,
        loading: false,
        error: err?.message || 'Failed to load hive status',
      });
    }
  }, [enabled, queryKey, currentRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load on mount + whenever the query / enabled state changes.
  useEffect(() => {
    let cancelled = false;
    load().then(() => {
      // load() handles its own state, but the cancelled flag is still useful
      // for callers that flip `enabled` quickly.
      void cancelled;
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return {
    ...state,
    refresh: load,
  };
}

function getQueryRange(query) {
  if (typeof query === 'string') return query;
  return query?.range ?? 'custom';
}
