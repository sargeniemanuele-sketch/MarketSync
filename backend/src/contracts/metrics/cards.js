import { CURRENCY_DEFAULT, LOCALE_DEFAULT } from '../../config/app.constants.js';
import {
  SHOPIFY_DASHBOARD_PREVIEW_KEYS,
  SHOPIFY_PRIMARY_KPI_KEYS,
  SHOPIFY_SECONDARY_KPI_KEYS,
  buildShopifyCardDefinition,
} from './shopify.kpi.map.js';
import {
  META_ADS_DASHBOARD_PREVIEW_KEYS,
  META_ADS_PRIMARY_KPI_KEYS,
  META_ADS_SECONDARY_KPI_KEYS,
  buildMetaAdsCardDefinition,
} from './metaAds.kpi.map.js';
import {
  GOOGLE_ADS_DASHBOARD_PREVIEW_KEYS,
  GOOGLE_ADS_PRIMARY_KPI_KEYS,
  GOOGLE_ADS_SECONDARY_KPI_KEYS,
  buildGoogleAdsCardDefinition,
} from './googleAds.kpi.map.js';
import { compareMetricValues } from '../../utils/comparison.js';
import { maybeBuildSparkline } from '../../utils/sparkline.js';

export const PROVIDER_ORDER = Object.freeze(['shopify', 'meta_ads', 'google_ads']);

export const PROVIDER_LABELS = Object.freeze({
  shopify: 'Shopify',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
});

export const PROVIDER_LOGO_KEYS = Object.freeze({
  shopify: 'shopify',
  meta_ads: 'meta_ads',
  google_ads: 'google_ads',
});

export const PROVIDER_STATUS = Object.freeze({
  AVAILABLE: 'available',
  NOT_CONNECTED: 'not_connected',
  INCOMPLETE: 'incomplete',
  FAILED: 'failed',
});

const PROVIDER_STATUS_WARNING_CODES = Object.freeze({
  [PROVIDER_STATUS.NOT_CONNECTED]: 'PROVIDER_NOT_CONNECTED',
  [PROVIDER_STATUS.INCOMPLETE]: 'INTEGRATION_INCOMPLETE',
  [PROVIDER_STATUS.FAILED]: 'PROVIDER_FETCH_FAILED',
});

const AGGREGATE_MISSING_PROVIDER_WARNING_CODES = Object.freeze([
  'PROVIDER_NOT_CONNECTED',
  'INTEGRATION_INCOMPLETE',
]);

const CARD_DEFINITIONS = Object.freeze({
  shopify: Object.freeze({
    primary: Object.freeze(SHOPIFY_PRIMARY_KPI_KEYS.map(buildShopifyCardDefinition)),
    secondary: Object.freeze(SHOPIFY_SECONDARY_KPI_KEYS.map(buildShopifyCardDefinition)),
    dashboardPreview: Object.freeze(SHOPIFY_DASHBOARD_PREVIEW_KEYS.map(buildShopifyCardDefinition)),
  }),
  meta_ads: Object.freeze({
    primary: Object.freeze(META_ADS_PRIMARY_KPI_KEYS.map(buildMetaAdsCardDefinition)),
    secondary: Object.freeze(META_ADS_SECONDARY_KPI_KEYS.map(buildMetaAdsCardDefinition)),
    dashboardPreview: Object.freeze(META_ADS_DASHBOARD_PREVIEW_KEYS.map(buildMetaAdsCardDefinition)),
  }),
  google_ads: Object.freeze({
    primary: Object.freeze(GOOGLE_ADS_PRIMARY_KPI_KEYS.map(buildGoogleAdsCardDefinition)),
    secondary: Object.freeze(GOOGLE_ADS_SECONDARY_KPI_KEYS.map(buildGoogleAdsCardDefinition)),
    dashboardPreview: Object.freeze(GOOGLE_ADS_DASHBOARD_PREVIEW_KEYS.map(buildGoogleAdsCardDefinition)),
  }),
});

const AGGREGATE_PROVIDER_ORDER = Object.freeze(['shopify', 'meta_ads', 'google_ads']);

