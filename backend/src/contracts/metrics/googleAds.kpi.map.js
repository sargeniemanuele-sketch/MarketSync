export const GOOGLE_ADS_METRICS_URL =
  'https://developers.google.com/google-ads/api/fields/v24/metrics';

export const GOOGLE_ADS_REPORTING_EXAMPLE_URL =
  'https://developers.google.com/google-ads/api/docs/reporting/example';

export const GOOGLE_ADS_KPI_SOURCE = 'Google Ads API v24 / metrics';

export const GOOGLE_ADS_KPI_KEYS = Object.freeze({
  cost: 'google_cost',
  impressions: 'google_impressions',
  clicks: 'google_clicks',
  ctr: 'google_ctr',
  averageCpc: 'google_avg_cpc',
  averageCpm: 'google_avg_cpm',
  conversions: 'google_conversions',
  costPerConversion: 'google_cost_per_conversion',
  conversionRate: 'google_conversion_rate',
  conversionValue: 'google_conversion_value',
  roas: 'google_roas',
  allConversions: 'google_all_conversions',
  allConversionValue: 'google_all_conversion_value',
  allConversionRate: 'google_all_conversion_rate',
  allRoas: 'google_all_roas',
});

export const GOOGLE_ADS_DASHBOARD_PREVIEW_KEYS = Object.freeze([
  GOOGLE_ADS_KPI_KEYS.cost,
  GOOGLE_ADS_KPI_KEYS.roas,
  GOOGLE_ADS_KPI_KEYS.conversions,
  GOOGLE_ADS_KPI_KEYS.costPerConversion,
]);

export const GOOGLE_ADS_PRIMARY_KPI_KEYS = Object.freeze([
  GOOGLE_ADS_KPI_KEYS.cost,
  GOOGLE_ADS_KPI_KEYS.roas,
  GOOGLE_ADS_KPI_KEYS.conversions,
  GOOGLE_ADS_KPI_KEYS.costPerConversion,
]);

export const GOOGLE_ADS_SECONDARY_KPI_KEYS = Object.freeze([
  GOOGLE_ADS_KPI_KEYS.conversionValue,
  GOOGLE_ADS_KPI_KEYS.impressions,
  GOOGLE_ADS_KPI_KEYS.clicks,
  GOOGLE_ADS_KPI_KEYS.ctr,
  GOOGLE_ADS_KPI_KEYS.averageCpc,
  GOOGLE_ADS_KPI_KEYS.averageCpm,
  GOOGLE_ADS_KPI_KEYS.conversionRate,
  GOOGLE_ADS_KPI_KEYS.allConversions,
  GOOGLE_ADS_KPI_KEYS.allConversionValue,
  GOOGLE_ADS_KPI_KEYS.allConversionRate,
  GOOGLE_ADS_KPI_KEYS.allRoas,
]);

export const GOOGLE_ADS_REQUIRED_GAQL_FIELDS = Object.freeze([
  'segments.date',
  'metrics.cost_micros',
  'metrics.impressions',
  'metrics.clicks',
  'metrics.ctr',
  'metrics.average_cpc',
  'metrics.average_cpm',
  'metrics.conversions',
  'metrics.cost_per_conversion',
  'metrics.conversions_from_interactions_rate',
  'metrics.conversions_value',
  'metrics.all_conversions',
  'metrics.all_conversions_value',
  'metrics.all_conversions_from_interactions_rate',
]);

