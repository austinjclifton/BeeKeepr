export function parseChartTime(value) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function sortPointsByBucketAt(points = []) {
  return (points ?? [])
    .map((point, index) => ({
      point,
      index,
      bucketTime: parseChartTime(point?.bucketAt),
    }))
    .filter(({ bucketTime }) => bucketTime != null)
    .sort((left, right) => left.bucketTime - right.bucketTime || left.index - right.index)
    .map(({ point }) => point);
}

export function smoothSeries(values, { windowSize = 3, preserveSpikeThreshold = 3 } = {}) {
  const numbers = (values ?? []).map(nullableNumber);
  const size = normalizeWindowSize(windowSize);
  const halfWindow = Math.floor(size / 2);

  return numbers.map((value, index) => {
    if (value == null) return null;

    const start = Math.max(0, index - halfWindow);
    const end = Math.min(numbers.length - 1, index + halfWindow);
    const windowValues = numbers.slice(start, end + 1).filter(item => item != null);
    if (windowValues.length < 2) return value;

    const average = windowValues.reduce((sum, item) => sum + item, 0) / windowValues.length;
    if (
      Number.isFinite(preserveSpikeThreshold) &&
      Math.abs(value - average) >= preserveSpikeThreshold
    ) {
      return value;
    }

    return Number(average.toFixed(2));
  });
}

function normalizeWindowSize(value) {
  const size = Math.max(1, Math.floor(Number(value) || 1));
  return size % 2 === 0 ? size + 1 : size;
}

function nullableNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
