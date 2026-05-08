const numberFormatter = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 1,
  notation: "compact",
});

export function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numberFormatter.format(numericValue) : String(value);
}

export function formatCompactNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? compactNumberFormatter.format(numericValue) : String(value);
}

export function formatCurrency(value, currency = "EUR") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("it-IT", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(numericValue);
}

export function formatPercentage(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return `${numberFormatter.format(numericValue)}%`;
}

export function formatMetricValue({ currency, formattedValue, unit, value } = {}) {
  if (formattedValue !== null && formattedValue !== undefined && formattedValue !== "") {
    return formattedValue;
  }

  if (unit === "currency" || currency) {
    return formatCurrency(value, currency || "EUR");
  }

  if (unit === "percentage") {
    return formatPercentage(value);
  }

  if (unit === "count" || unit === "number" || unit === "ratio") {
    return formatNumber(value);
  }

  const formatted = formatNumber(value);
  return unit && formatted !== "-" ? `${formatted} ${unit}` : formatted;
}

export function formatSignedNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  const sign = numericValue > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(numericValue)}`;
}

export function formatDateTime(value) {
  if (!value) {
    return "Mai";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatBytes(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  if (numericValue < 1024) {
    return `${numberFormatter.format(numericValue)} B`;
  }

  if (numericValue < 1024 * 1024) {
    return `${numberFormatter.format(numericValue / 1024)} KB`;
  }

  return `${numberFormatter.format(numericValue / 1024 / 1024)} MB`;
}
