import { HTTP_STATUS } from '../config/app.constants.js';
import { AppError, BadRequestError } from './errors.js';
import { buildDailyDateKeys } from './sparkline.js';

export const METRIC_GRANULARITY_VALUES = Object.freeze([
  'auto',
  'hourly',
  'daily',
  'weekly',
  'monthly',
]);

export const INVALID_GRANULARITY_FOR_RANGE_MESSAGE =
  'La granularità oraria è disponibile solo per intervalli fino a 7 giorni.';

function normalizeGranularity(value = 'auto') {
  const granularity = typeof value === 'string' && value.trim()
    ? value.trim()
    : 'auto';

  if (!METRIC_GRANULARITY_VALUES.includes(granularity)) {
    throw new BadRequestError('Intervallo di tempo non valido.', { scope: 'metrics' });
  }

  return granularity;
}

export function countInclusiveMetricDays(startDate, endDate) {
  return buildDailyDateKeys(startDate, endDate).length;
}

export function assertHourlyGranularityAllowed(dayCount) {
  if (dayCount > 7) {
    throw new AppError(
      INVALID_GRANULARITY_FOR_RANGE_MESSAGE,
      HTTP_STATUS.UNPROCESSABLE,
      'INVALID_GRANULARITY_FOR_RANGE',
      { scope: 'metrics' }
    );
  }
}

function resolveAutoGranularity({ range, dayCount }) {
  if (range === 'today' || range === 'yesterday') return 'hourly';
  if (range === 'last_7_days' || range === 'last_14_days' || range === 'last_30_days') {
    return 'daily';
  }

  if (dayCount <= 2) return 'hourly';
  if (dayCount <= 31) return 'daily';
  if (dayCount <= 92) return 'weekly';
  return 'monthly';
}

export function resolveMetricGranularity({
  requestedGranularity = 'auto',
  range,
  startDate,
  endDate,
} = {}) {
  const requested = normalizeGranularity(requestedGranularity);
  const dayCount = countInclusiveMetricDays(startDate, endDate);

  if (!dayCount) {
    throw new BadRequestError('Intervallo di date non valido.', { scope: 'metrics' });
  }

  const granularity = requested === 'auto'
    ? resolveAutoGranularity({ range, dayCount })
    : requested;

  if (granularity === 'hourly') {
    assertHourlyGranularityAllowed(dayCount);
  }

  return {
    granularity,
    requestedGranularity: requested,
    dayCount,
  };
}
