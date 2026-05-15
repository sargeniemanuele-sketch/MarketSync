import { PROVIDER_KEYS } from "./constants.js";

function sourceMetric(
  sourceProvider,
  metricKey,
  label,
  unit = null,
  description = null,
  isLegacy = false,
  isHiddenFromBuilder = false,
) {
  return {
    sourceProvider,
    metricKey,
    label,
    unit,
    description,
    isLegacy,
    isHiddenFromBuilder,
  };
}

function withLegacy(sourceProvider, metricKey, label, unit, description, legacyKeys = []) {
  return [
    sourceMetric(sourceProvider, metricKey, label, unit, description, false),
    ...legacyKeys.map((legacyKey) =>
      sourceMetric(sourceProvider, legacyKey, `${label} (legacy)`, unit, description, true),
    ),
  ];
}

const SHOPIFY_SOURCE_METRICS = [
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_gross_sales", "Gross sales", "currency", "Vendite lorde Shopify.", ["gross_sales"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_discounts", "Discounts", "currency", "Sconti Shopify.", ["discounts"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_returns", "Returns", "currency", "Resi Shopify.", ["returns"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_net_sales", "Net sales", "currency", "Vendite nette Shopify.", ["net_sales"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_shipping", "Shipping", "currency", "Spedizioni Shopify.", ["shipping"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_taxes", "Taxes", "currency", "Tasse Shopify.", ["taxes"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_total_sales", "Total sales", "currency", "Vendite totali Shopify.", ["total_sales", "order_revenue"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_orders", "Orders", "number", "Numero ordini Shopify.", ["orders"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_average_order_value", "Average order value", "currency", "Valore medio ordine Shopify.", ["average_order_value"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_units_sold", "Units sold", "number", "Unita vendute.", ["units_sold"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_new_customers", "New customers rate", "percentage", "Percentuale ordini da clienti first-time Shopify.", ["new_customers"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_returning_customers", "Returning customers rate", "percentage", "Percentuale ordini da clienti ricorrenti Shopify.", ["returning_customers"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_new_customer_orders", "New customer orders", "number", "Ordini di nuovi clienti.", ["new_customer_orders"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_returning_customer_orders", "Returning customer orders", "number", "Ordini di clienti ricorrenti.", ["returning_customer_orders"]),
  ...withLegacy(PROVIDER_KEYS.shopify, "shopify_refunded_amount", "Refunded amount", "currency", "Importo rimborsato.", ["refunded_amount"]),
];

const META_ADS_SOURCE_METRICS = [
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_amount_spent", "Amount spent", "currency", "Spesa Meta Ads.", ["spend", "meta_spend"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_impressions", "Impressions", "number", "Impression Meta Ads.", ["impressions"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_reach", "Reach", "number", "Copertura Meta Ads.", ["reach"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_frequency", "Frequency", "ratio", "Frequenza media Meta Ads.", ["frequency"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_clicks", "Clicks", "number", "Click Meta Ads.", ["clicks"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_link_clicks", "Link clicks", "number", "Click sui link Meta Ads.", ["link_clicks"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_outbound_clicks", "Outbound clicks", "number", "Click in uscita Meta Ads.", ["outbound_clicks"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_ctr", "CTR", "percentage", "CTR Meta Ads.", ["ctr"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_cpc", "CPC", "currency", "Costo per click Meta Ads.", ["cpc"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_cpm", "CPM", "currency", "Costo per mille impression Meta Ads.", ["cpm"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_purchases", "Purchases", "number", "Acquisti attribuiti Meta Ads.", ["purchases", "meta_purchases"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_cost_per_purchase", "Cost per purchase", "currency", "Costo per acquisto Meta Ads.", ["cpa"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_purchase_conversion_value", "Purchase conversion value", "currency", "Valore conversioni Meta Ads.", ["purchase_value", "meta_conversion_value", "conversion_value"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_purchase_roas", "Purchase ROAS", "ratio", "ROAS Meta Ads.", ["roas"]),
  ...withLegacy(PROVIDER_KEYS.meta_ads, "meta_cost_per_outbound_click", "Cost per outbound click", "currency", "Costo per click in uscita Meta Ads.", ["cpoc"]),
];

const GOOGLE_ADS_SOURCE_METRICS = [
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_cost", "Cost", "currency", "Costo Google Ads.", ["cost", "google_spend"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_impressions", "Impressions", "number", "Impression Google Ads.", ["impressions"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_clicks", "Clicks", "number", "Click Google Ads.", ["clicks"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_ctr", "CTR", "percentage", "CTR Google Ads.", ["ctr"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_avg_cpc", "Avg. CPC", "currency", "Costo medio per click Google Ads.", ["average_cpc"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_avg_cpm", "Avg. CPM", "currency", "Costo medio per mille impression Google Ads.", ["average_cpm", "cpm"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_conversions", "Conversions", "number", "Conversioni Google Ads.", ["conversions"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_cost_per_conversion", "Cost / conv.", "currency", "Costo per conversione Google Ads.", ["cpa"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_conversion_rate", "Conv. rate", "percentage", "Tasso di conversione Google Ads.", ["conversion_rate"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_conversion_value", "Conv. value", "currency", "Valore conversioni Google Ads.", ["conversions_value"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_roas", "ROAS", "ratio", "ROAS Google Ads.", ["roas"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_all_conversions", "All conv.", "number", "Tutte le conversioni Google Ads.", ["all_conversions"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_all_conversion_value", "All conv. value", "currency", "Valore di tutte le conversioni Google Ads.", ["all_conversion_value"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_all_conversion_rate", "All conv. rate", "percentage", "Tasso di tutte le conversioni Google Ads.", ["all_conversion_rate"]),
  ...withLegacy(PROVIDER_KEYS.google_ads, "google_all_roas", "All ROAS", "ratio", "ROAS su tutte le conversioni Google Ads.", ["all_roas"]),
  sourceMetric(PROVIDER_KEYS.google_ads, "all_cpa", "All cost / conv. (legacy)", "currency", "Costo per tutte le conversioni Google Ads.", true),
];

const OVERVIEW_SOURCE_METRICS = [
  sourceMetric(PROVIDER_KEYS.overview, "total_ad_spend", "Spesa pubblicitaria totale", "currency", "Somma della spesa pubblicitaria collegata."),
  sourceMetric(PROVIDER_KEYS.overview, "total_attributed_conversion_value", "Valore conversioni attribuito totale", "currency", "Valore conversioni attribuito totale."),
  sourceMetric(PROVIDER_KEYS.overview, "blended_roas", "Blended ROAS", "ratio", "ROAS aggregato tra piattaforme ads."),
  sourceMetric(PROVIDER_KEYS.overview, "total_sales", "Ricavi totali", "currency", "Vendite totali Shopify nel periodo."),
  sourceMetric(PROVIDER_KEYS.overview, "mer", "MER", "ratio", "Rapporto tra vendite totali e spesa ads."),
  sourceMetric(PROVIDER_KEYS.overview, "attributed_conversions", "Conversioni attribuite totali", "number", "Conversioni attribuite totali."),
  sourceMetric(PROVIDER_KEYS.overview, "orders", "Ordini", "number", "Ordini Shopify nel periodo."),
  sourceMetric(PROVIDER_KEYS.overview, "cpa_blended", "CPA blended", "currency", "Costo medio per conversione attribuita."),
  sourceMetric(PROVIDER_KEYS.overview, "cost_per_order", "Costo ads per ordine", "currency", "Costo ads medio per ordine."),
  sourceMetric(PROVIDER_KEYS.overview, "average_order_value", "Valore medio ordine", "currency", "Valore medio ordine Shopify."),
  sourceMetric(PROVIDER_KEYS.overview, "connectedProviders", "Piattaforme collegate", "number", "Piattaforme considerate dalla dashboard.", false, true),
  sourceMetric(PROVIDER_KEYS.overview, "successfulProviders", "Piattaforme disponibili", "number", "Piattaforme caricate correttamente.", false, true),
  sourceMetric(PROVIDER_KEYS.overview, "failedProviders", "Piattaforme non disponibili", "number", "Piattaforme non caricate correttamente.", false, true),
  sourceMetric(PROVIDER_KEYS.overview, "attemptedProvidersCount", "Piattaforme considerate", "number", "Numero piattaforme richieste.", false, true),
  sourceMetric(PROVIDER_KEYS.overview, "availableProvidersCount", "Piattaforme disponibili", "number", "Numero piattaforme con dati disponibili.", false, true),
  sourceMetric(PROVIDER_KEYS.overview, "failedProvidersCount", "Piattaforme non disponibili", "number", "Numero piattaforme non disponibili.", false, true),
  sourceMetric(PROVIDER_KEYS.overview, "warningsCount", "Avvisi dashboard", "number", "Numero avvisi dashboard.", false, true),
];

const CLIENT_SETTING_SOURCE_METRICS = [
  sourceMetric(PROVIDER_KEYS.client_setting, "commission_percentage", "Percentuale commissione", "percentage", "Percentuale di commissione configurata sul cliente."),
  sourceMetric(PROVIDER_KEYS.client_setting, "fixed_commission", "Commissione fissa", "currency", "Commissione fissa configurata sul cliente."),
  sourceMetric(PROVIDER_KEYS.client_setting, "extra_costs_total", "Costi extra fissi totali", "currency", "Somma dei costi extra di tipo fisso configurati sul cliente."),
  sourceMetric(PROVIDER_KEYS.client_setting, "custom_metric_count", "Custom metrics configurate", "number", "Numero totale di metriche custom configurate sul cliente.", false, true),
  sourceMetric(PROVIDER_KEYS.client_setting, "active_custom_metric_count", "Custom metrics attive", "number", "Numero di metriche custom abilitate sul cliente.", false, true),
];

export const CUSTOM_METRIC_SOURCE_CATALOG = Object.freeze({
  [PROVIDER_KEYS.shopify]: Object.freeze(SHOPIFY_SOURCE_METRICS),
  [PROVIDER_KEYS.meta_ads]: Object.freeze(META_ADS_SOURCE_METRICS),
  [PROVIDER_KEYS.google_ads]: Object.freeze(GOOGLE_ADS_SOURCE_METRICS),
  [PROVIDER_KEYS.overview]: Object.freeze(OVERVIEW_SOURCE_METRICS),
  [PROVIDER_KEYS.client_setting]: Object.freeze(CLIENT_SETTING_SOURCE_METRICS),
});

export function getSourceMetrics(sourceProvider) {
  return CUSTOM_METRIC_SOURCE_CATALOG[sourceProvider] ?? [];
}

export function getSourceMetricOptions(sourceProvider) {
  return getSourceMetrics(sourceProvider)
    .filter((metric) => !metric.isLegacy && !metric.isHiddenFromBuilder)
    .map((metric) => ({
      label: metric.label,
      value: metric.metricKey,
      title: metric.metricKey,
    }));
}

export function getSourceMetricDefinition(sourceProvider, metricKey) {
  return getSourceMetrics(sourceProvider).find((metric) => {
    return metric.metricKey === metricKey;
  }) ?? null;
}

export function isSourceMetricAllowed(sourceProvider, metricKey) {
  return Boolean(getSourceMetricDefinition(sourceProvider, metricKey));
}
