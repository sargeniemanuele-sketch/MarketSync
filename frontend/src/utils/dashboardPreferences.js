import { APP_ROUTES, PROVIDER_KEYS } from "./constants.js";
import { normalizeRangeKey } from "./ranges.js";

export const DASHBOARD_PREFERENCES_STORAGE_KEY = "marketsync.dashboardPreferences.v1";
export const LAST_SELECTED_CLIENT = "last_selected";
export const MAX_KPIS_PER_PROVIDER = 4;
export const MAX_CUSTOM_METRICS = 4;

export const DASHBOARD_START_PAGES = {
  dashboard: "dashboard",
  shopify: "shopify",
  meta_ads: "meta_ads",
  google_ads: "google_ads",
  clients: "clients",
};

export const dashboardStartPageRoutes = {
  [DASHBOARD_START_PAGES.dashboard]: APP_ROUTES.dashboard,
  [DASHBOARD_START_PAGES.shopify]: APP_ROUTES.shopify,
  [DASHBOARD_START_PAGES.meta_ads]: APP_ROUTES.meta_ads,
  [DASHBOARD_START_PAGES.google_ads]: APP_ROUTES.google_ads,
  [DASHBOARD_START_PAGES.clients]: APP_ROUTES.clients,
};

export const providerOrder = [
  PROVIDER_KEYS.shopify,
  PROVIDER_KEYS.meta_ads,
  PROVIDER_KEYS.google_ads,
];

export const providerKpiConfig = {
  [PROVIDER_KEYS.shopify]: {
    label: "Shopify",
    defaults: ["shopify_total_sales", "shopify_orders", "shopify_average_order_value", "shopify_gross_sales"],
    kpis: [
      { key: "shopify_total_sales", label: "Total sales", unit: "currency", aliases: ["order_revenue", "total_sales"] },
      { key: "shopify_orders", label: "Orders", unit: "number", aliases: ["orders"] },
      { key: "shopify_returns", label: "Returns", unit: "currency", aliases: ["returns"] },
      { key: "shopify_taxes", label: "Taxes", unit: "currency", aliases: ["taxes"] },
      { key: "shopify_average_order_value", label: "Average order value", unit: "currency", aliases: ["average_order_value"] },
      { key: "shopify_new_customers", label: "New customers rate", unit: "percentage", aliases: ["new_customers"] },
      { key: "shopify_gross_sales", label: "Gross sales", unit: "currency", aliases: ["gross_sales"] },
      { key: "shopify_returning_customers", label: "Returning customers rate", unit: "percentage", aliases: ["returning_customers"] },
      { key: "shopify_units_sold", label: "Units sold", unit: "number", aliases: ["units_sold"] },
      { key: "shopify_discounts", label: "Discounts", unit: "currency", aliases: ["discounts"] },
    ],
  },
  [PROVIDER_KEYS.meta_ads]: {
    label: "Meta Ads",
    defaults: ["meta_amount_spent", "meta_purchase_roas", "meta_cpc", "meta_purchases"],
    kpis: [
      { key: "meta_amount_spent", label: "Amount spent", unit: "currency", aliases: ["spend", "meta_spend"] },
      { key: "meta_purchase_roas", label: "Purchase ROAS", unit: "ratio", aliases: ["roas"] },
      { key: "meta_cpc", label: "CPC", unit: "currency", aliases: ["cpc"] },
      { key: "meta_cpm", label: "CPM", unit: "currency", aliases: ["cpm"] },
      { key: "meta_purchases", label: "Meta purchases", unit: "number", aliases: ["purchases"] },
      { key: "meta_purchase_conversion_value", label: "Purchase conversion value", unit: "currency", aliases: ["purchase_value", "meta_conversion_value", "conversion_value"] },
      { key: "meta_cost_per_outbound_click", label: "Cost per outbound click", unit: "currency", aliases: ["cpoc"] },
      { key: "meta_ctr", label: "CTR", unit: "percentage", aliases: ["ctr"] },
      { key: "meta_cost_per_purchase", label: "Cost per purchase", unit: "currency", aliases: ["cpa"] },
    ],
  },
  [PROVIDER_KEYS.google_ads]: {
    label: "Google Ads",
    defaults: ["google_cost", "google_roas", "google_conversions", "google_cost_per_conversion"],
    kpis: [
      { key: "google_cost", label: "Cost", unit: "currency", aliases: ["cost", "google_spend"] },
      { key: "google_conversion_rate", label: "Conversion rate", unit: "percentage", aliases: ["conversion_rate"] },
      { key: "google_roas", label: "ROAS", unit: "ratio", aliases: ["roas"] },
      { key: "google_conversions", label: "Conversions", unit: "number", aliases: ["conversions"] },
      { key: "google_ctr", label: "CTR", unit: "percentage", aliases: ["ctr"] },
      { key: "google_cost_per_conversion", label: "Cost per conversion", unit: "currency", aliases: ["cpa"] },
      { key: "google_avg_cpm", label: "Avg. CPM", unit: "currency", aliases: ["average_cpm", "cpm"] },
      { key: "google_clicks", label: "Clicks", unit: "number", aliases: ["clicks"] },
      { key: "google_impressions", label: "Impressions", unit: "number", aliases: ["impressions"] },
      { key: "google_all_conversion_value", label: "All conversion value", unit: "currency", aliases: ["all_conversion_value"] },
      { key: "google_all_roas", label: "All ROAS", unit: "ratio", aliases: ["all_roas"] },
      { key: "google_all_conversions", label: "All conversions", unit: "number", aliases: ["all_conversions"] },
    ],
  },
};

