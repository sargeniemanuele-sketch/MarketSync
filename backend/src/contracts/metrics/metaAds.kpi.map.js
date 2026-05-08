export const META_ADS_INSIGHTS_URL =
  'https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights';

export const META_ADS_KPI_SOURCE = 'Meta Marketing API / Insights';

export const META_ADS_KPI_KEYS = Object.freeze({
  amountSpent: 'meta_amount_spent',
  impressions: 'meta_impressions',
  reach: 'meta_reach',
  frequency: 'meta_frequency',
  clicks: 'meta_clicks',
  linkClicks: 'meta_link_clicks',
  outboundClicks: 'meta_outbound_clicks',
  ctr: 'meta_ctr',
  cpc: 'meta_cpc',
  cpm: 'meta_cpm',
  purchases: 'meta_purchases',
  costPerPurchase: 'meta_cost_per_purchase',
  purchaseConversionValue: 'meta_purchase_conversion_value',
  purchaseRoas: 'meta_purchase_roas',
  costPerOutboundClick: 'meta_cost_per_outbound_click',
});

export const META_ADS_DASHBOARD_PREVIEW_KEYS = Object.freeze([
  META_ADS_KPI_KEYS.amountSpent,
  META_ADS_KPI_KEYS.purchaseRoas,
  META_ADS_KPI_KEYS.purchases,
  META_ADS_KPI_KEYS.costPerPurchase,
]);

export const META_ADS_PRIMARY_KPI_KEYS = Object.freeze([
  META_ADS_KPI_KEYS.amountSpent,
  META_ADS_KPI_KEYS.purchaseRoas,
  META_ADS_KPI_KEYS.purchases,
  META_ADS_KPI_KEYS.costPerPurchase,
]);

export const META_ADS_SECONDARY_KPI_KEYS = Object.freeze([
  META_ADS_KPI_KEYS.purchaseConversionValue,
  META_ADS_KPI_KEYS.impressions,
  META_ADS_KPI_KEYS.reach,
  META_ADS_KPI_KEYS.frequency,
  META_ADS_KPI_KEYS.clicks,
  META_ADS_KPI_KEYS.linkClicks,
  META_ADS_KPI_KEYS.outboundClicks,
  META_ADS_KPI_KEYS.ctr,
  META_ADS_KPI_KEYS.cpc,
  META_ADS_KPI_KEYS.cpm,
  META_ADS_KPI_KEYS.costPerOutboundClick,
]);

const attributionNote =
  'Il valore dipende dalle impostazioni di attribuzione e dal tracciamento Meta Pixel/CAPI.';

