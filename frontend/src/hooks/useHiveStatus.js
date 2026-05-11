import { useCallback, useEffect, useState } from 'react';
import { getHiveStatus } from '../api';

export function useHiveStatus(query, { enabled = true } = {}) {
  const queryKey = JSON.stringify(query ?? '1d');
  const currentRange = getQueryRange(query);

  // Shared status state
  const [state, setState] = useState({
    hives: [],
    range: currentRange,
    bucketSize: null,
    startAt: null,
    endAt: null,
    loading: enabled,
    error: '',
  });

  // Manual reload for retry actions
  const load = useCallback(async () => {
    if (!enabled) {
      setState({ hives: [], range: currentRange, bucketSize: null, startAt: null, endAt: null, loading: false, error: '' });
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
        // Reload when the query changes
        range: currentRange,
        bucketSize: null,
        startAt: null,
        endAt: null,
        loading: false,
        error: err.message || 'Failed to load hive status',
      });
    }
  }, [enabled, queryKey, currentRange]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!enabled) {
        if (!cancelled) setState({ hives: [], range: currentRange, bucketSize: null, startAt: null, endAt: null, loading: false, error: '' });
        return;
      }

      setState(prev => ({ ...prev, loading: true, error: '' }));
      try {
        const data = await getHiveStatus(query);
        if (!cancelled) {
          setState({
            hives: data?.hives ?? [],
            range: data?.range ?? currentRange,
            bucketSize: data?.bucketSize ?? null,
            startAt: data?.startAt ?? null,
            endAt: data?.endAt ?? null,
            loading: false,
            error: '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            hives: [],
            range: currentRange,
            bucketSize: null,
            startAt: null,
            endAt: null,
            loading: false,
            error: err.message || 'Failed to load hive status',
          });
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [enabled, queryKey, currentRange]);

  return {
    ...state,
    refresh: load,
  };
}

function getQueryRange(query) {
  if (typeof query === 'string') return query;
  return query?.range ?? 'custom';
}
