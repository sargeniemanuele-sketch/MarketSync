// Trasformazione sincrona pura: nessuna chiamata DB, nessun async, nessun side effect.
// Converte righe searchStream Google Ads grezze in una struttura interna stabile per il calcolo KPI.

const MICROS_DIVISOR = 1_000_000;

function parseDecimal(value) {
  if (value == null || value === '') return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalDecimal(value) {
  if (value == null || value === '') return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function parseCount(value) {
  if (value == null || value === '') return 0;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function parseMicrosToUnit(value) {
  return parseDecimal(value) / MICROS_DIVISOR;
}

function parseOptionalMicrosToUnit(value) {
  const decimal = parseOptionalDecimal(value);
  return decimal == null ? null : decimal / MICROS_DIVISOR;
}

function parseDateOnly(value) {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readMetric(metrics, camelKey, snakeKey) {
  if (!metrics || typeof metrics !== 'object') return null;
  if (metrics[camelKey] != null) return metrics[camelKey];
  if (metrics[snakeKey] != null) return metrics[snakeKey];
  return null;
}

function readSegmentDate(row) {
  if (!row || typeof row !== 'object') return null;

  const dateFromSegments = row?.segments?.date ?? row?.segments?.date_start ?? null;
  if (dateFromSegments) return dateFromSegments;

  // Fallback difensivo: alcuni adapter payload appiattiscono la data come date/date_start.
  if (row.date) return row.date;
  if (row.date_start) return row.date_start;

  return null;
}

function normalizeGoogleAdsRow(rawRow) {
  const metrics = rawRow?.metrics ?? {};

  return {
    date: parseDateOnly(readSegmentDate(rawRow)),
    // Le metriche costo Google Ads sono restituite in micros in GAQL (int64 micros).
    cost: parseMicrosToUnit(readMetric(metrics, 'costMicros', 'cost_micros')),
    impressions: parseCount(readMetric(metrics, 'impressions', 'impressions')),
    clicks: parseCount(readMetric(metrics, 'clicks', 'clicks')),
    ctr: parseOptionalDecimal(readMetric(metrics, 'ctr', 'ctr')),
    averageCpc: parseOptionalMicrosToUnit(readMetric(metrics, 'averageCpc', 'average_cpc')),
    averageCpm: parseOptionalMicrosToUnit(readMetric(metrics, 'averageCpm', 'average_cpm')),
    conversions: parseDecimal(readMetric(metrics, 'conversions', 'conversions')),
    costPerConversion: parseOptionalMicrosToUnit(
      readMetric(metrics, 'costPerConversion', 'cost_per_conversion')
    ),
    conversionsFromInteractionsRate: parseOptionalDecimal(
      readMetric(
        metrics,
        'conversionsFromInteractionsRate',
        'conversions_from_interactions_rate'
      )
    ),
    conversionsValue: parseDecimal(readMetric(metrics, 'conversionsValue', 'conversions_value')),
    allConversions: parseDecimal(readMetric(metrics, 'allConversions', 'all_conversions')),
    allConversionsValue: parseDecimal(
      readMetric(metrics, 'allConversionsValue', 'all_conversions_value')
    ),
    allConversionsFromInteractionsRate: parseOptionalDecimal(
      readMetric(
        metrics,
        'allConversionsFromInteractionsRate',
        'all_conversions_from_interactions_rate'
      )
    ),
  };
}

/**
 * Normalizza l'output fetch grezzo Google Ads per uso KPI interno.
 *
 * Ingresso (atteso):
 * {
 *   rows: [...righe searchStream Google Ads grezze...],
 *   meta: { fetchedAt, range, startDate, endDate, customerId, truncated, ... }
 * }
 *
 * Uscita:
 * {
 *   rows: [
 *     {
 *       date,
 *       cost,
 *       impressions,
 *       clicks,
 *       ctr,
 *       averageCpc,
 *       averageCpm,
 *       conversions,
 *       costPerConversion,
 *       conversionsFromInteractionsRate,
 *       conversionsValue,
 *       allConversions,
 *       allConversionsValue,
 *       allConversionsFromInteractionsRate,
 *     }
 *   ],
 *   meta: {
 *     rowCount,
 *     range,
 *     startDate,
 *     endDate,
 *     fetchedAt,
 *     truncated,
 *     customerId,
 *     source,
 *     provider,
 *     monetaryScale,
 *   }
 * }
 *
 * @param {object} rawFetchResult
 * @returns {{ rows: object[], meta: object }}
 */
export function normalizeGoogleAdsRows(rawFetchResult) {
  const rawRows = Array.isArray(rawFetchResult?.rows) ? rawFetchResult.rows : [];
  const rawMeta = rawFetchResult?.meta ?? {};

  const rows = rawRows.map(normalizeGoogleAdsRow);

  return {
    rows,
    meta: {
      rowCount: rows.length,
      range: rawMeta.range ?? null,
      startDate: rawMeta.startDate ?? null,
      endDate: rawMeta.endDate ?? null,
      fetchedAt: rawMeta.fetchedAt ?? null,
      truncated: rawMeta.truncated ?? false,
      customerId: rawMeta.customerId ?? null,
      source: rawMeta.source ?? null,
      provider: rawMeta.provider ?? 'google_ads',
      // Segnala che i campi legati al costo sono stati convertiti da micros a unità valuta.
      monetaryScale: 'currency_unit',
      rateScale: 'decimal_from_api',
    },
  };
}
