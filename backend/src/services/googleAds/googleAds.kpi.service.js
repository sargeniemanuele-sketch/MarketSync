// Computazione KPI sincrona pura per Google Ads.
// L'ingresso è composto da righe normalizzate da googleAds.normalize.service.js.

import { compareNumericSummaries } from '../../utils/comparison.js';
import { GOOGLE_ADS_KPI_KEYS } from '../../contracts/metrics/googleAds.kpi.map.js';

export const GOOGLE_ADS_COMPARISON_KEYS = Object.freeze([
  GOOGLE_ADS_KPI_KEYS.cost,
  GOOGLE_ADS_KPI_KEYS.impressions,
  GOOGLE_ADS_KPI_KEYS.clicks,
  GOOGLE_ADS_KPI_KEYS.ctr,
  GOOGLE_ADS_KPI_KEYS.averageCpc,
  GOOGLE_ADS_KPI_KEYS.averageCpm,
  GOOGLE_ADS_KPI_KEYS.conversions,
  GOOGLE_ADS_KPI_KEYS.costPerConversion,
  GOOGLE_ADS_KPI_KEYS.conversionRate,
  GOOGLE_ADS_KPI_KEYS.conversionValue,
  GOOGLE_ADS_KPI_KEYS.roas,
  GOOGLE_ADS_KPI_KEYS.allConversions,
  GOOGLE_ADS_KPI_KEYS.allConversionValue,
  GOOGLE_ADS_KPI_KEYS.allConversionRate,
  GOOGLE_ADS_KPI_KEYS.allRoas,
]);

function round2(value) {
  return Math.round(value * 100) / 100;
}

function sumField(rows, accessor) {
  return rows.reduce((total, row) => total + accessor(row), 0);
}

function safeRate(numerator, denominator, multiplier = 1) {
  if (!denominator) return 0;
  return (numerator / denominator) * multiplier;
}

function safeNullableRate(numerator, denominator, multiplier = 1) {
  if (!denominator) return null;
  return (numerator / denominator) * multiplier;
}

function dateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function buildDailyBuckets(rows) {
  const buckets = new Map();

  for (const row of rows) {
    const date = dateKey(row.date);
    if (!date) continue;

    const bucket = buckets.get(date) ?? {
      date,
      cost: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversionsValue: 0,
      allConversions: 0,
      allConversionsValue: 0,
    };

    bucket.cost += row.cost ?? 0;
    bucket.impressions += row.impressions ?? 0;
    bucket.clicks += row.clicks ?? 0;
    bucket.conversions += row.conversions ?? 0;
    bucket.conversionsValue += row.conversionsValue ?? 0;
    bucket.allConversions += row.allConversions ?? 0;
    bucket.allConversionsValue += row.allConversionsValue ?? 0;

    buckets.set(date, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function point(date, value) {
  return {
    date,
    value: Number.isFinite(value) ? round2(value) : null,
  };
}

function buildGoogleAdsSeriesByMetricKey(rows) {
  const buckets = buildDailyBuckets(rows);

  return {
    [GOOGLE_ADS_KPI_KEYS.cost]: buckets.map((b) => point(b.date, b.cost)),
    [GOOGLE_ADS_KPI_KEYS.impressions]: buckets.map((b) => point(b.date, b.impressions)),
    [GOOGLE_ADS_KPI_KEYS.clicks]: buckets.map((b) => point(b.date, b.clicks)),
    [GOOGLE_ADS_KPI_KEYS.conversions]: buckets.map((b) => point(b.date, b.conversions)),
    [GOOGLE_ADS_KPI_KEYS.conversionValue]: buckets.map((b) =>
      point(b.date, b.conversionsValue)
    ),
    [GOOGLE_ADS_KPI_KEYS.roas]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.conversionsValue, b.cost))
    ),
    [GOOGLE_ADS_KPI_KEYS.costPerConversion]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.cost, b.conversions))
    ),
    [GOOGLE_ADS_KPI_KEYS.ctr]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.clicks, b.impressions, 100))
    ),
    [GOOGLE_ADS_KPI_KEYS.averageCpc]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.cost, b.clicks))
    ),
    [GOOGLE_ADS_KPI_KEYS.averageCpm]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.cost, b.impressions, 1000))
    ),
    [GOOGLE_ADS_KPI_KEYS.conversionRate]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.conversions, b.clicks, 100))
    ),
    [GOOGLE_ADS_KPI_KEYS.allConversions]: buckets.map((b) =>
      point(b.date, b.allConversions)
    ),
    [GOOGLE_ADS_KPI_KEYS.allConversionValue]: buckets.map((b) =>
      point(b.date, b.allConversionsValue)
    ),
    [GOOGLE_ADS_KPI_KEYS.allConversionRate]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.allConversions, b.clicks, 100))
    ),
    [GOOGLE_ADS_KPI_KEYS.allRoas]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.allConversionsValue, b.cost))
    ),
  };
}