export const GOOGLE_ADS_KPI_DEFINITIONS = Object.freeze([
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.cost,
    legacyKeys: Object.freeze(['cost', 'google_spend']),
    officialLabel: 'Cost',
    apiSource: 'metrics.cost_micros / 1_000_000',
    apiField: 'metrics.cost_micros',
    sourceType: 'micros_field',
    formula: 'Cost = metrics.cost_micros / 1_000_000',
    unit: 'currency',
    descriptionIt: 'Costo totale degli ad interactions nel periodo selezionato secondo Google Ads.',
    formulaIt: 'Cost = metrics.cost_micros diviso 1.000.000.',
    dashboardPreview: true,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.impressions,
    legacyKeys: Object.freeze(['impressions']),
    officialLabel: 'Impressions',
    apiSource: 'metrics.impressions',
    apiField: 'metrics.impressions',
    sourceType: 'direct_metrics_field',
    formula: 'Impressions = metrics.impressions',
    unit: 'number',
    descriptionIt: 'Numero di volte in cui gli annunci sono stati visualizzati.',
    formulaIt: 'Impressions = campo metrics.impressions.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.clicks,
    legacyKeys: Object.freeze(['clicks']),
    officialLabel: 'Clicks',
    apiSource: 'metrics.clicks',
    apiField: 'metrics.clicks',
    sourceType: 'direct_metrics_field',
    formula: 'Clicks = metrics.clicks',
    unit: 'number',
    descriptionIt: 'Numero di click registrati da Google Ads.',
    formulaIt: 'Clicks = campo metrics.clicks.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.ctr,
    legacyKeys: Object.freeze(['ctr']),
    officialLabel: 'CTR',
    apiSource: 'metrics.ctr',
    apiField: 'metrics.ctr',
    sourceType: 'direct_metrics_field',
    formula: 'CTR = Clicks / Impressions',
    unit: 'percentage',
    descriptionIt: 'Percentuale di impression che hanno generato un click.',
    formulaIt: 'CTR = Clicks / Impressions. Il valore API decimale viene convertito in percentuale per il formatter.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.averageCpc,
    legacyKeys: Object.freeze(['average_cpc']),
    officialLabel: 'Avg. CPC',
    apiSource: 'metrics.average_cpc / 1_000_000',
    apiField: 'metrics.average_cpc',
    sourceType: 'micros_field',
    formula: 'Avg. CPC = metrics.average_cpc / 1_000_000',
    unit: 'currency',
    descriptionIt: 'Costo medio per click nel periodo selezionato secondo Google Ads.',
    formulaIt: 'Avg. CPC = metrics.average_cpc diviso 1.000.000.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.averageCpm,
    legacyKeys: Object.freeze(['average_cpm', 'cpm']),
    officialLabel: 'Avg. CPM',
    apiSource: 'metrics.average_cpm / 1_000_000',
    apiField: 'metrics.average_cpm',
    sourceType: 'micros_field',
    formula: 'Avg. CPM = metrics.average_cpm / 1_000_000',
    unit: 'currency',
    descriptionIt: 'Costo medio per mille impression nel periodo selezionato secondo Google Ads.',
    formulaIt: 'Avg. CPM = metrics.average_cpm diviso 1.000.000.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.conversions,
    legacyKeys: Object.freeze(['conversions']),
    officialLabel: 'Conversions',
    apiSource: 'metrics.conversions',
    apiField: 'metrics.conversions',
    sourceType: 'direct_metrics_field',
    formula: 'Conversions = metrics.conversions',
    unit: 'number',
    descriptionIt: 'Conversioni incluse nella colonna Conversions di Google Ads.',
    formulaIt: 'Conversions = campo metrics.conversions.',
    dashboardPreview: true,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.costPerConversion,
    legacyKeys: Object.freeze(['cpa']),
    officialLabel: 'Cost / conv.',
    apiSource: 'metrics.cost_per_conversion / 1_000_000',
    apiField: 'metrics.cost_per_conversion',
    sourceType: 'micros_field',
    formula: 'Cost / conv. = Cost / Conversions',
    unit: 'currency',
    descriptionIt: 'Costo medio per conversione nel periodo selezionato secondo Google Ads.',
    formulaIt: 'Cost / conv. = Cost / Conversions; fonte primaria metrics.cost_per_conversion divisa per 1.000.000.',
    dashboardPreview: true,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.conversionRate,
    legacyKeys: Object.freeze(['conversion_rate']),
    officialLabel: 'Conv. rate',
    apiSource: 'metrics.conversions_from_interactions_rate',
    apiField: 'metrics.conversions_from_interactions_rate',
    sourceType: 'direct_metrics_field',
    formula: 'Conv. rate = metrics.conversions_from_interactions_rate',
    unit: 'percentage',
    descriptionIt: 'Tasso di conversione da interazioni registrato da Google Ads.',
    formulaIt: 'Conv. rate = metrics.conversions_from_interactions_rate. Il valore API decimale viene convertito in percentuale per il formatter.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.conversionValue,
    legacyKeys: Object.freeze(['conversions_value']),
    officialLabel: 'Conv. value',
    apiSource: 'metrics.conversions_value',
    apiField: 'metrics.conversions_value',
    sourceType: 'direct_metrics_field',
    formula: 'Conv. value = metrics.conversions_value',
    unit: 'currency',
    descriptionIt: 'Valore economico delle conversioni incluse nella colonna Conversions.',
    formulaIt: 'Conv. value = campo metrics.conversions_value.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.roas,
    legacyKeys: Object.freeze(['roas']),
    officialLabel: 'ROAS',
    apiSource: 'calculated from metrics.conversions_value and metrics.cost_micros',
    apiField: null,
    sourceType: 'calculated',
    formula: 'ROAS = Conv. value / Cost',
    unit: 'ratio',
    descriptionIt: 'Ritorno sulla spesa pubblicitaria calcolato dal valore conversioni e dal costo.',
    formulaIt: 'ROAS = Conv. value / Cost.',
    dashboardPreview: true,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.allConversions,
    legacyKeys: Object.freeze(['all_conversions']),
    officialLabel: 'All conv.',
    apiSource: 'metrics.all_conversions',
    apiField: 'metrics.all_conversions',
    sourceType: 'direct_metrics_field',
    formula: 'All conv. = metrics.all_conversions',
    unit: 'number',
    descriptionIt: 'Tutte le conversioni registrate da Google Ads, incluse quelle non inserite nella colonna Conversions.',
    formulaIt: 'All conv. = campo metrics.all_conversions.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.allConversionValue,
    legacyKeys: Object.freeze(['all_conversion_value']),
    officialLabel: 'All conv. value',
    apiSource: 'metrics.all_conversions_value',
    apiField: 'metrics.all_conversions_value',
    sourceType: 'direct_metrics_field',
    formula: 'All conv. value = metrics.all_conversions_value',
    unit: 'currency',
    descriptionIt: 'Valore economico di tutte le conversioni registrate da Google Ads.',
    formulaIt: 'All conv. value = campo metrics.all_conversions_value.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.allConversionRate,
    legacyKeys: Object.freeze([]),
    officialLabel: 'All conv. rate',
    apiSource: 'metrics.all_conversions_from_interactions_rate',
    apiField: 'metrics.all_conversions_from_interactions_rate',
    sourceType: 'direct_metrics_field',
    formula: 'All conv. rate = metrics.all_conversions_from_interactions_rate',
    unit: 'percentage',
    descriptionIt: 'Tasso di tutte le conversioni rispetto alle interazioni registrato da Google Ads.',
    formulaIt: 'All conv. rate = metrics.all_conversions_from_interactions_rate. Il valore API decimale viene convertito in percentuale per il formatter.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
  Object.freeze({
    provider: 'google_ads',
    internalKey: GOOGLE_ADS_KPI_KEYS.allRoas,
    legacyKeys: Object.freeze(['all_roas']),
    officialLabel: 'All ROAS',
    apiSource: 'calculated from metrics.all_conversions_value and metrics.cost_micros',
    apiField: null,
    sourceType: 'calculated',
    formula: 'All ROAS = All conv. value / Cost',
    unit: 'ratio',
    descriptionIt: 'Ritorno sulla spesa pubblicitaria calcolato sul valore di tutte le conversioni.',
    formulaIt: 'All ROAS = All conv. value / Cost.',
    dashboardPreview: false,
    sourceDocUrl: GOOGLE_ADS_METRICS_URL,
  }),
]);

