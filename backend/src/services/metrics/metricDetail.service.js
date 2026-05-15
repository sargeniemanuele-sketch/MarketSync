import { CURRENCY_DEFAULT, HTTP_STATUS, LOCALE_DEFAULT } from '../../config/app.constants.js';
import {
  AGGREGATE_OVERVIEW_DEFINITIONS,
  buildAggregateSparklineSeries,
  buildCustomMetricCards,
  formatMetricValue,
} from '../../contracts/metrics/cards.js';
import {
  buildGoogleAdsCardDefinition,
  getGoogleAdsKpiDefinition,
} from '../../contracts/metrics/googleAds.kpi.map.js';
import {
  buildMetaAdsCardDefinition,
  getMetaAdsKpiDefinition,
} from '../../contracts/metrics/metaAds.kpi.map.js';
import {
  buildShopifyCardDefinition,
  getShopifyKpiDefinition,
} from '../../contracts/metrics/shopify.kpi.map.js';
import { compareMetricValues } from '../../utils/comparison.js';
import { AppError } from '../../utils/errors.js';
import {
  APP_TIMEZONE,
  buildMetricsPeriodMeta,
  resolveMetricsComparisonRange,
  toAppDateString,
} from '../../utils/ranges.js';
import { buildDailyDateKeys } from '../../utils/sparkline.js';
import { resolveMetricGranularity } from '../../utils/granularity.js';
import { getClientById } from '../clients/clients.service.js';
import { resolveWithCache } from '../cache/metricCache.service.js';
import { computeCustomMetrics } from '../customMetrics/customMetrics.service.js';
import { buildOverviewMetrics } from '../overview/overview.service.js';
import {
  getGoogleAdsKpiResultWithComparison,
  getMetaAdsKpiResultWithComparison,
  getShopifyKpiResultWithComparison,
} from '../overview/overview.service.js';
import { fetchRawShopifyData } from '../shopify/shopify.fetch.service.js';
import { normalizeOrders } from '../shopify/shopify.normalize.service.js';

const PROVIDER_LABELS = Object.freeze({
  overview: 'Overview',
  shopify: 'Shopify',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  custom_metric: 'Metriche custom',
});

const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;

const ADDITIVE_SERIES_KEYS = Object.freeze(new Set([
  'total_ad_spend',
  'total_attributed_conversion_value',
  'total_sales',
  'attributed_conversions',
  'orders',
  'shopify_gross_sales',
  'shopify_discounts',
  'shopify_returns',
  'shopify_net_sales',
  'shopify_shipping',
  'shopify_taxes',
  'shopify_total_sales',
  'shopify_orders',
  'shopify_units_sold',
  'shopify_new_customers',
  'shopify_returning_customers',
  'meta_amount_spent',
  'meta_impressions',
  'meta_clicks',
  'meta_link_clicks',
  'meta_outbound_clicks',
  'meta_purchases',
  'meta_purchase_conversion_value',
  'google_cost',
  'google_impressions',
  'google_clicks',
  'google_conversions',
  'google_conversion_value',
  'google_all_conversions',
  'google_all_conversion_value',
]));

const PROVIDER_PIPELINES = Object.freeze({
  shopify: getShopifyKpiResultWithComparison,
  meta_ads: getMetaAdsKpiResultWithComparison,
  google_ads: getGoogleAdsKpiResultWithComparison,
});

