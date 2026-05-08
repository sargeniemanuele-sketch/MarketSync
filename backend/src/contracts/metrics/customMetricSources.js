import { AGGREGATE_OVERVIEW_DEFINITIONS } from './cards.js';
import { GOOGLE_ADS_KPI_DEFINITIONS } from './googleAds.kpi.map.js';
import { META_ADS_KPI_DEFINITIONS } from './metaAds.kpi.map.js';
import { SHOPIFY_KPI_DEFINITIONS } from './shopify.kpi.map.js';

export const CUSTOM_METRIC_SOURCE_PROVIDERS = Object.freeze([
  'shopify',
  'meta_ads',
  'google_ads',
  'overview',
  'client_setting',
]);

const OVERVIEW_META_DEFINITIONS = Object.freeze([
  Object.freeze({
    sourceProvider: 'overview',
    metricKey: 'connectedProviders',
    label: 'Piattaforme collegate',
    unit: 'number',
    description: 'Numero di piattaforme considerate nel periodo dashboard.',
  }),
  Object.freeze({
    sourceProvider: 'overview',
    metricKey: 'successfulProviders',
    label: 'Piattaforme disponibili',
    unit: 'number',
    description: 'Numero di piattaforme caricate correttamente.',
  }),
  Object.freeze({
    sourceProvider: 'overview',
    metricKey: 'failedProviders',
    label: 'Piattaforme non disponibili',
    unit: 'number',
    description: 'Numero di piattaforme non caricate correttamente.',
  }),
  Object.freeze({
    sourceProvider: 'overview',
    metricKey: 'attemptedProvidersCount',
    label: 'Piattaforme considerate',
    unit: 'number',
    description: 'Numero di piattaforme richieste.',
  }),
  Object.freeze({
    sourceProvider: 'overview',
    metricKey: 'availableProvidersCount',
    label: 'Piattaforme disponibili',
    unit: 'number',
    description: 'Numero di piattaforme con dati disponibili.',
  }),
  Object.freeze({
    sourceProvider: 'overview',
    metricKey: 'failedProvidersCount',
    label: 'Piattaforme non disponibili',
    unit: 'number',
    description: 'Numero di piattaforme non disponibili.',
  }),
  Object.freeze({
    sourceProvider: 'overview',
    metricKey: 'warningsCount',
    label: 'Avvisi dashboard',
    unit: 'number',
    description: 'Numero di avvisi prodotti dal calcolo dashboard.',
  }),
]);

const EXTRA_PROVIDER_DEFINITIONS = Object.freeze({
  shopify: Object.freeze([
    Object.freeze({
      sourceProvider: 'shopify',
      metricKey: 'order_revenue',
      label: 'Total sales (legacy)',
      unit: 'currency',
      description: 'Alias legacy delle vendite totali Shopify.',
    }),
  ]),
  google_ads: Object.freeze([
    Object.freeze({
      sourceProvider: 'google_ads',
      metricKey: 'all_conversion_rate',
      label: 'All conv. rate (legacy)',
      unit: 'percentage',
      description: 'Alias legacy del tasso di tutte le conversioni Google Ads.',
    }),
    Object.freeze({
      sourceProvider: 'google_ads',
      metricKey: 'all_cpa',
      label: 'All cost / conv. (legacy)',
      unit: 'currency',
      description: 'Alias legacy del costo per tutte le conversioni Google Ads.',
    }),
  ]),
});

const CLIENT_SETTING_DEFINITIONS = freezeDefinitions([
  {
    sourceProvider: 'client_setting',
    metricKey: 'commission_percentage',
    label: 'Percentuale commissione',
    unit: 'percentage',
    description: 'Percentuale di commissione configurata sul cliente (businessSettings).',
  },
  {
    sourceProvider: 'client_setting',
    metricKey: 'fixed_commission',
    label: 'Commissione fissa',
    unit: 'currency',
    description: 'Commissione fissa configurata sul cliente (businessSettings).',
  },
  {
    sourceProvider: 'client_setting',
    metricKey: 'extra_costs_total',
    label: 'Costi extra fissi totali',
    unit: 'currency',
    description: 'Somma dei costi extra di tipo fisso configurati sul cliente (businessSettings.extraCosts).',
  },
  {
    sourceProvider: 'client_setting',
    metricKey: 'custom_metric_count',
    label: 'Custom metrics configurate',
    unit: 'number',
    description: 'Numero totale di metriche custom configurate sul cliente.',
  },
  {
    sourceProvider: 'client_setting',
    metricKey: 'active_custom_metric_count',
    label: 'Custom metrics attive',
    unit: 'number',
    description: 'Numero di metriche custom abilitate sul cliente.',
  },
]);

function freezeDefinitions(definitions) {
  return Object.freeze(definitions.map((definition) => Object.freeze(definition)));
}

function providerDefinitions(provider, definitions) {
  return freezeDefinitions(
    definitions.flatMap((definition) => {
      const base = {
        sourceProvider: provider,
        metricKey: definition.internalKey,
        label: definition.officialLabel,
        unit: definition.unit ?? null,
        description: definition.descriptionIt ?? null,
      };
      const legacyKeys = [
        definition.legacyKey,
        ...(Array.isArray(definition.legacyKeys) ? definition.legacyKeys : []),
      ].filter(Boolean);

      return [
        base,
        ...legacyKeys.map((legacyKey) => ({
          ...base,
          metricKey: legacyKey,
          label: `${definition.officialLabel} (legacy)`,
        })),
      ];
    })
  );
}

function overviewDefinitions() {
  return freezeDefinitions([
    ...AGGREGATE_OVERVIEW_DEFINITIONS.map((definition) => ({
      sourceProvider: 'overview',
      metricKey: definition.key,
      label: definition.label,
      unit: definition.unit ?? null,
      description: definition.description ?? null,
    })),
    ...OVERVIEW_META_DEFINITIONS,
  ]);
}

export const CUSTOM_METRIC_SOURCE_CATALOG = Object.freeze({
  shopify: freezeDefinitions([
    ...providerDefinitions('shopify', SHOPIFY_KPI_DEFINITIONS),
    ...EXTRA_PROVIDER_DEFINITIONS.shopify,
  ]),
  meta_ads: providerDefinitions('meta_ads', META_ADS_KPI_DEFINITIONS),
  google_ads: freezeDefinitions([
    ...providerDefinitions('google_ads', GOOGLE_ADS_KPI_DEFINITIONS),
    ...EXTRA_PROVIDER_DEFINITIONS.google_ads,
  ]),
  overview: overviewDefinitions(),
  client_setting: CLIENT_SETTING_DEFINITIONS,
});

export function getCustomMetricSourceCatalog(sourceProvider) {
  if (sourceProvider) {
    return CUSTOM_METRIC_SOURCE_CATALOG[sourceProvider] ?? [];
  }

  return CUSTOM_METRIC_SOURCE_PROVIDERS.flatMap((provider) => {
    return CUSTOM_METRIC_SOURCE_CATALOG[provider] ?? [];
  });
}

export function isSupportedSourceMetricKey(sourceProvider, metricKey) {
  if (!CUSTOM_METRIC_SOURCE_PROVIDERS.includes(sourceProvider)) {
    return false;
  }

  return (CUSTOM_METRIC_SOURCE_CATALOG[sourceProvider] ?? []).some((definition) => {
    return definition.metricKey === metricKey;
  });
}
