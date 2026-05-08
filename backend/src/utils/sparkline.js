import { CURRENCY_DEFAULT, LOCALE_DEFAULT } from '../config/app.constants.js';
import { toAppDateString } from './ranges.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const labelFormatter = new Intl.DateTimeFormat(LOCALE_DEFAULT, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function toFiniteNumber(value) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeDateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return toAppDateString(date);
  } catch {
    return null;
  }
}

function readPointDate(point) {
  return point?.date ?? point?.timestamp ?? point?.createdAt ?? point?.dateStart ?? null;
}

function readPointValue(point) {
  if (typeof point === 'number') return point;
  return point?.value ?? point?.y ?? point?.total ?? null;
}

function formatCurrency(value, currency) {
  try {
    return new Intl.NumberFormat(LOCALE_DEFAULT, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat(LOCALE_DEFAULT, {
      style: 'currency',
      currency: CURRENCY_DEFAULT,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

function formatSparklineValue(value, unit, currency) {
  if (unit === 'currency') return formatCurrency(value, currency);
  if (unit === 'percentage') return `${value.toFixed(2)}%`;
  if (unit === 'ratio') return value.toFixed(2);

  return new Intl.NumberFormat(LOCALE_DEFAULT, {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSparklineLabel(date, granularity = 'daily') {
  if (granularity !== 'daily') return String(date ?? '');

  const dateKey = normalizeDateKey(date);
  if (!dateKey) return String(date ?? '');

  return labelFormatter.format(new Date(`${dateKey}T12:00:00.000Z`));
}

export function normalizeSparklinePoints(points) {
  const sourcePoints = Array.isArray(points)
    ? points
    : Array.isArray(points?.points)
      ? points.points
      : [];

  return sourcePoints
    .map((point, index) => {
      const value = toFiniteNumber(readPointValue(point));
      if (value == null) return null;

      const date = normalizeDateKey(readPointDate(point));
      if (!date) return null;

      return {
        date,
        index,
        label: point?.label ?? formatSparklineLabel(date),
        value,
        formattedValue:
          typeof point?.formattedValue === 'string' && point.formattedValue
            ? point.formattedValue
            : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.date === b.date) return a.index - b.index;
      return a.date < b.date ? -1 : 1;
    })
    .map(({ index, ...point }) => point);
}

export function buildSparkline(points, options = {}) {
  const granularity = options.granularity ?? 'daily';
  const currency = options.currency ?? CURRENCY_DEFAULT;
  const unit = options.unit ?? null;
  const normalizedPoints = normalizeSparklinePoints(points);

  if (normalizedPoints.length < 2) return null;

  return {
    granularity,
    points: normalizedPoints.map((point) => ({
      date: point.date,
      label: point.label ?? formatSparklineLabel(point.date, granularity),
      value: point.value,
      formattedValue: point.formattedValue ?? formatSparklineValue(point.value, unit, currency),
    })),
  };
}

export function maybeBuildSparkline(series, unit, options = {}) {
  return buildSparkline(series, {
    ...options,
    unit,
  });
}

export function buildDailyDateKeys(startDate, endDate) {
  const start = normalizeDateKey(startDate);
  const end = normalizeDateKey(endDate);
  if (!start || !end || start > end) return [];

  const keys = [];
  let current = new Date(`${start}T12:00:00.000Z`);
  const last = new Date(`${end}T12:00:00.000Z`);

  while (current <= last) {
    keys.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + DAY_MS);
  }

  return keys;
}