function weightedAverage(rows, valueAccessor, weightAccessor) {
  let weightedTotal = 0;
  let weightTotal = 0;
  let fallbackTotal = 0;
  let fallbackCount = 0;

  for (const row of rows) {
    const value = valueAccessor(row);
    const weight = weightAccessor(row);

    if (!Number.isFinite(value)) {
      continue;
    }

    fallbackTotal += value;
    fallbackCount += 1;

    if (Number.isFinite(weight) && weight > 0) {
      weightedTotal += value * weight;
      weightTotal += weight;
    }
  }

  if (weightTotal) return weightedTotal / weightTotal;
  return fallbackCount ? fallbackTotal / fallbackCount : null;
}

function decimalRateToPercentage(value) {
  if (!Number.isFinite(value)) return null;
  return value * 100;
}

function normalizeKpiInput(normalizedResult) {
  if (Array.isArray(normalizedResult)) {
    return {
      rows: normalizedResult,
      meta: {
        rowCount: normalizedResult.length,
        range: null,
        startDate: null,
        endDate: null,
        fetchedAt: null,
        truncated: false,
        customerId: null,
        provider: 'google_ads',
        source: null,
        monetaryScale: null,
      },
    };
  }

  return {
    rows: Array.isArray(normalizedResult?.rows) ? normalizedResult.rows : [],
    meta: normalizedResult?.meta ?? {
      rowCount: 0,
      range: null,
      startDate: null,
      endDate: null,
      fetchedAt: null,
      truncated: false,
      customerId: null,
      provider: 'google_ads',
      source: null,
      monetaryScale: null,
    },
  };
}

/**
 * Calcola i KPI Google Ads da righe normalizzate.
 *
 * Formule:
 * - cost              = sum(cost)
 * - impressions       = sum(impressions)
 * - clicks            = sum(clicks)
 * - conversions       = sum(conversions)
 * - conversions_value = sum(conversionsValue)
 * - ctr               = metrics.ctr converted from decimal to percentage, fallback Clicks / Impressions * 100
 * - conversion_rate   = metrics.conversions_from_interactions_rate converted from decimal to percentage
 * - average_cpc       = metrics.average_cpc converted from micros, fallback Cost / Clicks
 * - average_cpm       = metrics.average_cpm converted from micros, fallback Cost / Impressions * 1000
 * - roas              = Conv. value / Cost, unavailable when Cost is 0
 * - cpa               = metrics.cost_per_conversion converted from micros, fallback Cost / Conversions
 * - all_roas          = All conv. value / Cost, unavailable when Cost is 0
 *
 * Guardia denominatore: se Cost e 0, ROAS e All ROAS non vengono esposti come disponibili.
 *
 * @param {object|object[]} normalizedResult
 * @returns {{ summary: object, meta: object }}
 */
