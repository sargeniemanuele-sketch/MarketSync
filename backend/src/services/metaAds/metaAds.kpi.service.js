// Computazione KPI sincrona pura per Meta Ads.
// L'input deve essere composto da righe normalizzate da metaAds.normalize.service.js.

import { META_ADS_KPI_KEYS } from '../../contracts/metrics/metaAds.kpi.map.js';
import { compareNumericSummaries } from '../../utils/comparison.js';

export const META_ADS_COMPARISON_KEYS = Object.freeze([
  ...Object.values(META_ADS_KPI_KEYS),
  'spend',
  'meta_spend',
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'link_clicks',
  'outbound_clicks',
  'ctr',
  'cpc',
  'cpm',
  'purchases',
  'meta_purchases',
  'purchase_value',
  'meta_conversion_value',
  'conversion_value',
  'roas',
  'cpa',
  'cpoc',
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
    const date = dateKey(row.dateStart ?? row.dateStop);
    if (!date) continue;

    const bucket = buckets.get(date) ?? {
      date,
      spend: 0,
      impressions: 0,
      clicks: 0,
      linkClicks: 0,
      outboundClicks: 0,
      purchases: 0,
      purchaseValue: 0,
    };

    bucket.spend += row.spend ?? 0;
    bucket.impressions += row.impressions ?? 0;
    bucket.clicks += row.clicks ?? 0;
    bucket.linkClicks += row.linkClicks ?? 0;
    bucket.outboundClicks += row.outboundClicks ?? 0;
    bucket.purchases += row.purchases ?? 0;
    bucket.purchaseValue += row.purchaseValue ?? 0;

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

function buildMetaAdsSeriesByMetricKey(rows) {
  const buckets = buildDailyBuckets(rows);

  return {
    [META_ADS_KPI_KEYS.amountSpent]: buckets.map((b) => point(b.date, b.spend)),
    [META_ADS_KPI_KEYS.impressions]: buckets.map((b) => point(b.date, b.impressions)),
    [META_ADS_KPI_KEYS.clicks]: buckets.map((b) => point(b.date, b.clicks)),
    [META_ADS_KPI_KEYS.linkClicks]: buckets.map((b) => point(b.date, b.linkClicks)),
    [META_ADS_KPI_KEYS.outboundClicks]: buckets.map((b) => point(b.date, b.outboundClicks)),
    [META_ADS_KPI_KEYS.purchases]: buckets.map((b) => point(b.date, b.purchases)),
    [META_ADS_KPI_KEYS.purchaseConversionValue]: buckets.map((b) => point(b.date, b.purchaseValue)),
    [META_ADS_KPI_KEYS.purchaseRoas]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.purchaseValue, b.spend))
    ),
    [META_ADS_KPI_KEYS.costPerPurchase]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.spend, b.purchases))
    ),
    [META_ADS_KPI_KEYS.cpc]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.spend, b.clicks))
    ),
    [META_ADS_KPI_KEYS.cpm]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.spend, b.impressions, 1000))
    ),
    [META_ADS_KPI_KEYS.ctr]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.clicks, b.impressions, 100))
    ),
    [META_ADS_KPI_KEYS.costPerOutboundClick]: buckets.map((b) =>
      point(b.date, safeNullableRate(b.spend, b.outboundClicks))
    ),
  };
}

function weightedAverage(rows, valueAccessor, weightAccessor) {
  const weighted = rows.reduce(
    (acc, row) => {
      const value = valueAccessor(row);
      const weight = weightAccessor(row);

      if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) {
        return acc;
      }

      return {
        total: acc.total + value * weight,
        weight: acc.weight + weight,
      };
    },
    { total: 0, weight: 0 }
  );

  return weighted.weight > 0 ? weighted.total / weighted.weight : null;
}