const startPageAliases = {
  [APP_ROUTES.dashboard]: DASHBOARD_START_PAGES.dashboard,
  [APP_ROUTES.shopify]: DASHBOARD_START_PAGES.shopify,
  [APP_ROUTES.meta_ads]: DASHBOARD_START_PAGES.meta_ads,
  [APP_ROUTES.google_ads]: DASHBOARD_START_PAGES.google_ads,
  [APP_ROUTES.clients]: DASHBOARD_START_PAGES.clients,
};

const kpiLookups = Object.fromEntries(
  providerOrder.map((providerKey) => [
    providerKey,
    new Map(
      providerKpiConfig[providerKey].kpis.flatMap((kpi) => [
        [kpi.key, kpi],
        ...(kpi.aliases ?? []).map((alias) => [alias, kpi]),
      ]),
    ),
  ]),
);

function clonePreferences(preferences) {
  return {
    ...preferences,
    visibleKpis: Object.fromEntries(
      providerOrder.map((providerKey) => [
        providerKey,
        [...preferences.visibleKpis[providerKey]],
      ]),
    ),
    visibleCustomMetrics: Object.fromEntries(
      Object.entries(preferences.visibleCustomMetrics ?? {}).map(([clientId, metricKeys]) => [
        clientId,
        [...metricKeys],
      ]),
    ),
  };
}

export function getDefaultDashboardPreferences() {
  return clonePreferences({
    defaultClient: LAST_SELECTED_CLIENT,
    defaultRange: "last_30_days",
    startPage: DASHBOARD_START_PAGES.dashboard,
    showDisconnectedProviders: true,
    visibleKpis: Object.fromEntries(
      providerOrder.map((providerKey) => [
        providerKey,
        [...providerKpiConfig[providerKey].defaults],
      ]),
    ),
    visibleCustomMetrics: {},
  });
}

function normalizeStartPage(startPage) {
  if (startPageAliases[startPage]) {
    return startPageAliases[startPage];
  }

  return dashboardStartPageRoutes[startPage]
    ? startPage
    : DASHBOARD_START_PAGES.dashboard;
}

function normalizeProviderKpiSelection(providerKey, selection) {
  const lookup = kpiLookups[providerKey];
  const values = Array.isArray(selection) ? selection : [];
  const seen = new Set();
  const normalized = [];

  for (const key of values) {
    const kpi = lookup.get(key);

    if (!kpi || seen.has(kpi.key)) {
      continue;
    }

    seen.add(kpi.key);
    normalized.push(kpi.key);

    if (normalized.length >= MAX_KPIS_PER_PROVIDER) {
      break;
    }
  }

  return normalized.length > 0
    ? normalized
    : [...providerKpiConfig[providerKey].defaults];
}

function normalizeCustomMetricSelection(selection) {
  const values = Array.isArray(selection) ? selection : [];
  const seen = new Set();
  const normalized = [];

  for (const key of values) {
    if (key === null || key === undefined) {
      continue;
    }

    const normalizedKey = String(key);

    if (!normalizedKey || seen.has(normalizedKey)) {
      continue;
    }

    seen.add(normalizedKey);
    normalized.push(normalizedKey);

    if (normalized.length >= MAX_CUSTOM_METRICS) {
      break;
    }
  }

  return normalized;
}

function normalizeVisibleCustomMetrics(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([clientId, selection]) => [String(clientId), normalizeCustomMetricSelection(selection)])
      .filter(([clientId]) => Boolean(clientId)),
  );
}

export function normalizeDashboardPreferences(value) {
  const defaults = getDefaultDashboardPreferences();
  const source = value && typeof value === "object" ? value : {};
  const rawVisibleKpis = source.visibleKpis ?? source.selectedKpis ?? {};

  return {
    defaultClient: source.defaultClient ?? source.defaultClientId ?? defaults.defaultClient,
    defaultRange: normalizeRangeKey(source.defaultRange ?? source.defaultPeriod, defaults.defaultRange),
    startPage: normalizeStartPage(source.startPage),
    showDisconnectedProviders:
      typeof source.showDisconnectedProviders === "boolean"
        ? source.showDisconnectedProviders
        : defaults.showDisconnectedProviders,
    visibleKpis: Object.fromEntries(
      providerOrder.map((providerKey) => [
        providerKey,
        normalizeProviderKpiSelection(providerKey, rawVisibleKpis[providerKey]),
      ]),
    ),
    visibleCustomMetrics: normalizeVisibleCustomMetrics(source.visibleCustomMetrics),
  };
}