export function computeGoogleAdsKpis(normalizedResult) {
  const { rows, meta } = normalizeKpiInput(normalizedResult);

  const cost = sumField(rows, (r) => r.cost ?? 0);
  const impressions = sumField(rows, (r) => r.impressions ?? 0);
  const clicks = sumField(rows, (r) => r.clicks ?? 0);
  const conversions = sumField(rows, (r) => r.conversions ?? 0);
  const conversionsValue = sumField(rows, (r) => r.conversionsValue ?? 0);
  const allConversions = sumField(rows, (r) => r.allConversions ?? 0);
  const allConversionsValue = sumField(rows, (r) => r.allConversionsValue ?? 0);

  const ctrFromApi = weightedAverage(
    rows,
    (r) => r.ctr ?? NaN,
    (r) => r.impressions ?? 0
  );
  const conversionRateFromApi = weightedAverage(
    rows,
    (r) => r.conversionsFromInteractionsRate ?? NaN,
    (r) => r.clicks ?? 0
  );
  const allConversionRateFromApi = weightedAverage(
    rows,
    (r) => r.allConversionsFromInteractionsRate ?? NaN,
    (r) => r.clicks ?? 0
  );
  const averageCpcFromApi = weightedAverage(
    rows,
    (r) => r.averageCpc ?? NaN,
    (r) => r.clicks ?? 0
  );
  const averageCpmFromApi = weightedAverage(
    rows,
    (r) => r.averageCpm ?? NaN,
    (r) => r.impressions ?? 0
  );
  const costPerConversionFromApi = weightedAverage(
    rows,
    (r) => r.costPerConversion ?? NaN,
    (r) => r.conversions ?? 0
  );

  const ctr = decimalRateToPercentage(ctrFromApi) ?? safeRate(clicks, impressions, 100);
  const conversionRate =
    decimalRateToPercentage(conversionRateFromApi) ?? safeRate(conversions, clicks, 100);
  const allConversionRate =
    decimalRateToPercentage(allConversionRateFromApi) ?? safeRate(allConversions, clicks, 100);
  const averageCpc = averageCpcFromApi ?? safeRate(cost, clicks);
  const averageCpm = averageCpmFromApi ?? safeRate(cost, impressions, 1000);
  const roas = safeNullableRate(conversionsValue, cost);
  const cpa = costPerConversionFromApi ?? safeRate(cost, conversions);
  const allRoas = safeNullableRate(allConversionsValue, cost);
  const allCpa = safeRate(cost, allConversions);

  const roundedCost = round2(cost);
  const roundedAverageCpm = round2(averageCpm);
  const roundedCpa = round2(cpa);
  const roundedRoas = roas == null ? null : round2(roas);
  const roundedAllRoas = allRoas == null ? null : round2(allRoas);
  const summary = {
    [GOOGLE_ADS_KPI_KEYS.cost]: roundedCost,
    [GOOGLE_ADS_KPI_KEYS.impressions]: impressions,
    [GOOGLE_ADS_KPI_KEYS.clicks]: clicks,
    [GOOGLE_ADS_KPI_KEYS.ctr]: round2(ctr),
    [GOOGLE_ADS_KPI_KEYS.averageCpc]: round2(averageCpc),
    [GOOGLE_ADS_KPI_KEYS.averageCpm]: roundedAverageCpm,
    [GOOGLE_ADS_KPI_KEYS.conversions]: round2(conversions),
    [GOOGLE_ADS_KPI_KEYS.costPerConversion]: roundedCpa,
    [GOOGLE_ADS_KPI_KEYS.conversionRate]: round2(conversionRate),
    [GOOGLE_ADS_KPI_KEYS.conversionValue]: round2(conversionsValue),
    [GOOGLE_ADS_KPI_KEYS.allConversions]: round2(allConversions),
    [GOOGLE_ADS_KPI_KEYS.allConversionValue]: round2(allConversionsValue),
    [GOOGLE_ADS_KPI_KEYS.allConversionRate]: round2(allConversionRate),
    // Alias legacy per custom metrics/cache esistenti. Le card UI usano solo key google_*.
    cost: roundedCost,
    google_spend: roundedCost,
    impressions,
    clicks,
    ctr: round2(ctr),
    conversion_rate: round2(conversionRate),
    average_cpc: round2(averageCpc),
    average_cpm: roundedAverageCpm,
    cpm: roundedAverageCpm,
    conversions: round2(conversions),
    conversions_value: round2(conversionsValue),
    cpa: roundedCpa,
    all_conversions: round2(allConversions),
    all_conversion_value: round2(allConversionsValue),
    all_conversion_rate: round2(allConversionRate),
    all_cpa: round2(allCpa),
  };

  if (roundedRoas != null) {
    summary[GOOGLE_ADS_KPI_KEYS.roas] = roundedRoas;
    summary.roas = roundedRoas;
  }

  if (roundedAllRoas != null) {
    summary[GOOGLE_ADS_KPI_KEYS.allRoas] = roundedAllRoas;
    summary.all_roas = roundedAllRoas;
  }

  return {
    summary,
    meta: {
      rowCount: rows.length,
      range: meta.range ?? null,
      startDate: meta.startDate ?? null,
      endDate: meta.endDate ?? null,
      fetchedAt: meta.fetchedAt ?? null,
      truncated: Boolean(meta.truncated),
      provider: meta.provider ?? 'google_ads',
      source: meta.source ?? null,
      monetaryScale: meta.monetaryScale ?? null,
      rateScale: 'percentage_points',
    },
    seriesByMetricKey: buildGoogleAdsSeriesByMetricKey(rows),
  };
}

export function compareGoogleAdsKpis(currentSummary, previousSummary) {
  return compareNumericSummaries(
    currentSummary,
    previousSummary,
    GOOGLE_ADS_COMPARISON_KEYS
  );
}
