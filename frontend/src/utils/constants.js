export const APP_NAME = "MarketSync";

export const APP_STORAGE_KEYS = {
  selectedClientId: "marketsync:selectedClientId",
  integrationReturn: "marketsync:integrationReturn",
};

export const PROVIDER_KEYS = {
  shopify: "shopify",
  meta_ads: "meta_ads",
  google_ads: "google_ads",
  overview: "overview",
  client_setting: "client_setting",
  custom_metric: "custom_metric",
};

export const APP_ROUTES = {
  root: "/",
  login: "/login",
  register: "/register",
  authCallback: "/auth/callback",
  dashboard: "/dashboard",
  shopify: "/shopify",
  meta_ads: "/meta-ads",
  google_ads: "/google-ads",
  clients: "/clients",
  clientDetail: "/clients/:clientId",
  integrations: "/integrations",
  integrationsCallback: "/integrations/callback",
  customMetrics: "/custom-metrics",
  metricDetail: "/metrics/detail/:provider/:metricKey",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  profile: "/profile",
  settings: "/settings",
  dashboardPreferences: "/settings/dashboard-preferences",
  appearancePreferences: "/settings/appearance",
  privacyData: "/settings/privacy-data",
  permissionsAccess: "/settings/permissions-access",
};

export const PROVIDERS = {
  [PROVIDER_KEYS.shopify]: {
    key: PROVIDER_KEYS.shopify,
    label: "Shopify",
    route: APP_ROUTES.shopify,
  },
  [PROVIDER_KEYS.meta_ads]: {
    key: PROVIDER_KEYS.meta_ads,
    label: "Meta Ads",
    route: APP_ROUTES.meta_ads,
  },
  [PROVIDER_KEYS.google_ads]: {
    key: PROVIDER_KEYS.google_ads,
    label: "Google Ads",
    route: APP_ROUTES.google_ads,
  },
  [PROVIDER_KEYS.overview]: {
    key: PROVIDER_KEYS.overview,
    label: "Overview",
  },
  [PROVIDER_KEYS.custom_metric]: {
    key: PROVIDER_KEYS.custom_metric,
    label: "Metriche custom",
  },
};

export const PROVIDER_ORDER = [
  PROVIDER_KEYS.overview,
  PROVIDER_KEYS.shopify,
  PROVIDER_KEYS.meta_ads,
  PROVIDER_KEYS.google_ads,
];

export const CUSTOM_METRIC_SOURCE_PROVIDERS = [
  PROVIDER_KEYS.overview,
  PROVIDER_KEYS.shopify,
  PROVIDER_KEYS.meta_ads,
  PROVIDER_KEYS.google_ads,
  PROVIDER_KEYS.client_setting,
];

export const CUSTOM_METRIC_SOURCE_LABELS = {
  [PROVIDER_KEYS.shopify]: "Shopify",
  [PROVIDER_KEYS.meta_ads]: "Meta Ads",
  [PROVIDER_KEYS.google_ads]: "Google Ads",
  [PROVIDER_KEYS.overview]: "Overview",
  [PROVIDER_KEYS.client_setting]: "Impostazioni cliente",
};

export const CUSTOM_METRIC_SOURCE_OPTIONS = CUSTOM_METRIC_SOURCE_PROVIDERS.map((key) => ({
  label: CUSTOM_METRIC_SOURCE_LABELS[key],
  value: key,
}));

export const DASHBOARD_PROVIDER_KEYS = [
  PROVIDER_KEYS.shopify,
  PROVIDER_KEYS.meta_ads,
  PROVIDER_KEYS.google_ads,
];

export const APP_ROUTE_LABELS = {
  [APP_ROUTES.dashboard]: "Dashboard",
  [APP_ROUTES.shopify]: "Shopify",
  [APP_ROUTES.meta_ads]: "Meta Ads",
  [APP_ROUTES.google_ads]: "Google Ads",
  [APP_ROUTES.clients]: "Clienti",
  [APP_ROUTES.integrations]: "Integrazioni",
  [APP_ROUTES.customMetrics]: "Metriche Custom",
  [APP_ROUTES.profile]: "Profilo",
  [APP_ROUTES.settings]: "Impostazioni",
  [APP_ROUTES.dashboardPreferences]: "Preferenze dashboard",
  [APP_ROUTES.appearancePreferences]: "Aspetto",
  [APP_ROUTES.privacyData]: "Privacy e dati",
  [APP_ROUTES.permissionsAccess]: "Permessi e accessi",
};

export const INTEGRATION_STATUSES = {
  connected: "connected",
  incomplete: "incomplete",
  needs_account_selection: "needs_account_selection",
  disconnected: "disconnected",
  not_connected: "not_connected",
  needs_reauth: "needs_reauth",
  expired: "expired",
  error: "error",
  live: "live",
  cache: "cache",
};