export const AGGREGATE_OVERVIEW_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: 'total_ad_spend',
    label: 'Total ad spend',
    unit: 'currency',
    description: 'Somma della spesa pubblicitaria sulle piattaforme ads collegate.',
    formula: 'Total ad spend = Meta Ads Amount spent + Google Ads Cost',
  }),
  Object.freeze({
    key: 'total_attributed_conversion_value',
    label: 'Total attributed conversion value',
    unit: 'currency',
    description: 'Somma del valore conversioni attribuito dalle piattaforme ads collegate.',
    formula: 'Total attributed conversion value = Meta Ads Purchase conversion value + Google Ads Conv. value',
  }),
  Object.freeze({
    key: 'blended_roas',
    label: 'Blended ROAS',
    unit: 'ratio',
    description: 'Misura il ritorno attribuito complessivo delle piattaforme ads collegate.',
    formula: 'Blended ROAS = Total attributed conversion value / Total ad spend',
  }),
  Object.freeze({
    key: 'total_sales',
    label: 'Total sales',
    unit: 'currency',
    description: 'Vendite totali Shopify nel periodo selezionato.',
    formula: 'Total sales = Shopify Total sales',
  }),
  Object.freeze({
    key: 'mer',
    label: 'MER',
    unit: 'ratio',
    description: 'Misura quanto fatturato Shopify viene generato per ogni euro speso in advertising.',
    formula: 'MER = Total sales / Total ad spend',
  }),
  Object.freeze({
    key: 'attributed_conversions',
    label: 'Attributed conversions',
    unit: 'number',
    description: 'Somma delle conversioni attribuite dalle piattaforme ads collegate.',
    formula: 'Attributed conversions = Meta Ads Purchases + Google Ads Conversions',
  }),
  Object.freeze({
    key: 'orders',
    label: 'Orders',
    unit: 'number',
    description: 'Numero di ordini Shopify nel periodo selezionato.',
    formula: 'Orders = Shopify Orders',
  }),
  Object.freeze({
    key: 'cpa_blended',
    label: 'CPA blended',
    unit: 'currency',
    description: 'Costo medio per conversione attribuita sulle piattaforme ads collegate.',
    formula: 'CPA blended = Total ad spend / Attributed conversions',
  }),
  Object.freeze({
    key: 'cost_per_order',
    label: 'Cost per order',
    unit: 'currency',
    description: 'Costo advertising medio per ordine Shopify.',
    formula: 'Cost per order = Total ad spend / Orders',
  }),
  Object.freeze({
    key: 'average_order_value',
    label: 'Average order value',
    unit: 'currency',
    description: 'Valore medio degli ordini Shopify nel periodo selezionato.',
    formula: 'Average order value = Shopify Average order value',
  }),
]);

function toList(value) {
  return Array.isArray(value) ? value : [];
}

function toFiniteNumber(value) {
  if (typeof value !== 'number') return null;
  return Number.isFinite(value) ? value : null;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

function hasProviderData(providerData, provider) {
  return Boolean(providerData?.[provider]?.summary);
}

function formatProviderList(providerKeys) {
  const labels = providerKeys.map((provider) => PROVIDER_LABELS[provider] ?? provider);

  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}

function hasMissingProviderWarning(warnings, provider) {
  const providerWarnings = getProviderWarnings(warnings, provider);

  return providerWarnings.some((warning) => {
    return AGGREGATE_MISSING_PROVIDER_WARNING_CODES.includes(warning?.code);
  });
}

function isAggregateProviderMissing({ provider, providerData, warnings, meta }) {
  if (hasProviderData(providerData, provider)) return false;
  if (hasMissingProviderWarning(warnings, provider)) return true;

  const attemptedProviders = toList(meta?.attemptedProviders);
  const availableProviders = toList(meta?.availableProviders);
  const failedProviders = toList(meta?.failedProviders);

  if (
    attemptedProviders.includes(provider) ||
    availableProviders.includes(provider) ||
    failedProviders.includes(provider)
  ) {
    return false;
  }

  return true;
}

function buildAggregateCompleteness(providerData = {}, warnings = [], meta = {}) {
  const missingProviders = AGGREGATE_PROVIDER_ORDER.filter((provider) => {
    return isAggregateProviderMissing({
      provider,
      providerData,
      warnings,
      meta,
    });
  });

  if (missingProviders.length === 0) {
    return {
      isComplete: true,
      missingProviders: [],
      message: null,
    };
  }

  const verb = missingProviders.length === 1 ? 'manca' : 'mancano';

  return {
    isComplete: false,
    missingProviders,
    message: `Dati aggregati non completi: ${verb} ${formatProviderList(missingProviders)}.`,
  };
}

function readSummaryMetric(providerData, provider, key) {
  const summary = providerData?.[provider]?.summary ?? null;

  if (!hasOwn(summary, key)) {
    return {
      available: false,
      value: null,
      previousAvailable: false,
      previousValue: null,
    };
  }

  const value = toFiniteNumber(summary[key]);
  const comparison = providerData?.[provider]?.comparison?.[key] ?? null;
  const previousValue = toFiniteNumber(comparison?.previousValue);

  return {
    available: value != null,
    value,
    previousAvailable: previousValue != null,
    previousValue,
  };
}

function readMetricSeries(providerData, provider, key) {
  const series = providerData?.[provider]?.seriesByMetricKey?.[key];
  return Array.isArray(series) ? series : null;
}

function readAvailableMetricSeries(providerData, provider, key) {
  const metric = readSummaryMetric(providerData, provider, key);

  return {
    available: metric.available,
    series: metric.available ? readMetricSeries(providerData, provider, key) : null,
  };
}

function buildSeriesMap(series) {
  if (!Array.isArray(series)) return null;

  const map = new Map();
  for (const point of series) {
    const date = typeof point?.date === 'string' ? point.date.slice(0, 10) : null;
    const value = toFiniteNumber(point?.value);
    if (!date || value == null) continue;
    map.set(date, (map.get(date) ?? 0) + value);
  }

  return map.size ? map : null;
}

function sortedSeriesFromMap(map) {
  if (!map || map.size === 0) return null;

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: round2(value) }));
}

