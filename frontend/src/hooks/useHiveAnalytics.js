import { useEffect, useState } from 'react';
import {
  getHiveAnalyticsSummary,
  getHiveLatestReading,
  getHiveTemperatureSeries,
} from '../api';

export function useHiveAnalytics(hiveId, query, { enabled = true } = {}) {
  const queryKey = JSON.stringify(query ?? '1d');

  // Selected hive analytics state
  const [state, setState] = useState({
    summary: null,
    temperatureSeries: [],
    bucketSize: null,
    latestReading: null,
    loading: false,
    error: '',
  });

  // Reload when hive or query changes
  useEffect(() => {
    let cancelled = false;
    const id = Number(hiveId);

    if (!enabled || !Number.isInteger(id) || id <= 0) {
      setState({
        summary: null,
        temperatureSeries: [],
        bucketSize: null,
        latestReading: null,
        loading: false,
        error: '',
      });
      return () => { cancelled = true; };
    }

    async function load() {
      setState(prev => ({ ...prev, loading: true, error: '' }));
      try {
        const [summaryRes, temperatureRes, latestRes] = await Promise.all([
          getHiveAnalyticsSummary(id, query),
          getHiveTemperatureSeries(id, query),
          getHiveLatestReading(id),
        ]);

        if (!cancelled) {
          setState({
            summary: summaryRes?.summary ?? null,
            temperatureSeries: temperatureRes?.series ?? [],
            bucketSize: temperatureRes?.bucketSize ?? null,
            latestReading: latestRes?.reading ?? null,
            loading: false,
            error: '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            summary: null,
            temperatureSeries: [],
            bucketSize: null,
            latestReading: null,
            loading: false,
            error: err.message || 'Failed to load hive analytics',
          });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [enabled, hiveId, queryKey]);

  return state;
}