function preferDirectWeighted(rows, valueAccessor, weightAccessor, fallback) {
  const directValue = weightedAverage(rows, valueAccessor, weightAccessor);
  return directValue == null ? fallback : directValue;
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
        usedActionMapping: {
          purchases: [],
          purchase_value: [],
          purchase_roas: [],
          cost_per_purchase: [],
          link_clicks: [],
          outbound_clicks: [],
          cost_per_outbound_click: [],
        },
        missingActionKeys: {
          purchases: [],
          purchase_value: [],
          link_clicks: [],
          outbound_clicks: [],
        },
        missingActionRows: {
          purchases: 0,
          purchase_value: 0,
          purchase_roas: 0,
          cost_per_purchase: 0,
          link_clicks: 0,
          outbound_clicks: 0,
          cost_per_outbound_click: 0,
        },
        hasPartialAttributionData: false,
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
      usedActionMapping: {
        purchases: [],
        purchase_value: [],
        purchase_roas: [],
        cost_per_purchase: [],
        link_clicks: [],
        outbound_clicks: [],
        cost_per_outbound_click: [],
      },
      missingActionKeys: {
        purchases: [],
        purchase_value: [],
        link_clicks: [],
        outbound_clicks: [],
      },
      missingActionRows: {
        purchases: 0,
        purchase_value: 0,
        purchase_roas: 0,
        cost_per_purchase: 0,
        link_clicks: 0,
        outbound_clicks: 0,
        cost_per_outbound_click: 0,
      },
      hasPartialAttributionData: false,
    },
  };
}

/**
 * Calcola i KPI principali Meta Ads da righe normalizzate.
 *
 * Formule:
 * - Amount spent = sum(spend)
 * - Impressions = sum(impressions)
 * - Reach = sum(reach)
 * - Frequency = weighted Meta frequency, fallback impressions / reach
 * - Clicks = sum(clicks)
 * - Link clicks = sum(linkClicks)
 * - Outbound clicks = sum(outboundClicks)
 * - CTR = weighted Meta ctr, fallback clicks / impressions x 100
 * - CPC = weighted Meta cpc, fallback spend / clicks
 * - CPM = weighted Meta cpm, fallback spend / impressions x 1000
 * - Purchases = sum(purchases)
 * - Cost per purchase = weighted cost_per_action_type, fallback spend / purchases
 * - Purchase conversion value = sum(purchaseValue)
 * - Purchase ROAS = weighted purchase_roas, fallback purchaseValue / spend
 * - Cost per outbound click = weighted cost_per_outbound_click, fallback spend / outboundClicks
 *
 * Guardia denominatore: se il denominatore è 0, il KPI derivato è 0.
 *
 * @param {object|object[]} normalizedResult
 * @returns {{ summary: object, meta: object }}
 */
