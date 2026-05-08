export const DATE_RANGE_OPTIONS = [
  { key: "today", label: "Oggi" },
  { key: "yesterday", label: "Ieri" },
  { key: "last_7_days", label: "Ultimi 7 giorni" },
  { key: "last_14_days", label: "Ultimi 14 giorni" },
  { key: "last_30_days", label: "Ultimi 30 giorni" },
  { key: "custom", label: "Personalizzato" },
];

export const DATE_RANGES = DATE_RANGE_OPTIONS;

export const APP_TIMEZONE = "Europe/Rome";
export const DEFAULT_RANGE = "last_30_days";

const VALID_RANGE_KEYS = new Set(DATE_RANGE_OPTIONS.map((range) => range.key));
const ROLLING_RANGE_DAYS = {
  last_7_days: 7,
  last_14_days: 14,
  last_30_days: 30,
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const appDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: APP_TIMEZONE,
  year: "numeric",
});

export function getRangeLabel(rangeKey) {
  return DATE_RANGE_OPTIONS.find((range) => range.key === normalizeRangeKey(rangeKey))?.label || "Periodo";
}

export function normalizeRangeKey(rangeKey, fallback = DEFAULT_RANGE) {
  if (rangeKey === "this_month") {
    return fallback;
  }

  return VALID_RANGE_KEYS.has(rangeKey) ? rangeKey : fallback;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toIsoDateFromParts(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function parseIsoDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    appDatePartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function addDays(isoDate, days) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return null;

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0, 0));

  return toIsoDateFromParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function todayIsoInAppTimezone(now = new Date()) {
  return toIsoDateFromParts(parseIsoDate(now));
}

function toDisplayDate(isoDate, formatter = dateFormatter) {
  const parts = parseIsoDate(isoDate);
  if (!parts) return null;

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0));
  return formatter.format(date).replace(/\.$/, "");
}

function compactRangeLabel(startDate, endDate) {
  if (!startDate || !endDate) return null;
  if (startDate === endDate) return toDisplayDate(startDate);

  const startParts = parseIsoDate(startDate);
  const endParts = parseIsoDate(endDate);
  if (!startParts || !endParts) return null;

  const startFormatter = startParts.year === endParts.year ? shortDateFormatter : dateFormatter;
  return `${toDisplayDate(startDate, startFormatter)} - ${toDisplayDate(endDate)}`;
}

export function resolveFallbackPeriod({ range, startDate, endDate, now = new Date() } = {}) {
  const normalizedRange = normalizeRangeKey(range);

  if (normalizedRange === "custom") {
    if (!startDate || !endDate) return null;
    return { range: normalizedRange, startDate, endDate, timezone: APP_TIMEZONE };
  }

  const today = todayIsoInAppTimezone(now);

  if (normalizedRange === "today") {
    return { range: normalizedRange, startDate: today, endDate: today, timezone: APP_TIMEZONE };
  }

  if (normalizedRange === "yesterday") {
    const yesterday = addDays(today, -1);
    return { range: normalizedRange, startDate: yesterday, endDate: yesterday, timezone: APP_TIMEZONE };
  }

  const days = ROLLING_RANGE_DAYS[normalizedRange];
  if (days) {
    return {
      range: normalizedRange,
      startDate: addDays(today, -days),
      endDate: addDays(today, -1),
      timezone: APP_TIMEZONE,
    };
  }

  return null;
}

export function resolveEffectivePeriod(meta, fallback) {
  if (meta?.startDate && meta?.endDate) {
    const startParts = parseIsoDate(meta.startDate);
    const endParts = parseIsoDate(meta.endDate);

    return {
      range: normalizeRangeKey(meta.range ?? fallback?.range),
      startDate: startParts ? toIsoDateFromParts(startParts) : String(meta.startDate).slice(0, 10),
      endDate: endParts ? toIsoDateFromParts(endParts) : String(meta.endDate).slice(0, 10),
      timezone: meta.timezone ?? APP_TIMEZONE,
    };
  }

  return fallback ?? null;
}

export function formatPeriodPill(period) {
  return compactRangeLabel(period?.startDate, period?.endDate);
}

export function formatSelectedPeriod(period) {
  const label = compactRangeLabel(period?.startDate, period?.endDate);
  if (!label) return "Periodo selezionato: in attesa dei dati";

  if (period?.range === "today") {
    return `Oggi: ${label}`;
  }

  if (period?.range === "yesterday") {
    return `Ieri: ${label}`;
  }

  return `Periodo selezionato: ${label}`;
}
