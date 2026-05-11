import { useState } from 'react';

export const ANALYTICS_RANGE_OPTIONS = [
  { value: '1d', label: '1D' },
  { value: '3d', label: '3D' },
  { value: '7d', label: '7D' },
  { value: '1m', label: '1M' },
];

export function isAnalyticsRange(value) {
  return ANALYTICS_RANGE_OPTIONS.some(option => option.value === value);
}

export function useAnalyticsRange(initialRange = '1d') {
  const [range, setRangeState] = useState(
    isAnalyticsRange(initialRange) ? initialRange : '1d',
  );

  const setRange = (nextRange) => {
    if (isAnalyticsRange(nextRange)) setRangeState(nextRange);
  };

  return {
    range,
    setRange,
    options: ANALYTICS_RANGE_OPTIONS,
  };
}