const dayShortFormatter = new Intl.DateTimeFormat(LOCALE_DEFAULT, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const dayLongFormatter = new Intl.DateTimeFormat(LOCALE_DEFAULT, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const monthFormatter = new Intl.DateTimeFormat(LOCALE_DEFAULT, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const appDateTimePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

const offsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  timeZoneName: 'shortOffset',
});

function round2(value) {
  return Math.round(value * 100) / 100;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

function toFiniteNumber(value) {
  if (typeof value !== 'number') return null;
  return Number.isFinite(value) ? value : null;
}

function metricNotFound() {
  throw new AppError(
    'Metrica non trovata per il provider selezionato.',
    HTTP_STATUS.NOT_FOUND,
    'METRIC_NOT_FOUND',
    { scope: 'metrics' }
  );
}

function warning(code, message, extra = {}) {
  return { code, message, ...extra };
}

function resolveCurrency(providerResult, unit) {
  if (unit !== 'currency') return CURRENCY_DEFAULT;
  const currency = providerResult?.meta?.currency;
  return typeof currency === 'string' && currency.trim()
    ? currency.trim().toUpperCase()
    : CURRENCY_DEFAULT;
}

function normalizeDefinition(provider, metricKey, customMetric = null) {
  if (provider === 'overview') {
    const definition = AGGREGATE_OVERVIEW_DEFINITIONS.find((item) => item.key === metricKey);
    if (!definition) return null;
    return {
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      description: definition.description ?? null,
      formula: definition.formula ?? null,
    };
  }

  if (provider === 'shopify') {
    const definition = getShopifyKpiDefinition(metricKey);
    const cardDefinition = buildShopifyCardDefinition(metricKey);
    if (!definition) return null;
    return {
      key: definition.internalKey,
      label: definition.officialLabel,
      unit: definition.unit,
      description: definition.descriptionIt ?? null,
      descriptionIt: definition.descriptionIt ?? null,
      formula: definition.formula ?? null,
      formulaIt: definition.formulaIt ?? null,
      note: cardDefinition?.help?.note ?? null,
    };
  }

  if (provider === 'meta_ads') {
    const definition = getMetaAdsKpiDefinition(metricKey);
    const cardDefinition = buildMetaAdsCardDefinition(metricKey);
    if (!definition) return null;
    return {
      key: definition.internalKey,
      label: definition.officialLabel,
      unit: definition.unit,
      description: definition.descriptionIt ?? null,
      descriptionIt: definition.descriptionIt ?? null,
      formula: definition.formula ?? null,
      formulaIt: definition.formulaIt ?? null,
      note: cardDefinition?.help?.note ?? null,
    };
  }

  if (provider === 'google_ads') {
    const definition = getGoogleAdsKpiDefinition(metricKey);
    const cardDefinition = buildGoogleAdsCardDefinition(metricKey);
    if (!definition) return null;
    return {
      key: definition.internalKey,
      label: definition.officialLabel,
      unit: definition.unit,
      description: definition.descriptionIt ?? null,
      descriptionIt: definition.descriptionIt ?? null,
      formula: definition.formula ?? null,
      formulaIt: definition.formulaIt ?? null,
      note: cardDefinition?.help?.note ?? null,
    };
  }

  if (provider === 'custom_metric' && customMetric) {
    return {
      key: customMetric.key,
      label: customMetric.label ?? customMetric.key,
      unit: customMetric.unit ?? 'number',
      description: customMetric.description ?? null,
      formula: customMetric.formula ?? null,
    };
  }

  return null;
}

export function resolveMetricDefinitionOrThrow(provider, metricKey, customMetric = null) {
  const definition = normalizeDefinition(provider, metricKey, customMetric);
  if (!definition) metricNotFound();
  return definition;
}

function offsetSuffixForDateKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  const timeZoneName = offsetFormatter
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+0';
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(timeZoneName);
  if (!match) return '+00:00';
  const [, sign, hours, minutes = '00'] = match;
  return `${sign}${String(hours).padStart(2, '0')}:${minutes}`;
}

function timestampForDate(dateKey, hour = 0) {
  return `${dateKey}T${String(hour).padStart(2, '0')}:00:00${offsetSuffixForDateKey(dateKey)}`;
}

function dateFromKey(dateKey) {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function formatDayShort(dateKey) {
  return dayShortFormatter.format(dateFromKey(dateKey));
}

function formatDayLong(dateKey) {
  return dayLongFormatter.format(dateFromKey(dateKey));
}

function normalizeDailySeries(series) {
  if (!Array.isArray(series)) return null;

  return series
    .map((point) => {
      let date = null;
      if (typeof point?.date === 'string') {
        date = point.date.slice(0, 10);
      } else if (point?.date != null || point?.timestamp != null) {
        try {
          date = toAppDateString(point.date ?? point.timestamp);
        } catch {
          date = null;
        }
      }
      const value = toFiniteNumber(point?.value);
      if (!date || value == null) return null;
      return { date, value: round2(value) };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateDailySeries(series, { granularity, metricKey, startDate, endDate }) {
  const daily = normalizeDailySeries(series);
  if (!daily) return null;
  if (granularity === 'daily') return daily;

  if (!ADDITIVE_SERIES_KEYS.has(metricKey)) {
    return null;
  }

  const groups = new Map();
  const dateKeys = buildDailyDateKeys(startDate, endDate);
  const weekBucketByDate = new Map();

  dateKeys.forEach((date, index) => {
    const bucketStart = dateKeys[Math.floor(index / 7) * 7];
    const bucketEnd = dateKeys[Math.min(dateKeys.length - 1, Math.floor(index / 7) * 7 + 6)];
    weekBucketByDate.set(date, { key: bucketStart, startDate: bucketStart, endDate: bucketEnd });
  });

  for (const point of daily) {
    const group = granularity === 'monthly'
      ? { key: point.date.slice(0, 7), startDate: `${point.date.slice(0, 7)}-01`, endDate: null }
      : weekBucketByDate.get(point.date);

    if (!group) continue;
    const existing = groups.get(group.key) ?? { ...group, value: 0 };
    existing.value += point.value;
    groups.set(group.key, existing);
  }

  return [...groups.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => ({ ...item, date: item.startDate, value: round2(item.value) }));
}

function pointLabel(point, granularity) {
  if (granularity === 'monthly') {
    return monthFormatter.format(dateFromKey(point.date));
  }

  if (granularity === 'weekly') {
    return `${formatDayShort(point.startDate)} - ${formatDayShort(point.endDate)}`;
  }

  if (granularity === 'hourly') {
    return `${String(point.hour).padStart(2, '0')}:00`;
  }

  return formatDayShort(point.date);
}

function rowPeriod(point, granularity) {
  if (granularity === 'monthly') {
    return monthFormatter.format(dateFromKey(point.date));
  }

  if (granularity === 'weekly') {
    return `${formatDayShort(point.startDate)} - ${formatDayLong(point.endDate)}`;
  }

  if (granularity === 'hourly') {
    return `${formatDayLong(point.date)}, ${String(point.hour).padStart(2, '0')}:00`;
  }

  return formatDayLong(point.date);
}

function buildChartAndTable({ series, granularity, unit, currency }) {
  const points = Array.isArray(series) ? series : [];

  const chartPoints = points.map((point) => ({
    timestamp: timestampForDate(point.date, point.hour ?? 0),
    date: point.date,
    label: pointLabel(point, granularity),
    value: point.value,
    formattedValue: formatMetricValue(point.value, unit, { currency }),
  }));

  return {
    chart: {
      type: 'line',
      granularity,
      points: chartPoints,
    },
    table: {
      columns: [
        { key: 'period', label: 'Periodo' },
        { key: 'value', label: 'Valore' },
      ],
      rows: points.map((point) => ({
        period: rowPeriod(point, granularity),
        timestamp: timestampForDate(point.date, point.hour ?? 0),
        value: point.value,
        formattedValue: formatMetricValue(point.value, unit, { currency }),
      })),
    },
  };
}

function unavailableChartTable() {
  return {
    chart: null,
    table: {
      columns: [
        { key: 'period', label: 'Periodo' },
        { key: 'value', label: 'Valore' },
      ],
      rows: [],
    },
  };
}

function buildMetricSummary({ definition, provider, providerResult, customMetricCard = null }) {
  const unit = definition.unit ?? customMetricCard?.unit ?? 'number';
  const currency = resolveCurrency(providerResult, unit);
  const summary = providerResult?.summary ?? {};
  const comparison = providerResult?.comparison?.[definition.key] ?? null;
  const value = provider === 'custom_metric'
    ? toFiniteNumber(customMetricCard?.value)
    : toFiniteNumber(summary[definition.key]);
  const previousValue = toFiniteNumber(comparison?.previousValue);
  const delta = toFiniteNumber(comparison?.delta);
  const deltaPercentage = comparison?.deltaPercentage === null
    ? null
    : toFiniteNumber(comparison?.deltaPercentage);

  return {
    key: definition.key,
    label: definition.label,
    provider,
    providerLabel: PROVIDER_LABELS[provider] ?? provider,
    providerLogoKey: provider,
    unit,
    value,
    formattedValue: customMetricCard?.formattedValue ?? formatMetricValue(value, unit, { currency }),
    previousValue,
    formattedPreviousValue: formatMetricValue(previousValue, unit, { currency }),
    delta,
    deltaPercentage,
    trend: comparison?.trend ?? null,
    description: definition.description ?? null,
    descriptionIt: definition.descriptionIt ?? null,
    formula: definition.formula ?? null,
    formulaIt: definition.formulaIt ?? null,
    note: definition.note ?? null,
    noteIt: definition.noteIt ?? null,
  };
}

function localDateHour(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    appDateTimePartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

function createShopifyHourlyBucket(date, hour) {
  return {
    date,
    hour,
    grossSales: 0,
    discounts: 0,
    returnsAmount: 0,
    shipping: 0,
    taxes: 0,
    duties: 0,
    additionalFees: 0,
    orders: 0,
    unitsSold: 0,
    newCustomerOrders: 0,
    returningCustomerOrders: 0,
  };
}

function readShopifyHourlyValue(bucket, metricKey) {
  const netSales = bucket.grossSales - bucket.discounts - bucket.returnsAmount;
  const totalSales = netSales + bucket.shipping + bucket.taxes + bucket.duties + bucket.additionalFees;
  const averageOrderValue = bucket.orders > 0
    ? (bucket.grossSales - bucket.discounts) / bucket.orders
    : 0;

  // Approssimazione order-based per percentuali customer rate (su ordini noti).
  const knownOrders = bucket.newCustomerOrders + bucket.returningCustomerOrders;
  const returningCustomersRate = knownOrders > 0
    ? round2((bucket.returningCustomerOrders / knownOrders) * 100)
    : null;
  const newCustomersRate = returningCustomersRate != null
    ? round2(100 - returningCustomersRate)
    : null;

  const values = {
    shopify_gross_sales:          bucket.grossSales,
    shopify_discounts:            bucket.discounts,
    shopify_returns:              bucket.returnsAmount,
    shopify_net_sales:            netSales,
    shopify_shipping:             bucket.shipping,
    shopify_taxes:                bucket.taxes,
    shopify_total_sales:          totalSales,
    shopify_orders:               bucket.orders,
    shopify_average_order_value:  averageOrderValue,
    shopify_units_sold:           bucket.unitsSold,
    shopify_new_customers:        newCustomersRate,
    shopify_returning_customers:  returningCustomersRate,
  };

  return values[metricKey];
}

async function buildShopifyHourlySeries({ clientId, range, startDate, endDate, metricKey }) {
  const rawResult = await fetchRawShopifyData({ clientId, range, startDate, endDate });
  const orders = normalizeOrders(rawResult.orders ?? []);
  const buckets = new Map();

  for (const date of buildDailyDateKeys(startDate, endDate)) {
    for (let hour = 0; hour < 24; hour += 1) {
      buckets.set(`${date}T${hour}`, createShopifyHourlyBucket(date, hour));
    }
  }

  for (const order of orders) {
    const dateHour = localDateHour(order.createdAt);
    if (!dateHour) continue;
    const key = `${dateHour.date}T${dateHour.hour}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;

    bucket.grossSales += order.grossSales;
    bucket.discounts += order.totalDiscounts;
    bucket.returnsAmount += order.returnsAmount;
    bucket.shipping += order.shipping;
    bucket.taxes += order.totalTax;
    bucket.duties += order.duties;
    bucket.additionalFees += order.additionalFees;
    bucket.orders += 1;
    bucket.unitsSold += order.unitsSold;

    if (order.isReturningCustomer === false) {
      bucket.newCustomerOrders += 1;
    } else if (order.isReturningCustomer === true) {
      bucket.returningCustomerOrders += 1;
    }
  }

  return [...buckets.values()]
    .sort((a, b) => (a.date === b.date ? a.hour - b.hour : a.date.localeCompare(b.date)))
    .map((bucket) => ({
      date: bucket.date,
      hour: bucket.hour,
      value: round2(readShopifyHourlyValue(bucket, metricKey) ?? 0),
    }));
}

function buildDetailPayloadFromSeries({
  definition,
  provider,
  providerResult,
  series,
  effectiveGranularity,
  warnings,
}) {
  const metric = buildMetricSummary({ definition, provider, providerResult });
  const currency = resolveCurrency(providerResult, definition.unit);

  if (!Array.isArray(series)) {
    return {
      data: {
        metric,
        ...unavailableChartTable(),
      },
      warnings: [
        ...warnings,
        warning('SERIES_NOT_AVAILABLE', 'Serie non disponibile per la metrica selezionata.', {
          provider,
          metricKey: definition.key,
        }),
      ],
    };
  }

  return {
    data: {
      metric,
      ...buildChartAndTable({
        series,
        granularity: effectiveGranularity,
        unit: definition.unit,
        currency,
      }),
    },
    warnings,
  };
}

async function buildDirectProviderDetail({
  clientId,
  provider,
  metricKey,
  range,
  startDate,
  endDate,
  granularity,
  requestedGranularity,
}) {
  const definition = resolveMetricDefinitionOrThrow(provider, metricKey);

  const providerResult = await PROVIDER_PIPELINES[provider]({
    clientId,
    range,
    startDate,
    endDate,
  });

  const warnings = [...(providerResult?.warnings ?? [])];
  let effectiveGranularity = granularity;
  let series = null;

  if (granularity === 'hourly' && provider !== 'shopify') {
    if (requestedGranularity === 'auto') {
      effectiveGranularity = 'daily';
      warnings.push(warning(
        'HOURLY_GRANULARITY_FALLBACK',
        'La granularità oraria non è ancora disponibile per questo provider: viene usata la granularità giornaliera.',
        { provider, requestedGranularity }
      ));
    } else {
      warnings.push(warning(
        'GRANULARITY_NOT_AVAILABLE',
        'La granularità richiesta non è ancora disponibile per questo provider.',
        { provider, requestedGranularity }
      ));
      return {
        data: {
          metric: buildMetricSummary({ definition, provider, providerResult }),
          ...unavailableChartTable(),
        },
        warnings,
        effectiveGranularity,
      };
    }
  }

  if (effectiveGranularity === 'hourly' && provider === 'shopify') {
    try {
      series = await buildShopifyHourlySeries({ clientId, range, startDate, endDate, metricKey });
    } catch {
      series = null;
      warnings.push(warning(
        'SERIES_NOT_AVAILABLE',
        'Serie oraria Shopify non disponibile per la metrica selezionata.',
        { provider, metricKey }
      ));
    }
  } else {
    series = aggregateDailySeries(providerResult?.seriesByMetricKey?.[metricKey], {
      granularity: effectiveGranularity,
      metricKey,
      startDate,
      endDate,
    });
  }

  const payload = buildDetailPayloadFromSeries({
    definition,
    provider,
    providerResult,
    series,
    effectiveGranularity,
    warnings,
  });

  return { ...payload, effectiveGranularity };
}

async function buildOverviewDetail({
  clientId,
  metricKey,
  range,
  startDate,
  endDate,
  granularity,
  requestedGranularity,
}) {
  const definition = resolveMetricDefinitionOrThrow('overview', metricKey);

  const overviewResult = await buildOverviewMetrics({ clientId, range, startDate, endDate });
  const warnings = [...(overviewResult?.warnings ?? [])];
  let effectiveGranularity = granularity;

  if (granularity === 'hourly') {
    if (requestedGranularity === 'auto') {
      effectiveGranularity = 'daily';
      warnings.push(warning(
        'HOURLY_GRANULARITY_FALLBACK',
        'La granularità oraria richiede serie orarie da tutti i provider: viene usata la granularità giornaliera.',
        { provider: 'overview', requestedGranularity }
      ));
    } else {
      warnings.push(warning(
        'GRANULARITY_NOT_AVAILABLE',
        'La granularità oraria non è disponibile per le metriche overview.',
        { provider: 'overview', requestedGranularity }
      ));
      const card = overviewResult?.overview?.mainCards?.find((item) => item.key === metricKey);
      const providerResult = {
        summary: { [metricKey]: card?.value },
        comparison: card?.comparison ? { [metricKey]: card.comparison } : {},
        meta: { currency: card?.currency ?? CURRENCY_DEFAULT },
      };
      return {
        data: {
          metric: buildMetricSummary({ definition, provider: 'overview', providerResult }),
          ...unavailableChartTable(),
        },
        warnings,
        effectiveGranularity,
      };
    }
  }

  const card = overviewResult?.overview?.mainCards?.find((item) => item.key === metricKey);
  const providerResult = {
    summary: { [metricKey]: card?.value },
    comparison: card?.comparison ? { [metricKey]: card.comparison } : {},
    meta: { currency: card?.currency ?? CURRENCY_DEFAULT },
  };
  const seriesByMetricKey = buildAggregateSparklineSeries(overviewResult?.data ?? {});
  const series = aggregateDailySeries(seriesByMetricKey[metricKey], {
    granularity: effectiveGranularity,
    metricKey,
    startDate,
    endDate,
  });

  const payload = buildDetailPayloadFromSeries({
    definition,
    provider: 'overview',
    providerResult,
    series,
    effectiveGranularity,
    warnings,
  });

  return { ...payload, effectiveGranularity };
}

async function buildCustomMetricDetail({
  client,
  clientId,
  metricKey,
  range,
  startDate,
  endDate,
  previousDates,
  granularity,
}) {
  const customMetric = (client.customMetricsConfig ?? []).find((item) => item.key === metricKey);
  if (!customMetric) metricNotFound();

  const currentResult = await computeCustomMetrics({ clientId, range, startDate, endDate });
  let previousResult = null;
  try {
    previousResult = await computeCustomMetrics({
      clientId,
      range: 'custom',
      startDate: previousDates.startDate,
      endDate: previousDates.endDate,
    });
  } catch {
    previousResult = null;
  }

  const currentCard = buildCustomMetricCards(currentResult)
    .find((item) => item.key === metricKey);
  if (!currentCard) metricNotFound();

  const previousMetric = previousResult?.metrics?.find((item) => item.key === metricKey);
  const previousValue = previousMetric?.status === 'ok' ? toFiniteNumber(previousMetric.value) : null;
  const currentValue = toFiniteNumber(currentCard.value);
  const comparison = currentValue != null && previousValue != null
    ? compareMetricValues(currentValue, previousValue)
    : null;
  const definition = normalizeDefinition('custom_metric', metricKey, {
    ...customMetric,
    unit: currentCard.unit,
  });

  const providerResult = {
    summary: { [metricKey]: currentValue },
    comparison: comparison ? { [metricKey]: comparison } : {},
    meta: {},
  };
  const metricWarnings = currentResult?.warnings?.filter((warningItem) => {
    return !warningItem?.metricKey || warningItem.metricKey === metricKey;
  }) ?? [];
  const sources = (currentCard.sources ?? currentCard.variables ?? []).map((source) => ({
    variableKey: source.variableKey,
    sourceProvider: source.sourceProvider,
    metricKey: source.metricKey,
  }));

  return {
    data: {
      metric: {
        ...buildMetricSummary({
          definition,
          provider: 'custom_metric',
          providerResult,
          customMetricCard: currentCard,
        }),
        availability: currentCard.availability ?? null,
        formulaLabel: currentCard.formulaLabel ?? currentCard.formula ?? null,
        providerContext: currentCard.providerContext ?? customMetric.providerContext ?? 'mixed',
        sources,
        warnings: metricWarnings,
      },
      ...unavailableChartTable(),
    },
    warnings: [
      warning(
        'CUSTOM_METRIC_CHART_UNAVAILABLE',
        'Il dettaglio chart delle metriche custom non è disponibile in questo task.',
        { provider: 'custom_metric', metricKey }
      ),
      ...(currentResult?.warnings ?? []),
    ],
    effectiveGranularity: granularity,
  };
}

async function buildMetricDetailLivePayload({
  client,
  clientId,
  provider,
  metricKey,
  range,
  startDate,
  endDate,
  previousDates,
  granularity,
  requestedGranularity,
}) {
  if (provider === 'overview') {
    return buildOverviewDetail({
      clientId,
      metricKey,
      range,
      startDate,
      endDate,
      granularity,
      requestedGranularity,
    });
  }

  if (provider === 'custom_metric') {
    return buildCustomMetricDetail({
      client,
      clientId,
      metricKey,
      range,
      startDate,
      endDate,
      previousDates,
      granularity,
    });
  }

  return buildDirectProviderDetail({
    clientId,
    provider,
    metricKey,
    range,
    startDate,
    endDate,
    granularity,
    requestedGranularity,
  });
}

function attachCacheMeta(payload, cacheMeta, source) {
  return {
    data: payload.data,
    warnings: [
      ...(payload.warnings ?? []),
      ...(source === 'stale'
        ? [warning(
            'STALE_DATA',
            'Dati non aggiornati: vengono mostrati gli ultimi dati detail disponibili.',
          )]
        : []),
    ],
    meta: {
      ...(payload.meta ?? {}),
      ...cacheMeta,
      source: source === 'live' ? 'live' : 'cache',
      ...(source === 'stale' ? { isStale: true } : {}),
    },
  };
}

export async function getMetricDetail({
  userId,
  clientId,
  provider,
  metricKey,
  range,
  startDate,
  endDate,
  granularity: requestedGranularity = 'auto',
}) {
  const client = await getClientById(userId, clientId);
  const { current, previous } = resolveMetricsComparisonRange({ range, startDate, endDate });
  const granularityResolution = resolveMetricGranularity({
    requestedGranularity,
    range,
    startDate: current.startDate,
    endDate: current.endDate,
  });

  const cacheParams = {
    clientId,
    provider,
    metricKey,
    granularity: granularityResolution.requestedGranularity,
    range,
    startDate: current.startDate,
    endDate: current.endDate,
  };

  const { data: payload, meta: cacheMeta, source } = await resolveWithCache({
    cacheParams,
    ttlMs: DETAIL_CACHE_TTL_MS,
    buildLive: async () => {
      const livePayload = await buildMetricDetailLivePayload({
        client,
        clientId,
        provider,
        metricKey,
        range,
        startDate: current.startDate,
        endDate: current.endDate,
        previousDates: previous,
        granularity: granularityResolution.granularity,
        requestedGranularity: granularityResolution.requestedGranularity,
      });
      const { effectiveGranularity, ...cacheablePayload } = livePayload;

      return {
        ...cacheablePayload,
        meta: {
          clientId,
          ...buildMetricsPeriodMeta({
            range,
            startDate: current.startDate,
            endDate: current.endDate,
            comparison: previous,
          }),
          granularity: effectiveGranularity,
          requestedGranularity: granularityResolution.requestedGranularity,
        },
      };
    },
  });

  return attachCacheMeta(payload, cacheMeta, source);
}

export const metricDetailTestUtils = Object.freeze({
  aggregateDailySeries,
  buildChartAndTable,
  normalizeDefinition,
  resolveMetricDefinitionOrThrow,
});