function sumSeriesMaps(maps) {
  const availableMaps = maps.filter(Boolean);
  if (availableMaps.length === 0) return null;

  const combined = new Map();
  for (const map of availableMaps) {
    for (const [date, value] of map.entries()) {
      combined.set(date, (combined.get(date) ?? 0) + value);
    }
  }

  return sortedSeriesFromMap(combined);
}

function sumAvailableMetricSeries(metrics) {
  const availableMetrics = metrics.filter((metric) => metric.available);
  if (availableMetrics.length === 0) return null;
  if (availableMetrics.some((metric) => !Array.isArray(metric.series))) return null;

  return sumSeriesMaps(availableMetrics.map((metric) => buildSeriesMap(metric.series)));
}

function singleAvailableMetricSeries(metric) {
  if (!metric.available) return null;
  return Array.isArray(metric.series) ? metric.series : null;
}

function ratioSeries(numeratorSeries, denominatorSeries) {
  const numeratorMap = buildSeriesMap(numeratorSeries);
  const denominatorMap = buildSeriesMap(denominatorSeries);
  if (!numeratorMap || !denominatorMap) return null;

  const dates = [...new Set([...numeratorMap.keys(), ...denominatorMap.keys()])].sort();

  return dates.map((date) => {
    const denominator = denominatorMap.get(date);
    const numerator = numeratorMap.get(date);

    return {
      date,
      value:
        Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
          ? round2(numerator / denominator)
          : null,
    };
  });
}

function sumAvailableMetrics(metrics) {
  const availableMetrics = metrics.filter((metric) => metric.available);

  if (availableMetrics.length === 0) {
    return {
      available: false,
      value: null,
      previousAvailable: false,
      previousValue: null,
    };
  }

  const previousAvailable = availableMetrics.every((metric) => metric.previousAvailable);

  return {
    available: true,
    value: round2(availableMetrics.reduce((total, metric) => total + metric.value, 0)),
    previousAvailable,
    previousValue: previousAvailable
      ? round2(availableMetrics.reduce((total, metric) => total + metric.previousValue, 0))
      : null,
  };
}

function divideMetrics(numerator, denominator) {
  if (!numerator.available || !denominator.available || denominator.value === 0) {
    return {
      available: false,
      value: null,
      previousAvailable: false,
      previousValue: null,
    };
  }

  const previousAvailable =
    numerator.previousAvailable &&
    denominator.previousAvailable &&
    denominator.previousValue !== 0;

  return {
    available: true,
    value: round2(numerator.value / denominator.value),
    previousAvailable,
    previousValue: previousAvailable
      ? round2(numerator.previousValue / denominator.previousValue)
      : null,
  };
}

