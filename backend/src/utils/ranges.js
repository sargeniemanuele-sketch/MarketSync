import { BadRequestError } from './errors.js';
import { TIMEZONE_DEFAULT } from '../config/app.constants.js';

export const APP_TIMEZONE = TIMEZONE_DEFAULT;

export const METRIC_RANGE_VALUES = Object.freeze([
  'today',
  'yesterday',
  'last_7_days',
  'last_14_days',
  'last_30_days',
  'custom',
]);

const ROLLING_RANGE_DAYS = Object.freeze({
  last_7_days: 7,
  last_14_days: 14,
  last_30_days: 30,
});

const appDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function getAppDateTimeParts(date) {
  const parts = Object.fromEntries(
    appDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function getAppTimezoneOffsetMs(date) {
  const parts = getAppDateTimeParts(date);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds()
  );

  return localAsUtc - date.getTime();
}

function appDateTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0 }) {
  const utcGuessMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const firstOffset = getAppTimezoneOffsetMs(new Date(utcGuessMs));
  let utcDate = new Date(utcGuessMs - firstOffset);
  const secondOffset = getAppTimezoneOffsetMs(utcDate);

  if (secondOffset !== firstOffset) {
    utcDate = new Date(utcGuessMs - secondOffset);
  }

  return utcDate;
}

function toAppDateParts(value) {
  return getAppDateTimeParts(value);
}

function appDatePartsFromUtcDate(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addAppDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0, 0));
  return appDatePartsFromUtcDate(date);
}

function startOfAppDay(parts) {
  return appDateTimeToUtc({ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 });
}

function endOfAppDay(parts) {
  return appDateTimeToUtc({ ...parts, hour: 23, minute: 59, second: 59, millisecond: 999 });
}

function appDateSerial(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function inclusiveAppDayCount(startParts, endParts) {
  return Math.round((appDateSerial(endParts) - appDateSerial(startParts)) / 86400000) + 1;
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatAppDateParts(parts) {
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

export function toAppDateString(value) {
  const date = normalizeResolvedDate(value, 'date');
  return formatAppDateParts(toAppDateParts(date));
}

export function buildMetricsPeriodMeta({ range, startDate, endDate, comparison = null }) {
  const periodMeta = {
    range: range ?? null,
    startDate: toAppDateString(startDate),
    endDate: toAppDateString(endDate),
    timezone: APP_TIMEZONE,
  };

  if (comparison) {
    periodMeta.comparison = {
      startDate: toAppDateString(comparison.startDate),
      endDate: toAppDateString(comparison.endDate),
    };
  }

  return periodMeta;
}

function parseInputDate(value, fieldName) {
  if (!value) {
    throw new BadRequestError('Seleziona una data valida.', { scope: 'metrics' });
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`, { scope: 'metrics' });
  }

  return date;
}

function normalizeResolvedDate(value, fieldName) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`, { scope: 'metrics' });
  }
  return date;
}

export function resolvePreviousRangeLabel(range) {
  if (range === 'today') return 'yesterday';
  return 'custom';
}

/**
 * Risolve le date UTC canoniche di inizio/fine per i range metriche.
 *
 * Range supportati:
 * - today
 * - yesterday
 * - last_7_days
 * - last_14_days
 * - last_30_days
 * - custom (richiede startDate/endDate)
 *
 * @param {object} params
 * @param {string} params.range
 * @param {Date|string} [params.startDate]
 * @param {Date|string} [params.endDate]
 * @param {Date} [params.now]
 * @returns {{ startDate: Date, endDate: Date }}
 */
export function resolveMetricsRange({ range, startDate, endDate, now = new Date() }) {
  const todayParts = toAppDateParts(now);

  if (range === 'today') {
    return { startDate: startOfAppDay(todayParts), endDate: endOfAppDay(todayParts) };
  }

  if (range === 'yesterday') {
    const yesterdayParts = addAppDays(todayParts, -1);
    return { startDate: startOfAppDay(yesterdayParts), endDate: endOfAppDay(yesterdayParts) };
  }

  if (Object.prototype.hasOwnProperty.call(ROLLING_RANGE_DAYS, range)) {
    const days = ROLLING_RANGE_DAYS[range];
    const startParts = addAppDays(todayParts, -days);
    const endParts = addAppDays(todayParts, -1);
    return { startDate: startOfAppDay(startParts), endDate: endOfAppDay(endParts) };
  }

  if (range === 'custom') {
    const customStart = startOfAppDay(toAppDateParts(parseInputDate(startDate, 'startDate')));
    const customEnd = endOfAppDay(toAppDateParts(parseInputDate(endDate, 'endDate')));

    if (customStart > customEnd) {
      throw new BadRequestError('La data di inizio deve essere precedente o uguale alla data di fine.', { scope: 'metrics' });
    }

    return { startDate: customStart, endDate: customEnd };
  }

  throw new BadRequestError('Periodo selezionato non valido.', { scope: 'metrics' });
}

/**
 * Risolve il periodo immediatamente precedente con la stessa durata inclusiva
 * del periodo corrente.
 *
 * @param {object} params
 * @param {Date|string} params.startDate
 * @param {Date|string} params.endDate
 * @returns {{ startDate: Date, endDate: Date }}
 */
export function resolvePreviousMetricsRange({ startDate, endDate }) {
  const currentStart = normalizeResolvedDate(startDate, 'startDate');
  const currentEnd = normalizeResolvedDate(endDate, 'endDate');

  if (currentStart > currentEnd) {
    throw new BadRequestError('La data di inizio deve essere precedente o uguale alla data di fine.', { scope: 'metrics' });
  }

  const currentStartParts = toAppDateParts(currentStart);
  const currentEndParts = toAppDateParts(currentEnd);
  const dayCount = inclusiveAppDayCount(currentStartParts, currentEndParts);
  const previousEndParts = addAppDays(currentStartParts, -1);
  const previousStartParts = addAppDays(currentStartParts, -dayCount);

  return {
    startDate: startOfAppDay(previousStartParts),
    endDate: endOfAppDay(previousEndParts),
  };
}

/**
 * Risolve sia il range metriche corrente normalizzato sia il suo periodo
 * precedente di confronto.
 *
 * @param {object} params
 * @param {string} params.range
 * @param {Date|string} [params.startDate]
 * @param {Date|string} [params.endDate]
 * @param {Date} [params.now]
 * @returns {{
 *   current: { range: string, startDate: Date, endDate: Date },
 *   previous: { range: string, startDate: Date, endDate: Date }
 * }}
 */
export function resolveMetricsComparisonRange(params) {
  const current = resolveMetricsRange(params);
  const previous = resolvePreviousMetricsRange(current);

  return {
    current: {
      range: params.range,
      ...current,
    },
    previous: {
      range: resolvePreviousRangeLabel(params.range),
      ...previous,
    },
  };
}
