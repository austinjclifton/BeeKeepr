import { useEffect, useState } from 'react';
import {
  ANALYTICS_RANGE_KEY,
  LEGACY_ANALYTICS_RANGE_KEY,
  readMigratedFlag,
  writeFlag,
} from '../storageKeys';

export const ANALYTICS_RANGE_OPTIONS = [
  { value: '1d', label: '1D' },
  { value: '3d', label: '3D' },
  { value: '7d', label: '7D' },
  { value: '1m', label: '1M' },
];

export function isAnalyticsRange(value) {
  return ANALYTICS_RANGE_OPTIONS.some(option => option.value === value);
}

function loadInitialRange(initialRange) {
  const fallback = isAnalyticsRange(initialRange) ? initialRange : '1d';
  const storedRange = readMigratedFlag(
    ANALYTICS_RANGE_KEY,
    LEGACY_ANALYTICS_RANGE_KEY,
  );

  return isAnalyticsRange(storedRange) ? storedRange : fallback;
}

export function useAnalyticsRange(initialRange = '1d') {
  const [range, setRangeState] = useState(() => loadInitialRange(initialRange));

  useEffect(() => {
    if (isAnalyticsRange(range)) {
      writeFlag(ANALYTICS_RANGE_KEY, range);
    }
  }, [range]);

  const setRange = (nextRange) => {
    if (isAnalyticsRange(nextRange)) setRangeState(nextRange);
  };

  return {
    range,
    setRange,
    options: ANALYTICS_RANGE_OPTIONS,
  };
}