export const META_ADS_KPI_DEFINITIONS = Object.freeze([
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.amountSpent,
    legacyKeys: Object.freeze(['spend', 'meta_spend']),
    officialLabel: 'Amount spent',
    apiSource: 'direct Insights API field',
    apiField: 'spend',
    sourceType: 'direct_insights_field',
    formula: 'Amount spent = spend',
    unit: 'currency',
    descriptionIt: 'Importo totale speso per le campagne Meta Ads nel periodo selezionato.',
    formulaIt: 'Amount spent = campo spend restituito da Meta Insights.',
    dashboardPreview: true,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.impressions,
    legacyKeys: Object.freeze(['impressions']),
    officialLabel: 'Impressions',
    apiSource: 'direct Insights API field',
    apiField: 'impressions',
    sourceType: 'direct_insights_field',
    formula: 'Impressions = impressions',
    unit: 'number',
    descriptionIt: 'Numero di volte in cui le inserzioni sono state visualizzate.',
    formulaIt: 'Impressions = campo impressions restituito da Meta Insights.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.reach,
    legacyKeys: Object.freeze(['reach']),
    officialLabel: 'Reach',
    apiSource: 'direct Insights API field',
    apiField: 'reach',
    sourceType: 'direct_insights_field',
    formula: 'Reach = reach',
    unit: 'number',
    descriptionIt: 'Numero di persone raggiunte dalle inserzioni nel periodo selezionato.',
    formulaIt: 'Reach = campo reach restituito da Meta Insights.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.frequency,
    legacyKeys: Object.freeze(['frequency']),
    officialLabel: 'Frequency',
    apiSource: 'direct Insights API field',
    apiField: 'frequency',
    sourceType: 'direct_insights_field',
    formula: 'Frequency = impressions / reach',
    unit: 'ratio',
    descriptionIt: 'Numero medio di volte in cui ogni persona raggiunta ha visto le inserzioni.',
    formulaIt: 'Frequency = Impressions / Reach.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.clicks,
    legacyKeys: Object.freeze(['clicks']),
    officialLabel: 'Clicks',
    apiSource: 'direct Insights API field',
    apiField: 'clicks',
    sourceType: 'direct_insights_field',
    formula: 'Clicks = clicks',
    unit: 'number',
    descriptionIt: 'Numero totale di click registrati da Meta Ads.',
    formulaIt: 'Clicks = campo clicks restituito da Meta Insights.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.linkClicks,
    legacyKeys: Object.freeze(['link_clicks']),
    officialLabel: 'Link clicks',
    apiSource: 'actions',
    apiField: 'actions[action_type=link_click]',
    sourceType: 'actions',
    formula: 'Link clicks = link click actions from Meta Insights',
    unit: 'number',
    descriptionIt: 'Click sui link delle inserzioni, estratti dalle azioni attribuite da Meta.',
    formulaIt: 'Link clicks = valore actions con action_type link_click.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.outboundClicks,
    legacyKeys: Object.freeze(['outbound_clicks']),
    officialLabel: 'Outbound clicks',
    apiSource: 'outbound_clicks',
    apiField: 'outbound_clicks',
    sourceType: 'direct_insights_field',
    formula: 'Outbound clicks = outbound_clicks',
    unit: 'number',
    descriptionIt: 'Click che portano le persone fuori dalle proprieta Meta.',
    formulaIt: 'Outbound clicks = valore outbound_clicks restituito da Meta Insights.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.ctr,
    legacyKeys: Object.freeze(['ctr']),
    officialLabel: 'CTR',
    apiSource: 'direct Insights API field',
    apiField: 'ctr',
    sourceType: 'direct_insights_field',
    formula: 'CTR = clicks / impressions x 100',
    unit: 'percentage',
    descriptionIt: 'Percentuale di impression che hanno generato un click.',
    formulaIt: 'CTR = Clicks / Impressions x 100.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.cpc,
    legacyKeys: Object.freeze(['cpc']),
    officialLabel: 'CPC',
    apiSource: 'direct Insights API field',
    apiField: 'cpc',
    sourceType: 'direct_insights_field',
    formula: 'CPC = Amount spent / Clicks',
    unit: 'currency',
    descriptionIt: 'Costo medio per click registrato da Meta Ads.',
    formulaIt: 'CPC = Amount spent / Clicks.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.cpm,
    legacyKeys: Object.freeze(['cpm']),
    officialLabel: 'CPM',
    apiSource: 'direct Insights API field',
    apiField: 'cpm',
    sourceType: 'direct_insights_field',
    formula: 'CPM = Amount spent / Impressions x 1000',
    unit: 'currency',
    descriptionIt: 'Costo medio per mille impression.',
    formulaIt: 'CPM = Amount spent / Impressions x 1000.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.purchases,
    legacyKeys: Object.freeze(['purchases', 'meta_purchases']),
    officialLabel: 'Purchases',
    apiSource: 'actions',
    apiField: 'actions[action_type=purchase]',
    sourceType: 'actions',
    formula: 'Purchases = purchase actions from Meta Insights',
    unit: 'number',
    descriptionIt: 'Numero di acquisti attribuiti da Meta Ads nel periodo selezionato.',
    formulaIt: 'Purchases = prima action disponibile tra purchase, omni_purchase, offsite_conversion.fb_pixel_purchase, onsite_conversion.purchase.',
    dashboardPreview: true,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.costPerPurchase,
    legacyKeys: Object.freeze(['cpa']),
    officialLabel: 'Cost per purchase',
    apiSource: 'cost_per_action_type',
    apiField: 'cost_per_action_type[action_type=purchase]',
    sourceType: 'calculated',
    formula: 'Cost per purchase = Amount spent / Purchases',
    unit: 'currency',
    descriptionIt: 'Costo medio per acquisto attribuito da Meta Ads.',
    formulaIt: 'Cost per purchase = Amount spent / Purchases, con campo cost_per_action_type come fonte primaria quando disponibile.',
    dashboardPreview: true,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.purchaseConversionValue,
    legacyKeys: Object.freeze(['purchase_value', 'meta_conversion_value', 'conversion_value']),
    officialLabel: 'Purchase conversion value',
    apiSource: 'action_values',
    apiField: 'action_values[action_type=purchase]',
    sourceType: 'action_values',
    formula: 'Purchase conversion value = purchase value from action_values',
    unit: 'currency',
    descriptionIt: 'Valore economico degli acquisti attribuiti da Meta Ads.',
    formulaIt: 'Purchase conversion value = valore action_values per lo stesso action_type usato sugli acquisti.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.purchaseRoas,
    legacyKeys: Object.freeze(['roas']),
    officialLabel: 'Purchase ROAS',
    apiSource: 'purchase_roas',
    apiField: 'purchase_roas',
    sourceType: 'direct_roas_field',
    formula: 'Purchase ROAS = Purchase conversion value / Amount spent',
    unit: 'ratio',
    descriptionIt: 'Ritorno sulla spesa pubblicitaria calcolato da Meta per gli acquisti attribuiti alle campagne nel periodo selezionato.',
    formulaIt: 'Purchase ROAS = Purchase conversion value / Amount spent.',
    dashboardPreview: true,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
  Object.freeze({
    provider: 'meta_ads',
    internalKey: META_ADS_KPI_KEYS.costPerOutboundClick,
    legacyKeys: Object.freeze(['cpoc']),
    officialLabel: 'Cost per outbound click',
    apiSource: 'cost_per_outbound_click',
    apiField: 'cost_per_outbound_click',
    sourceType: 'calculated',
    formula: 'Cost per outbound click = Amount spent / Outbound clicks',
    unit: 'currency',
    descriptionIt: 'Costo medio per click in uscita dalle proprieta Meta.',
    formulaIt: 'Cost per outbound click = Amount spent / Outbound clicks, con campo cost_per_outbound_click come fonte primaria quando disponibile.',
    dashboardPreview: false,
    sourceDocUrl: META_ADS_INSIGHTS_URL,
  }),
]);