export function getCustomMetricSelectionForClient(clientId, availableMetrics, preferences) {
  const metrics = Array.isArray(availableMetrics) ? availableMetrics : [];
  const availableKeys = metrics
    .map((metric) => metric?.key)
    .filter((key) => key !== null && key !== undefined)
    .map(String);

  if (availableKeys.length <= MAX_CUSTOM_METRICS) {
    return availableKeys;
  }

  const normalizedPreferences = normalizeDashboardPreferences(preferences);
  const normalizedClientId = clientId === null || clientId === undefined ? null : String(clientId);
  const hasClientPreference =
    normalizedClientId &&
    Object.prototype.hasOwnProperty.call(
      normalizedPreferences.visibleCustomMetrics,
      normalizedClientId,
    );

  if (!hasClientPreference) {
    return availableKeys.slice(0, MAX_CUSTOM_METRICS);
  }

  const availableKeySet = new Set(availableKeys);
  const selectedKeys = normalizedPreferences.visibleCustomMetrics[normalizedClientId]
    .filter((key) => availableKeySet.has(key))
    .slice(0, MAX_CUSTOM_METRICS);

  return selectedKeys.length > 0
    ? selectedKeys
    : availableKeys.slice(0, MAX_CUSTOM_METRICS);
}

export function readDashboardPreferences() {
  if (typeof window === "undefined") {
    return getDefaultDashboardPreferences();
  }

  try {
    const rawValue = window.localStorage.getItem(DASHBOARD_PREFERENCES_STORAGE_KEY);
    return normalizeDashboardPreferences(rawValue ? JSON.parse(rawValue) : null);
  } catch {
    return getDefaultDashboardPreferences();
  }
}

export function writeDashboardPreferences(preferences) {
  const normalizedPreferences = normalizeDashboardPreferences(preferences);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        DASHBOARD_PREFERENCES_STORAGE_KEY,
        JSON.stringify(normalizedPreferences),
      );
    } catch {
      // La pagina resta utilizzabile anche se il browser blocca localStorage.
    }
  }

  return normalizedPreferences;
}

function hasOwnMetric(summary, key) {
  return Object.prototype.hasOwnProperty.call(summary ?? {}, key);
}

function readMetricValue(summary, key) {
  return hasOwnMetric(summary, key) ? summary[key] : null;
}

function findExistingCard(cards, kpi) {
  return cards.find((card) => card?.key === kpi.key) ?? null;
}

function buildPreferenceCard(section, kpi, priority) {
  const summary = section?.summary ?? {};
  const comparison = section?.comparison ?? {};
  const value = readMetricValue(summary, kpi.key);
  const hasValue = hasOwnMetric(summary, kpi.key);

  return {
    key: kpi.key,
    label: kpi.label,
    value: hasValue ? value : null,
    unit: kpi.unit ?? null,
    comparison: comparison?.[kpi.key] ?? null,
    currency: kpi.unit === "currency" ? section?.meta?.currency ?? null : null,
    provider: section.provider,
    providerLabel: section.providerLabel,
    providerLogoKey: section.providerLogoKey ?? section.provider,
    priority,
    sourceProvider: section.provider,
    type: "primary",
    help: kpi.help ?? null,
    availability: {
      status: hasValue ? "available" : "not_available",
      message: hasValue ? null : `${kpi.label} non e disponibile per questo periodo.`,
    },
  };
}

export function applyDashboardPreferencesToProviderSection(section, preferences) {
  if (!section?.provider || !providerKpiConfig[section.provider]) {
    return section;
  }

  const normalizedPreferences = normalizeDashboardPreferences(preferences);

  if (
    !normalizedPreferences.showDisconnectedProviders &&
    section.status !== "available" &&
    section.status !== "connected"
  ) {
    return null;
  }

  if (section.status !== "available" && section.status !== "connected") {
    return section;
  }

  const existingCards = [...(section.primaryCards ?? []), ...(section.secondaryCards ?? [])];
  const selectedKpis = normalizedPreferences.visibleKpis[section.provider]
    .map((key) => kpiLookups[section.provider].get(key))
    .filter(Boolean);
  const selectedCards = selectedKpis.map((kpi, index) => {
    const existingCard = findExistingCard(existingCards, kpi);

    if (existingCard) {
      return {
        ...existingCard,
        priority: index + 1,
        type: "primary",
      };
    }

    return buildPreferenceCard(section, kpi, index + 1);
  });

  return {
    ...section,
    primaryCards: selectedCards,
    secondaryCards: [],
    meta: {
      ...(section.meta ?? {}),
      cardCount: selectedCards.length,
    },
  };
}