export const GOOGLE_ADS_KPI_DEFINITION_BY_KEY = Object.freeze(
  Object.fromEntries(GOOGLE_ADS_KPI_DEFINITIONS.map((definition) => [definition.internalKey, definition]))
);

export function getGoogleAdsKpiDefinition(key) {
  return GOOGLE_ADS_KPI_DEFINITION_BY_KEY[key] ?? null;
}

function buildNote(definition) {
  if (definition.internalKey === GOOGLE_ADS_KPI_KEYS.costPerConversion) {
    return 'Se metrics.cost_per_conversion non e disponibile, viene calcolato come Cost / Conversions.';
  }

  if (definition.internalKey === GOOGLE_ADS_KPI_KEYS.roas) {
    return 'KPI calcolato internamente: Google Ads API v24 espone Cost e Conv. value, MarketSync calcola il rapporto.';
  }

  if (definition.internalKey === GOOGLE_ADS_KPI_KEYS.allRoas) {
    return 'KPI calcolato internamente: Google Ads API v24 espone Cost e All conv. value, MarketSync calcola il rapporto.';
  }

  if (definition.unit === 'percentage') {
    return 'Google Ads API restituisce rate come decimali; MarketSync li converte in punti percentuali una sola volta prima della formattazione.';
  }

  if (definition.sourceType === 'micros_field') {
    return 'Il valore monetario Google Ads in micros viene diviso per 1.000.000 prima di essere esposto al frontend.';
  }

  return null;
}

export function buildGoogleAdsCardDefinition(key) {
  const definition = getGoogleAdsKpiDefinition(key);
  if (!definition) return null;

  return {
    key: definition.internalKey,
    label: definition.officialLabel,
    unit: definition.unit,
    legacyKeys: definition.legacyKeys,
    help: {
      title: definition.officialLabel,
      description: definition.descriptionIt,
      formula: definition.formula,
      formulaIt: definition.formulaIt,
      source: GOOGLE_ADS_KPI_SOURCE,
      sourceUrl: definition.sourceDocUrl,
      note: buildNote(definition),
    },
    dashboardPreview: definition.dashboardPreview,
    sourceType: definition.sourceType,
    apiSource: definition.apiSource,
    apiField: definition.apiField,
  };
}
