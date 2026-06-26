import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Generic hook for fetching a single resource and tracking its
 * `{ data, loading, error }` lifecycle.
 *
 * Why this exists: every page was hand-rolling the same shape — a `cancelled`
 * guard, a `setLoading(true)` reset, a try/catch that splits into data and
 * error branches. Centralizing it here means new fetch effects are a
 * one-liner and error/loading states stay consistent across the app.
 *
 * Returns the current resource state plus a `reload()` function the caller
 * can invoke manually (e.g. for a "Retry" button). Reload ignores the
 * cancelled-flag of any in-flight effect since it represents a fresh user
 * action.
 *
 * @param fetcher  Async function that resolves to the resource.
 * @param deps     Dependency list that re-triggers the effect.
 * @param options  `{ enabled, initialData, errorFallback }`.
 *   - `enabled` defaults to `true`; pass `false` to clear the resource
 *     and skip the fetch (e.g. when a required id is missing).
 *   - `initialData` is what `data` should be before the first fetch lands.
 *   - `errorFallback` is the error message used when the thrown error
 *     doesn't carry one.
 */
export function useAsyncResource(fetcher, deps = [], options = {}) {
  const { enabled = true, initialData = null, errorFallback = 'Failed to load' } = options;
  const [state, setState] = useState({ data: initialData, loading: enabled, error: '' });

  // Keep the latest fetcher in a ref so `reload` always uses the freshest
  // closure (the effect below still keys on the supplied `deps` array).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    if (!enabled) return;
    setState(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await fetcherRef.current();
      setState({ data, loading: false, error: '' });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err?.message || errorFallback,
      }));
    }
  }, [enabled, errorFallback]);

  useEffect(() => {
    if (!enabled) {
      setState({ data: initialData, loading: false, error: '' });
      return undefined;
    }

    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: '' }));

    fetcherRef
      .current()
      .then(data => {
        if (!cancelled) setState({ data, loading: false, error: '' });
      })
      .catch(err => {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err?.message || errorFallback,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload };
}
