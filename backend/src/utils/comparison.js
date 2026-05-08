function round2(value) {
  return Math.round(value * 100) / 100;
}

function toFiniteNumber(value) {
  if (typeof value !== 'number') return null;
  return Number.isFinite(value) ? value : null;
}

export function calculateDelta(currentValue, previousValue) {
  return round2(currentValue - previousValue);
}

export function calculateDeltaPercentage(currentValue, previousValue) {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : null;
  }

  return round2(((currentValue - previousValue) / previousValue) * 100);
}

export function calculateTrend(delta) {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

export function compareMetricValues(currentValue, previousValue) {
  const delta = calculateDelta(currentValue, previousValue);

  return {
    currentValue,
    previousValue,
    delta,
    deltaPercentage: calculateDeltaPercentage(currentValue, previousValue),
    trend: calculateTrend(delta),
  };
}

export function compareNumericSummaries(currentSummary = {}, previousSummary = {}, metricKeys = []) {
  const comparison = {};

  for (const key of metricKeys) {
    const currentValue = toFiniteNumber(currentSummary?.[key]);
    const previousValue = toFiniteNumber(previousSummary?.[key]);

    if (currentValue == null || previousValue == null) {
      continue;
    }

    comparison[key] = compareMetricValues(currentValue, previousValue);
  }

  return comparison;
}