export function buildAggregateMetricValues(providerData = {}) {
  const metaSpend = readSummaryMetric(providerData, 'meta_ads', 'meta_amount_spent');
  const googleSpend = readSummaryMetric(providerData, 'google_ads', 'google_cost');
  const totalAdSpend = sumAvailableMetrics([metaSpend, googleSpend]);

  const metaAttributedValue = readSummaryMetric(
    providerData,
    'meta_ads',
    'meta_purchase_conversion_value'
  );
  const googleAttributedValue = readSummaryMetric(
    providerData,
    'google_ads',
    'google_conversion_value'
  );
  const totalAttributedConversionValue = sumAvailableMetrics([
    metaAttributedValue,
    googleAttributedValue,
  ]);

  const metaConversions = readSummaryMetric(providerData, 'meta_ads', 'meta_purchases');
  const googleConversions = readSummaryMetric(providerData, 'google_ads', 'google_conversions');
  const attributedConversions = sumAvailableMetrics([metaConversions, googleConversions]);

  const totalSales = readSummaryMetric(providerData, 'shopify', 'shopify_total_sales');
  const orders = readSummaryMetric(providerData, 'shopify', 'shopify_orders');
  const averageOrderValue = readSummaryMetric(
    providerData,
    'shopify',
    'shopify_average_order_value'
  );

  return {
    total_ad_spend: totalAdSpend,
    total_attributed_conversion_value: totalAttributedConversionValue,
    blended_roas: divideMetrics(totalAttributedConversionValue, totalAdSpend),
    total_sales: totalSales,
    mer: divideMetrics(totalSales, totalAdSpend),
    attributed_conversions: attributedConversions,
    orders,
    cpa_blended: divideMetrics(totalAdSpend, attributedConversions),
    cost_per_order: divideMetrics(totalAdSpend, orders),
    average_order_value: averageOrderValue,
  };
}

export function buildAggregateSparklineSeries(providerData = {}) {
  const metaSpend = readAvailableMetricSeries(
    providerData,
    'meta_ads',
    'meta_amount_spent'
  );
  const googleSpend = readAvailableMetricSeries(providerData, 'google_ads', 'google_cost');
  const totalAdSpend = sumAvailableMetricSeries([metaSpend, googleSpend]);

  const metaAttributedValue = readAvailableMetricSeries(
    providerData,
    'meta_ads',
    'meta_purchase_conversion_value'
  );
  const googleAttributedValue = readAvailableMetricSeries(
    providerData,
    'google_ads',
    'google_conversion_value'
  );
  const totalAttributedConversionValue = sumAvailableMetricSeries([
    metaAttributedValue,
    googleAttributedValue,
  ]);

  const metaConversions = readAvailableMetricSeries(providerData, 'meta_ads', 'meta_purchases');
  const googleConversions = readAvailableMetricSeries(
    providerData,
    'google_ads',
    'google_conversions'
  );
  const attributedConversions = sumAvailableMetricSeries([metaConversions, googleConversions]);

  const totalSales = singleAvailableMetricSeries(
    readAvailableMetricSeries(providerData, 'shopify', 'shopify_total_sales')
  );
  const orders = singleAvailableMetricSeries(
    readAvailableMetricSeries(providerData, 'shopify', 'shopify_orders')
  );
  const shopifyAov = singleAvailableMetricSeries(
    readAvailableMetricSeries(providerData, 'shopify', 'shopify_average_order_value')
  );

  return {
    total_ad_spend: totalAdSpend,
    total_attributed_conversion_value: totalAttributedConversionValue,
    blended_roas: ratioSeries(totalAttributedConversionValue, totalAdSpend),
    total_sales: totalSales,
    mer: ratioSeries(totalSales, totalAdSpend),
    attributed_conversions: attributedConversions,
    orders,
    cpa_blended: ratioSeries(totalAdSpend, attributedConversions),
    cost_per_order: ratioSeries(totalAdSpend, orders),
    average_order_value: shopifyAov ?? ratioSeries(totalSales, orders),
  };
}

function resolveAggregateCurrency(providerData, unit) {
  if (unit !== 'currency') return null;

  for (const provider of AGGREGATE_PROVIDER_ORDER) {
    const currency = providerData?.[provider]?.meta?.currency;

    if (typeof currency === 'string' && currency.trim()) {
      return currency.trim().toUpperCase();
    }
  }

  return CURRENCY_DEFAULT;
}