export function computeMetaAdsKpis(normalizedResult) {
  const { rows, meta } = normalizeKpiInput(normalizedResult);

  const amountSpent = sumField(rows, (r) => r.spend ?? 0);
  const impressions = sumField(rows, (r) => r.impressions ?? 0);
  const reach = sumField(rows, (r) => r.reach ?? 0);
  const clicks = sumField(rows, (r) => r.clicks ?? 0);
  const linkClicks = sumField(rows, (r) => r.linkClicks ?? 0);
  const outboundClicks = sumField(rows, (r) => r.outboundClicks ?? 0);
  const purchases = sumField(rows, (r) => r.purchases ?? 0);
  const purchaseConversionValue = sumField(rows, (r) => r.purchaseValue ?? 0);

  const frequency = preferDirectWeighted(
    rows,
    (r) => r.frequency,
    (r) => r.reach ?? 0,
    safeRate(impressions, reach)
  );
  const ctr = preferDirectWeighted(
    rows,
    (r) => r.ctr,
    (r) => r.impressions ?? 0,
    safeRate(clicks, impressions, 100)
  );
  const cpc = preferDirectWeighted(
    rows,
    (r) => r.cpc,
    (r) => r.clicks ?? 0,
    safeRate(amountSpent, clicks)
  );
  const cpm = preferDirectWeighted(
    rows,
    (r) => r.cpm,
    (r) => r.impressions ?? 0,
    safeRate(amountSpent, impressions, 1000)
  );
  const costPerPurchase = preferDirectWeighted(
    rows,
    (r) => r.costPerPurchase,
    (r) => r.purchases ?? 0,
    safeRate(amountSpent, purchases)
  );
  const purchaseRoas = preferDirectWeighted(
    rows,
    (r) => r.purchaseRoas,
    (r) => r.spend ?? 0,
    safeRate(purchaseConversionValue, amountSpent)
  );
  const costPerOutboundClick = preferDirectWeighted(
    rows,
    (r) => r.costPerOutboundClick,
    (r) => r.outboundClicks ?? 0,
    safeRate(amountSpent, outboundClicks)
  );

  const roundedAmountSpent = round2(amountSpent);
  const roundedPurchaseConversionValue = round2(purchaseConversionValue);
  const roundedCostPerPurchase = round2(costPerPurchase);
  const roundedPurchaseRoas = round2(purchaseRoas);
  const roundedCostPerOutboundClick = round2(costPerOutboundClick);

  return {
    summary: {
      [META_ADS_KPI_KEYS.amountSpent]: roundedAmountSpent,
      [META_ADS_KPI_KEYS.impressions]: impressions,
      [META_ADS_KPI_KEYS.reach]: reach,
      [META_ADS_KPI_KEYS.frequency]: round2(frequency),
      [META_ADS_KPI_KEYS.clicks]: clicks,
      [META_ADS_KPI_KEYS.linkClicks]: linkClicks,
      [META_ADS_KPI_KEYS.outboundClicks]: outboundClicks,
      [META_ADS_KPI_KEYS.ctr]: round2(ctr),
      [META_ADS_KPI_KEYS.cpc]: round2(cpc),
      [META_ADS_KPI_KEYS.cpm]: round2(cpm),
      [META_ADS_KPI_KEYS.purchases]: purchases,
      [META_ADS_KPI_KEYS.costPerPurchase]: roundedCostPerPurchase,
      [META_ADS_KPI_KEYS.purchaseConversionValue]: roundedPurchaseConversionValue,
      [META_ADS_KPI_KEYS.purchaseRoas]: roundedPurchaseRoas,
      [META_ADS_KPI_KEYS.costPerOutboundClick]: roundedCostPerOutboundClick,

      // Alias legacy tenuti solo nel summary per compatibilita con cache, overview e metriche custom esistenti.
      spend: roundedAmountSpent,
      meta_spend: roundedAmountSpent,
      impressions,
      reach,
      frequency: round2(frequency),
      clicks,
      link_clicks: linkClicks,
      outbound_clicks: outboundClicks,
      ctr: round2(ctr),
      cpc: round2(cpc),
      cpm: round2(cpm),
      purchases,
      meta_purchases: purchases,
      purchase_value: roundedPurchaseConversionValue,
      meta_conversion_value: roundedPurchaseConversionValue,
      conversion_value: roundedPurchaseConversionValue,
      roas: roundedPurchaseRoas,
      cpa: roundedCostPerPurchase,
      cpoc: roundedCostPerOutboundClick,
    },
    meta: {
      rowCount: rows.length,
      range: meta.range ?? null,
      startDate: meta.startDate ?? null,
      endDate: meta.endDate ?? null,
      fetchedAt: meta.fetchedAt ?? null,
      usedActionMapping: meta.usedActionMapping ?? {
        purchases: [],
        purchase_value: [],
        purchase_roas: [],
        cost_per_purchase: [],
        link_clicks: [],
        outbound_clicks: [],
        cost_per_outbound_click: [],
      },
      missingActionKeys: meta.missingActionKeys ?? {
        purchases: [],
        purchase_value: [],
        link_clicks: [],
        outbound_clicks: [],
      },
      missingActionRows: meta.missingActionRows ?? {
        purchases: 0,
        purchase_value: 0,
        purchase_roas: 0,
        cost_per_purchase: 0,
        link_clicks: 0,
        outbound_clicks: 0,
        cost_per_outbound_click: 0,
      },
      hasPartialAttributionData: Boolean(meta.hasPartialAttributionData),
    },
    seriesByMetricKey: buildMetaAdsSeriesByMetricKey(rows),
  };
}

export function compareMetaAdsKpis(currentSummary, previousSummary) {
  return compareNumericSummaries(
    currentSummary,
    previousSummary,
    META_ADS_COMPARISON_KEYS
  );
}