export const META_ADS_KPI_DEFINITION_BY_KEY = Object.freeze(
  Object.fromEntries(META_ADS_KPI_DEFINITIONS.map((definition) => [definition.internalKey, definition]))
);

export function getMetaAdsKpiDefinition(key) {
  return META_ADS_KPI_DEFINITION_BY_KEY[key] ?? null;
}

function buildNote(definition) {
  if (definition.sourceType === 'actions') {
    return 'Il KPI e estratto da actions filtrando gli action_type supportati; la priorita evita doppi conteggi tra action_type sovrapposti.';
  }

  if (definition.sourceType === 'action_values') {
    return `${attributionNote} Usa lo stesso action_type selezionato per Purchases quando presente in action_values; altrimenti applica la priorita di fallback sugli action_type di acquisto supportati.`;
  }

  if (definition.internalKey === META_ADS_KPI_KEYS.purchaseRoas) {
    return `${attributionNote} Usa purchase_roas con lo stesso action_type selezionato per Purchases quando disponibile; se assente viene calcolato come Purchase conversion value / Amount spent.`;
  }

  if (definition.internalKey === META_ADS_KPI_KEYS.costPerPurchase) {
    return 'Usa cost_per_action_type con lo stesso action_type selezionato per Purchases quando disponibile; se assente viene calcolato come Amount spent / Purchases.';
  }

  if (definition.internalKey === META_ADS_KPI_KEYS.costPerOutboundClick) {
    return 'Usa cost_per_outbound_click con action_type outbound_click quando disponibile; se assente viene calcolato come Amount spent / Outbound clicks.';
  }

  return null;
}

export function buildMetaAdsCardDefinition(key) {
  const definition = getMetaAdsKpiDefinition(key);
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
      source: META_ADS_KPI_SOURCE,
      sourceUrl: definition.sourceDocUrl,
      note: buildNote(definition),
    },
    dashboardPreview: definition.dashboardPreview,
    sourceType: definition.sourceType,
    apiSource: definition.apiSource,
    apiField: definition.apiField,
  };
}