function buildAggregateCard({ definition, index, metric, providerData, series }) {
  const currency = resolveAggregateCurrency(providerData, definition.unit);
  const value = metric?.available ? metric.value : null;
  const comparison =
    metric?.available && metric.previousAvailable
      ? compareMetricValues(metric.value, metric.previousValue)
      : null;

  return {
    key: definition.key,
    label: definition.label,
    value,
    formattedValue: metric?.available
      ? formatMetricValue(value, definition.unit, { currency })
      : 'Non disponibile',
    unit: definition.unit,
    comparison,
    sourceProvider: 'overview',
    provider: 'overview',
    providerLabel: 'Overview',
    providerLogoKey: 'overview',
    currency,
    sparkline: maybeBuildSparkline(series, definition.unit, { currency }),
    priority: index + 1,
    help: {
      title: definition.label,
      description: definition.description,
      formula: definition.formula,
    },
    availability: {
      status: metric?.available ? 'available' : 'not_available',
      message: null,
    },
  };
}

export function buildAggregateOverviewCards(providerData = {}, { warnings = [], meta = {} } = {}) {
  const metrics = buildAggregateMetricValues(providerData);
  const seriesByMetricKey = buildAggregateSparklineSeries(providerData);
  const mainCards = AGGREGATE_OVERVIEW_DEFINITIONS.map((definition, index) => {
    return buildAggregateCard({
      definition,
      index,
      metric: metrics[definition.key],
      providerData,
      series: seriesByMetricKey[definition.key],
    });
  });

  return {
    mainCards,
    aggregateCompleteness: buildAggregateCompleteness(providerData, warnings, meta),
  };
}

function findPreviousCustomMetric(previousResult, metricKey) {
  return toList(previousResult?.metrics).find((metric) => metric?.key === metricKey) ?? null;
}

function customMetricSources(metric) {
  return toList(metric?.variableDefinitions).map((variable) => ({
    variableKey: variable.variableKey,
    sourceProvider: variable.sourceProvider,
    metricKey: variable.metricKey,
  }));
}

export function buildCustomMetricCards(customMetricsResult = {}, { previousResult = null } = {}) {
  return toList(customMetricsResult?.metrics).map((metric, index) => {
    const isAvailable = metric?.status === 'ok';
    const unit = metric?.unit ?? 'number';
    const previousMetric = findPreviousCustomMetric(previousResult, metric?.key);
    const previousValue = previousMetric?.status === 'ok' ? toFiniteNumber(previousMetric.value) : null;
    const comparison = isAvailable && previousValue != null
      ? compareMetricValues(metric.value, previousValue)
      : null;
    const currency = unit === 'currency' ? CURRENCY_DEFAULT : null;
    const sources = customMetricSources(metric);

    return {
      key: metric?.key ?? null,
      label: metric?.label ?? metric?.key ?? 'Metrica custom',
      description: metric?.description ?? null,
      previousValue,
      formattedPreviousValue: formatMetricValue(previousValue, unit, { currency: currency ?? CURRENCY_DEFAULT }),
      delta: comparison?.delta ?? null,
      deltaPercentage: comparison?.deltaPercentage ?? null,
      trend: comparison?.trend ?? null,
      comparison,
      formula: metric?.formula ?? null,
      formulaLabel: metric?.formula ?? null,
      enabled: metric?.enabled !== false,
      value: isAvailable ? metric.value : null,
      formattedValue: isAvailable
        ? formatMetricValue(metric.value, unit, { currency: currency ?? CURRENCY_DEFAULT })
        : 'Non disponibile',
      unit,
      currency,
      variables: metric?.variableDefinitions ?? [],
      resolvedVariables: metric?.variables ?? {},
      sources,
      warnings: toList(customMetricsResult?.warnings).filter((warning) => warning?.metricKey === metric?.key),
      status: metric?.status ?? 'error',
      errorCode: metric?.errorCode ?? null,
      sourceProvider: 'custom_metric',
      provider: 'custom_metric',
      providerLabel: 'Custom Metric',
      providerLogoKey: 'custom_metric',
      providerContext: metric?.providerContext ?? 'mixed',
      priority: index + 1,
      sparkline: null,
      help: {
        title: metric?.label ?? metric?.key ?? 'Metrica custom',
        description: metric?.description ?? null,
        formula: metric?.formula ?? null,
      },
      availability: {
        status: isAvailable ? 'available' : 'not_available',
        message: isAvailable
          ? null
          : 'Metrica custom non disponibile per questo periodo.',
      },
    };
  });
}

