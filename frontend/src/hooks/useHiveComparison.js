import { useEffect, useMemo, useState } from 'react';
import { getHiveComparison } from '../api';

export function useHiveComparison(hiveIds, query, { enabled = true } = {}) {
  const queryKey = JSON.stringify(query ?? '1d');
  const hasLocationFilter =
    query != null &&
    typeof query === 'object' &&
    query.locationId != null &&
    String(query.locationId).trim() !== '';

  // Normalize compare IDs
  const ids = useMemo(
    () => Array.from(new Set((hiveIds || [])
      .map(Number)
      .filter(id => Number.isInteger(id) && id > 0)))
      .slice(0, 10),
    [hiveIds],
  );

  // Comparison request state
  const [state, setState] = useState({
    comparison: null,
    loading: false,
    error: '',
  });

  // Reload comparison data
  useEffect(() => {
    let cancelled = false;

    if (!enabled || (!hasLocationFilter && ids.length === 0)) {
      setState({ comparison: null, loading: false, error: '' });
      return () => { cancelled = true; };
    }

    async function load() {
      setState(prev => ({ ...prev, loading: true, error: '' }));
      try {
        const comparison = await getHiveComparison(ids, query);
        if (!cancelled) setState({ comparison, loading: false, error: '' });
      } catch (err) {
        if (!cancelled) {
          setState({
            comparison: null,
            loading: false,
            error: err.message || 'Failed to load comparison data',
          });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [enabled, hasLocationFilter, ids, queryKey]);

  return state;
}