function resolveMetricKey(summary, definition) {
  if (hasOwn(summary, definition.key)) {
    return definition.key;
  }

  const legacyKeys = toList(definition.legacyKeys);
  return legacyKeys.find((key) => hasOwn(summary, key)) ?? definition.key;
}

function isValidTrend(trend) {
  return trend === 'up' || trend === 'down' || trend === 'flat';
}

function hasWarningCode(warnings, code) {
  return warnings.some((warning) => warning?.code === code);
}

function getProviderWarnings(warnings, provider) {
  return toList(warnings).filter((warning) => {
    return warning?.provider === provider || warning?.scope === provider;
  });
}

function getStatusWarning(providerWarnings, status) {
  const code = PROVIDER_STATUS_WARNING_CODES[status];
  if (!code) return null;
  return providerWarnings.find((warning) => warning?.code === code) ?? null;
}

function resolveProviderStatus({ provider, providerResult, providerWarnings, meta }) {
  const availableProviders = toList(meta?.availableProviders);
  const failedProviders = toList(meta?.failedProviders);
  const attemptedProviders = toList(meta?.attemptedProviders);

  if (providerResult || availableProviders.includes(provider)) {
    return PROVIDER_STATUS.AVAILABLE;
  }

  if (
    failedProviders.includes(provider) ||
    hasWarningCode(providerWarnings, PROVIDER_STATUS_WARNING_CODES[PROVIDER_STATUS.FAILED])
  ) {
    return PROVIDER_STATUS.FAILED;
  }

  if (hasWarningCode(providerWarnings, PROVIDER_STATUS_WARNING_CODES[PROVIDER_STATUS.INCOMPLETE])) {
    return PROVIDER_STATUS.INCOMPLETE;
  }

  if (
    hasWarningCode(providerWarnings, PROVIDER_STATUS_WARNING_CODES[PROVIDER_STATUS.NOT_CONNECTED])
  ) {
    return PROVIDER_STATUS.NOT_CONNECTED;
  }

  if (attemptedProviders.includes(provider)) {
    return PROVIDER_STATUS.FAILED;
  }

  return PROVIDER_STATUS.NOT_CONNECTED;
}

function resolveProviderMessage({ providerLabel, status, providerWarnings }) {
  if (status === PROVIDER_STATUS.AVAILABLE) return null;

  const statusWarning = getStatusWarning(providerWarnings, status);
  if (statusWarning?.message) return statusWarning.message;

  if (status === PROVIDER_STATUS.INCOMPLETE) {
    return `${providerLabel} è collegato, ma la configurazione non è completa. Ricollega l'account dalla sezione Integrazioni.`;
  }

  if (status === PROVIDER_STATUS.FAILED) {
    return `Impossibile caricare i dati ${providerLabel}`;
  }

  return `${providerLabel} non è collegato`;
}

function resolveCurrency(providerResult) {
  const currency = providerResult?.meta?.currency;
  if (typeof currency === 'string' && currency.trim()) {
    return currency.trim().toUpperCase();
  }

  return CURRENCY_DEFAULT;
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

export function formatMetricValue(value, unit, { currency = CURRENCY_DEFAULT } = {}) {
  if (value == null) return null;

  if (typeof value === 'string') {
    return value;
  }

  const numericValue = toFiniteNumber(value);
  if (numericValue == null) return null;

  if (unit === 'currency') {
    return formatCurrency(numericValue, currency);
  }

  if (unit === 'percentage') {
    return `${numericValue.toFixed(2)}%`;
  }

  if (unit === 'count') {
    return new Intl.NumberFormat(LOCALE_DEFAULT, {
      maximumFractionDigits: 0,
    }).format(numericValue);
  }

  if (unit === 'number') {
    return new Intl.NumberFormat(LOCALE_DEFAULT, {
      maximumFractionDigits: 2,
    }).format(numericValue);
  }

  if (unit === 'ratio') {
    return numericValue.toFixed(2);
  }

  return String(value);
}

function normalizeComparison(metricComparison) {
  if (!metricComparison || typeof metricComparison !== 'object') {
    return null;
  }

  const currentValue = toFiniteNumber(metricComparison.currentValue);
  const previousValue = toFiniteNumber(metricComparison.previousValue);
  const delta = toFiniteNumber(metricComparison.delta);
  const deltaPercentage =
    metricComparison.deltaPercentage === null
      ? null
      : toFiniteNumber(metricComparison.deltaPercentage);

  if (
    currentValue == null ||
    previousValue == null ||
    delta == null ||
    (metricComparison.deltaPercentage !== null && deltaPercentage == null) ||
    !isValidTrend(metricComparison.trend)
  ) {
    return null;
  }

  return {
    currentValue,
    previousValue,
    delta,
    deltaPercentage,
    trend: metricComparison.trend,
  };
}

function buildCard({
  definition,
  provider,
  providerResult,
  currency,
  priority,
}) {
  const providerLabel = PROVIDER_LABELS[provider];
  const providerLogoKey = PROVIDER_LOGO_KEYS[provider];
  const summary = providerResult?.summary ?? {};
  const metricKey = resolveMetricKey(summary, definition);
  const hasMetric = hasOwn(summary, metricKey);
  const value = hasMetric ? summary[metricKey] : null;
  const formattedValue = formatMetricValue(value, definition.unit, { currency });
  const comparison = normalizeComparison(
    providerResult?.comparison?.[definition.key] ?? providerResult?.comparison?.[metricKey]
  );
  const sparkline = maybeBuildSparkline(
    providerResult?.seriesByMetricKey?.[definition.key],
    definition.unit,
    { currency }
  );

  return {
    key: definition.key,
    label: definition.label,
    value,
    formattedValue,
    unit: definition.unit ?? null,
    comparison,
    sourceProvider: provider,
    provider,
    providerLabel,
    providerLogoKey,
    currency: definition.unit === 'currency' ? currency : null,
    sparkline,
    dashboardPreview: Boolean(definition.dashboardPreview),
    help: definition.help ?? null,
    apiSource: definition.apiSource ?? null,
    sourceType: definition.sourceType ?? null,
    priority,
    availability: {
      status: hasMetric ? 'available' : 'not_available',
      message: hasMetric ? null : `${definition.label} is not available`,
    },
  };
}

function buildCards({ provider, providerResult, currency, type }) {
  const definitions = CARD_DEFINITIONS[provider]?.[type] ?? [];

  return definitions.map((definition, index) => {
    return buildCard({
      definition,
      provider,
      providerResult,
      currency,
      priority: index + 1,
    });
  });
}

function buildShopifyDashboardPreviewCards({ providerResult, currency }) {
  return (CARD_DEFINITIONS.shopify.dashboardPreview ?? []).map((definition, index) => {
    return buildCard({
      definition,
      provider: 'shopify',
      providerResult,
      currency,
      priority: index + 1,
    });
  });
}

function buildMetaAdsDashboardPreviewCards({ providerResult, currency }) {
  return (CARD_DEFINITIONS.meta_ads.dashboardPreview ?? []).map((definition, index) => {
    return buildCard({
      definition,
      provider: 'meta_ads',
      providerResult,
      currency,
      priority: index + 1,
    });
  });
}

function buildGoogleAdsDashboardPreviewCards({ providerResult, currency }) {
  return (CARD_DEFINITIONS.google_ads.dashboardPreview ?? []).map((definition, index) => {
    return buildCard({
      definition,
      provider: 'google_ads',
      providerResult,
      currency,
      priority: index + 1,
    });
  });
}

function buildShopifyMetricCatalog() {
  return {
    primary: SHOPIFY_PRIMARY_KPI_KEYS,
    secondary: SHOPIFY_SECONDARY_KPI_KEYS,
    dashboardPreview: SHOPIFY_DASHBOARD_PREVIEW_KEYS,
  };
}

function buildMetaAdsMetricCatalog() {
  return {
    primary: META_ADS_PRIMARY_KPI_KEYS,
    secondary: META_ADS_SECONDARY_KPI_KEYS,
    dashboardPreview: META_ADS_DASHBOARD_PREVIEW_KEYS,
  };
}

function buildGoogleAdsMetricCatalog() {
  return {
    primary: GOOGLE_ADS_PRIMARY_KPI_KEYS,
    secondary: GOOGLE_ADS_SECONDARY_KPI_KEYS,
    dashboardPreview: GOOGLE_ADS_DASHBOARD_PREVIEW_KEYS,
  };
}

function buildDashboardPreviewCards({ provider, providerResult, currency }) {
  if (provider === 'shopify') {
    return buildShopifyDashboardPreviewCards({ providerResult, currency });
  }

  if (provider === 'meta_ads') {
    return buildMetaAdsDashboardPreviewCards({ providerResult, currency });
  }

  if (provider === 'google_ads') {
    return buildGoogleAdsDashboardPreviewCards({ providerResult, currency });
  }

  return buildCards({ provider, providerResult, currency, type: 'primary' });
}

function shouldHideSecondaryForDashboard(provider) {
  return provider === 'shopify' || provider === 'meta_ads' || provider === 'google_ads';
}

function buildMetricCatalog(provider) {
  if (provider === 'shopify') return buildShopifyMetricCatalog();
  if (provider === 'meta_ads') return buildMetaAdsMetricCatalog();
  if (provider === 'google_ads') return buildGoogleAdsMetricCatalog();
  return null;
}

export function buildProviderSection({
  provider,
  providerResult = null,
  warnings = [],
  meta = {},
  dashboardPreviewOnly = false,
} = {}) {
  const providerLabel = PROVIDER_LABELS[provider] ?? provider;
  const providerLogoKey = PROVIDER_LOGO_KEYS[provider] ?? provider;
  const providerWarnings = getProviderWarnings(warnings, provider);
  const status = resolveProviderStatus({
    provider,
    providerResult,
    providerWarnings,
    meta,
  });
  const message = resolveProviderMessage({
    providerLabel,
    status,
    providerWarnings,
  });
  const currency = resolveCurrency(providerResult);
  const primaryCards =
    status !== PROVIDER_STATUS.AVAILABLE
      ? []
      : dashboardPreviewOnly
        ? buildDashboardPreviewCards({ provider, providerResult, currency })
        : buildCards({ provider, providerResult, currency, type: 'primary' });
  const secondaryCards =
    status !== PROVIDER_STATUS.AVAILABLE || (dashboardPreviewOnly && shouldHideSecondaryForDashboard(provider))
      ? []
      : buildCards({ provider, providerResult, currency, type: 'secondary' });

  return {
    provider,
    providerLabel,
    providerLogoKey,
    status,
    message,
    summary: providerResult?.summary ?? null,
    comparison: providerResult?.comparison ?? null,
    primaryCards,
    secondaryCards,
    warnings: providerWarnings,
    meta: {
      ...(providerResult?.meta ?? {}),
      sourceProvider: provider,
      currency,
      hasData: status === PROVIDER_STATUS.AVAILABLE,
      cardCount: primaryCards.length + secondaryCards.length,
      metricCatalog: buildMetricCatalog(provider),
    },
  };
}

export function buildProviderSections({
  providerData = {},
  warnings = [],
  meta = {},
} = {}) {
  return PROVIDER_ORDER.map((provider) => {
    return buildProviderSection({
      provider,
      providerResult: providerData?.[provider] ?? null,
      warnings,
      meta,
    });
  });
}

export function attachOverviewProviderSections(overviewResult = {}) {
  const aggregateOverview = buildAggregateOverviewCards(overviewResult?.data ?? {}, {
    warnings: overviewResult?.warnings ?? [],
    meta: overviewResult?.meta ?? {},
  });

  return {
    ...overviewResult,
    overview: {
      ...(overviewResult?.overview ?? {}),
      ...aggregateOverview,
    },
    providerSections: buildProviderSections({
      providerData: overviewResult?.data ?? {},
      warnings: overviewResult?.warnings ?? [],
      meta: overviewResult?.meta ?? {},
    }),
    meta: {
      ...(overviewResult?.meta ?? {}),
      providerOrder: PROVIDER_ORDER,
    },
  };
}

export function attachDashboardProviderSections(dashboardResult = {}) {
  const providers = dashboardResult?.dashboard?.providers ?? {};
  const aggregateOverview = buildAggregateOverviewCards(providers, {
    warnings: dashboardResult?.warnings ?? [],
    meta: dashboardResult?.meta ?? {},
  });
  const providerSections = buildProviderSections({
    providerData: providers,
    warnings: dashboardResult?.warnings ?? [],
    meta: dashboardResult?.meta ?? {},
  });

  return {
    ...dashboardResult,
    dashboard: {
      ...(dashboardResult?.dashboard ?? {}),
      providers,
      overview: {
        ...(dashboardResult?.dashboard?.overview ?? {}),
        ...aggregateOverview,
      },
      providerSections,
    },
    meta: {
      ...(dashboardResult?.meta ?? {}),
      providerOrder: PROVIDER_ORDER,
    },
  };
}
