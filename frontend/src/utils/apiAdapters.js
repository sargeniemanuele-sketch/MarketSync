import { DASHBOARD_PROVIDER_KEYS, PROVIDER_KEYS, PROVIDERS } from "./constants.js";
import { dedupeWarnings } from "./warnings.js";

const PROVIDER_KEYS_LIST = [
  PROVIDER_KEYS.shopify,
  PROVIDER_KEYS.meta_ads,
  PROVIDER_KEYS.google_ads,
];

const PROVIDER_CARD_DEFINITIONS = {
  [PROVIDER_KEYS.shopify]: {
    primary: [
      { key: "shopify_total_sales", label: "Total sales", unit: "currency" },
      { key: "shopify_orders", label: "Orders", unit: "number" },
      { key: "shopify_average_order_value", label: "Average order value", unit: "currency" },
      { key: "shopify_gross_sales", label: "Gross sales", unit: "currency" },
    ],
    secondary: [
      { key: "shopify_discounts", label: "Discounts", unit: "currency" },
      { key: "shopify_returns", label: "Returns", unit: "currency" },
      { key: "shopify_net_sales", label: "Net sales", unit: "currency" },
      { key: "shopify_shipping", label: "Shipping", unit: "currency" },
      { key: "shopify_taxes", label: "Taxes", unit: "currency" },
      { key: "shopify_units_sold", label: "Units sold", unit: "number" },
      { key: "shopify_new_customers", label: "New customers", unit: "number" },
      { key: "shopify_returning_customers", label: "Returning customers", unit: "number" },
      { key: "shopify_new_customer_orders", label: "New customer orders", unit: "number" },
      { key: "shopify_returning_customer_orders", label: "Returning customer orders", unit: "number" },
      { key: "shopify_refunded_amount", label: "Refunded amount", unit: "currency" },
    ],
  },
  [PROVIDER_KEYS.meta_ads]: {
    primary: [
      { key: "meta_amount_spent", label: "Amount spent", unit: "currency" },
      { key: "meta_purchase_roas", label: "Purchase ROAS", unit: "ratio" },
      { key: "meta_purchases", label: "Purchases", unit: "number" },
      { key: "meta_cost_per_purchase", label: "Cost per purchase", unit: "currency" },
    ],
    secondary: [
      { key: "meta_purchase_conversion_value", label: "Purchase conversion value", unit: "currency" },
      { key: "meta_impressions", label: "Impressions", unit: "number" },
      { key: "meta_reach", label: "Reach", unit: "number" },
      { key: "meta_frequency", label: "Frequency", unit: "ratio" },
      { key: "meta_clicks", label: "Clicks", unit: "number" },
      { key: "meta_link_clicks", label: "Link clicks", unit: "number" },
      { key: "meta_outbound_clicks", label: "Outbound clicks", unit: "number" },
      { key: "meta_ctr", label: "CTR", unit: "percentage" },
      { key: "meta_cpc", label: "CPC", unit: "currency" },
      { key: "meta_cpm", label: "CPM", unit: "currency" },
      { key: "meta_cost_per_outbound_click", label: "Cost per outbound click", unit: "currency" },
    ],
  },
  [PROVIDER_KEYS.google_ads]: {
    primary: [
      { key: "google_cost", label: "Cost", unit: "currency" },
      { key: "google_roas", label: "ROAS", unit: "ratio" },
      { key: "google_conversions", label: "Conversions", unit: "number" },
      { key: "google_cost_per_conversion", label: "Cost per conversion", unit: "currency" },
    ],
    secondary: [
      { key: "google_conversion_value", label: "Conv. value", unit: "currency" },
      { key: "google_impressions", label: "Impressions", unit: "number" },
      { key: "google_clicks", label: "Clicks", unit: "number" },
      { key: "google_ctr", label: "CTR", unit: "percentage" },
      { key: "google_avg_cpc", label: "Avg. CPC", unit: "currency" },
      { key: "google_avg_cpm", label: "Avg. CPM", unit: "currency" },
      { key: "google_conversion_rate", label: "Conv. rate", unit: "percentage" },
      { key: "google_all_conversions", label: "All conv.", unit: "number" },
      { key: "google_all_conversion_value", label: "All conv. value", unit: "currency" },
      { key: "google_all_conversion_rate", label: "All conv. rate", unit: "percentage" },
      { key: "google_all_roas", label: "All ROAS", unit: "ratio" },
    ],
  },
};

const DEFAULT_INTEGRATION = {
  connected: false,
  connectedAt: null,
  lastError: null,
  lastSyncAt: null,
  status: "not_connected",
};

function normalizeId(entity) {
  const id = entity?.id ?? entity?._id ?? entity?.clientId ?? null;
  return id === null || id === undefined ? null : String(id);
}

function normalizeNullableString(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

export function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    id: normalizeId(user),
  };
}

export function normalizeIntegration(integration) {
  if (!integration) {
    return { ...DEFAULT_INTEGRATION };
  }

  const status =
    integration.status || (integration.connected ? "connected" : DEFAULT_INTEGRATION.status);
  const lastError =
    integration.lastError && typeof integration.lastError === "object"
      ? {
          code: normalizeNullableString(integration.lastError.code),
          message: normalizeNullableString(integration.lastError.message),
          provider: normalizeNullableString(integration.lastError.provider),
          scope: normalizeNullableString(integration.lastError.scope),
          at: integration.lastError.at ?? null,
        }
      : null;

  return {
    connected: Boolean(integration.connected || status === "connected"),
    connectedAt: integration.connectedAt ?? null,
    lastError,
    lastSyncAt: integration.lastSyncAt ?? null,
    status,
    accountInfo: integration.accountInfo ?? null,
  };
}

export function normalizeIntegrations(integrations = {}) {
  return Object.fromEntries(
    PROVIDER_KEYS_LIST.map((providerKey) => [
      providerKey,
      normalizeIntegration(integrations?.[providerKey]),
    ]),
  );
}

export function normalizeIntegrationAccount(account) {
  const externalRef = normalizeNullableString(
    account?.externalRef ??
      account?.id ??
      account?.customerId ??
      account?.adAccountId ??
      account?.resourceName,
  );
  const label =
    normalizeNullableString(account?.label ?? account?.name ?? account?.descriptiveName) ??
    externalRef ??
    "Account senza nome";

  return {
    ...account,
    currency: normalizeNullableString(account?.currency ?? account?.currencyCode),
    externalRef,
    id: externalRef ?? normalizeId(account),
    label,
    status: normalizeNullableString(account?.status ?? account?.accountStatus),
    timezone: normalizeNullableString(
      account?.timezone ?? account?.timezoneName ?? account?.timeZone,
    ),
  };
}

export function normalizeIntegrationAccounts(accounts) {
  return toArray(accounts).map(normalizeIntegrationAccount);
}

export function normalizeClient(client) {
  const id = normalizeId(client);

  return {
    ...client,
    id,
    contactEmail: normalizeNullableString(client?.contactEmail),
    customMetricsConfig: Array.isArray(client?.customMetricsConfig)
      ? client.customMetricsConfig
      : [],
    integrations: normalizeIntegrations(client?.integrations),
    name: client?.name ?? client?.companyName ?? client?.email ?? "Cliente senza nome",
    notes: normalizeNullableString(client?.notes),
    website: normalizeNullableString(client?.website),
  };
}

export function normalizeBootstrap(payload) {
  const source = payload?.data ?? payload ?? {};
  const clients = Array.isArray(source.clients) ? source.clients.map(normalizeClient) : [];
  const lastSelectedClientId =
    source.lastSelectedClientId === null || source.lastSelectedClientId === undefined
      ? null
      : String(source.lastSelectedClientId);

  return {
    ...source,
    clients: clients.filter((client) => Boolean(client.id)),
    lastSelectedClientId,
    user: normalizeUser(source.user),
  };
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getProviderWarnings(warnings, providerKey) {
  return toArray(warnings).filter(
    (warning) => warning?.provider === providerKey || warning?.scope === providerKey,
  );
}

function normalizeListOrObject(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).map(([key, item]) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return { key, ...item };
    }

    return {
      key,
      label: key,
      value: item,
    };
  });
}

function resolveMetricHelp(card) {
  const existingHelp = card?.help && typeof card.help === "object" ? card.help : null;

  if (existingHelp) {
    return {
      ...existingHelp,
      title: existingHelp.title ?? card?.label ?? card?.key ?? card?.id ?? "KPI",
      description: existingHelp.description ?? existingHelp.descriptionIt ?? null,
      descriptionIt: existingHelp.descriptionIt ?? null,
      formula: existingHelp.formula ?? existingHelp.formulaIt ?? null,
      formulaIt: existingHelp.formulaIt ?? null,
      note: existingHelp.note ?? existingHelp.noteIt ?? null,
      noteIt: existingHelp.noteIt ?? null,
      source: existingHelp.source ?? null,
      sourceUrl: existingHelp.sourceUrl ?? null,
      text: existingHelp.text ?? null,
    };
  }

  return null;
}

function normalizeMetricCards(cards, fallbackProvider = PROVIDER_KEYS.overview) {
  return toArray(cards).map((card, index) => {
    const normalizedCard = {
      provider: card?.provider ?? card?.sourceProvider ?? fallbackProvider,
      providerLogoKey: card?.providerLogoKey ?? card?.sourceProvider ?? fallbackProvider,
      priority: card?.priority ?? index + 1,
      ...(card ?? {}),
    };

    return {
      ...normalizedCard,
      help: resolveMetricHelp(normalizedCard),
    };
  });
}

function hasMetric(summary, key) {
  return Object.prototype.hasOwnProperty.call(summary ?? {}, key);
}

function getProviderResultCurrency(providerResult) {
  const currency = providerResult?.meta?.currency;

  if (typeof currency === "string" && currency.trim()) {
    return currency.trim().toUpperCase();
  }

  return "EUR";
}

function buildMetricCardFromDefinition({
  definition,
  index,
  providerKey,
  providerResult,
  type,
}) {
  const summary = toObject(providerResult?.summary);
  const isAvailable = hasMetric(summary, definition.key);
  const providerLabel = PROVIDERS[providerKey]?.label ?? providerKey;
  const currency = getProviderResultCurrency(providerResult);

  return {
    key: definition.key,
    label: definition.label,
    value: isAvailable ? summary[definition.key] : null,
    unit: definition.unit ?? null,
    comparison: providerResult?.comparison?.[definition.key] ?? null,
    currency: definition.unit === "currency" ? currency : null,
    sparkline: providerResult?.seriesByMetricKey?.[definition.key] ?? null,
    provider: providerKey,
    providerLabel,
    providerLogoKey: providerKey,
    priority: index + 1,
    sourceProvider: providerKey,
    type,
    help: resolveMetricHelp(definition),
    availability: {
      status: isAvailable ? "available" : "not_available",
      message: isAvailable ? null : `${definition.label} non e disponibile per questo periodo.`,
    },
  };
}

function buildMetricCardsFromDefinitions(providerKey, providerResult, type) {
  const definitions = PROVIDER_CARD_DEFINITIONS[providerKey]?.[type] ?? [];

  return definitions.map((definition, index) =>
    buildMetricCardFromDefinition({
      definition,
      index,
      providerKey,
      providerResult,
      type,
    }),
  );
}

function resolveFallbackProviderStatus(providerKey, warnings = [], meta = {}, hasData = false) {
  const providerWarnings = getProviderWarnings(warnings, providerKey);
  const warningCodes = new Set(providerWarnings.map((warning) => warning?.code));
  const availableProviders = toArray(meta.availableProviders);
  const failedProviders = toArray(meta.failedProviders);
  const attemptedProviders = toArray(meta.attemptedProviders);

  if (hasData || availableProviders.includes(providerKey)) {
    return "available";
  }

  if (
    failedProviders.includes(providerKey) ||
    attemptedProviders.includes(providerKey) ||
    warningCodes.has("PROVIDER_FETCH_FAILED")
  ) {
    return "failed";
  }

  if (warningCodes.has("PROVIDER_INTEGRATION_INCOMPLETE") || warningCodes.has("INTEGRATION_INCOMPLETE")) {
    return "incomplete";
  }

  return "not_connected";
}

function resolveFallbackProviderMessage(providerKey, status, warnings = []) {
  const providerLabel = PROVIDERS[providerKey]?.label ?? providerKey;
  const warningMessage = getProviderWarnings(warnings, providerKey).find(
    (warning) => warning?.message,
  )?.message;

  if (warningMessage) {
    return warningMessage;
  }

  if (status === "available") {
    return null;
  }

  if (status === "failed") {
    return `I dati ${providerLabel} non sono stati caricati.`;
  }

  if (status === "expired") {
    return `L'integrazione ${providerLabel} e scaduta. Ricollegala dalla sezione Integrazioni.`;
  }

  if (status === "needs_reauth") {
    return `L'integrazione ${providerLabel} richiede una nuova autorizzazione.`;
  }

  if (status === "error") {
    return `L'integrazione ${providerLabel} e in errore.`;
  }

  if (status === "incomplete") {
    return `L'integrazione ${providerLabel} e incompleta.`;
  }

  if (status === "needs_account_selection") {
    return `L'integrazione ${providerLabel} richiede la selezione di un account.`;
  }

  return `L'integrazione ${providerLabel} non e collegata.`;
}

function collectSectionCandidates(rawSections) {
  if (Array.isArray(rawSections)) {
    return Object.fromEntries(
      rawSections
        .filter((section) => section?.provider)
        .map((section) => [section.provider, section]),
    );
  }

  return toObject(rawSections);
}

export function normalizeProviderSection(providerKey, section, warnings = [], meta = {}) {
  const providerLabel = PROVIDERS[providerKey]?.label ?? providerKey;

  if (section && typeof section === "object") {
    const summary = section.summary ?? null;
    const comparison = section.comparison ?? null;
    const sectionWarnings = toArray(section.warnings).length
      ? toArray(section.warnings)
      : getProviderWarnings(warnings, providerKey);
    const mergedMeta = {
      ...meta,
      ...(section.meta ?? {}),
    };
    const hasData = Boolean(summary || comparison || mergedMeta.hasData);
    const status =
      section.status ?? resolveFallbackProviderStatus(providerKey, warnings, mergedMeta, hasData);
    const providerResult = {
      comparison,
      meta: mergedMeta,
      summary,
    };
    const hasPrimaryCards = Array.isArray(section.primaryCards);
    const hasSecondaryCards = Array.isArray(section.secondaryCards);
    const primaryCards = hasPrimaryCards
      ? normalizeMetricCards(section.primaryCards, providerKey)
      : status === "available"
        ? buildMetricCardsFromDefinitions(providerKey, providerResult, "primary")
        : [];
    const secondaryCards = hasSecondaryCards
      ? normalizeMetricCards(section.secondaryCards, providerKey)
      : status === "available"
        ? buildMetricCardsFromDefinitions(providerKey, providerResult, "secondary")
        : [];
    const currency = getProviderResultCurrency(providerResult);

    return {
      ...section,
      provider: providerKey,
      providerLabel: section.providerLabel ?? providerLabel,
      providerLogoKey: section.providerLogoKey ?? providerKey,
      status,
      message: section.message ?? resolveFallbackProviderMessage(providerKey, status, warnings),
      summary,
      comparison,
      primaryCards,
      secondaryCards,
      warnings: sectionWarnings,
      meta: {
        ...mergedMeta,
        currency,
        hasData,
        sourceProvider: providerKey,
        cardCount: primaryCards.length + secondaryCards.length,
      },
    };
  }

  const status = resolveFallbackProviderStatus(providerKey, warnings, meta);

  return {
    provider: providerKey,
    providerLabel,
    providerLogoKey: providerKey,
    status,
    message: resolveFallbackProviderMessage(providerKey, status, warnings),
    summary: null,
    comparison: null,
    primaryCards: [],
    secondaryCards: [],
    warnings: getProviderWarnings(warnings, providerKey),
    meta: {
      hasData: false,
      sourceProvider: providerKey,
    },
  };
}

function normalizeOverview(source, dashboard) {
  const overview = toObject(source.overview ?? dashboard.overview);

  return {
    ...overview,
    summary: overview.summary ?? dashboard.summary ?? source.summary ?? null,
    mainCards: normalizeMetricCards(
      overview.mainCards ?? source.mainCards ?? dashboard.mainCards,
      PROVIDER_KEYS.overview,
    ),
    customMetricCards: normalizeMetricCards(
      overview.customMetricCards ?? source.customMetricCards ?? dashboard.customMetricCards,
      PROVIDER_KEYS.overview,
    ),
    providerHighlights: normalizeListOrObject(
      overview.providerHighlights ?? source.providerHighlights ?? dashboard.providerHighlights,
    ),
    missingProviders: normalizeListOrObject(
      overview.missingProviders ?? source.missingProviders ?? dashboard.missingProviders,
    ),
  };
}

export function normalizeDashboardMetrics(payload) {
  const source = payload?.data ?? payload ?? {};
  const dashboard = toObject(source.dashboard ?? source);
  const warnings = toArray(source.warnings);
  const meta = {
    ...(source.meta ?? {}),
    ...(dashboard.meta ?? {}),
  };
  const rawSections =
    source.sections ??
    dashboard.sections ??
    source.providerSections ??
    dashboard.providerSections;
  const sectionCandidates = collectSectionCandidates(rawSections);
  const sections = Object.fromEntries(
    DASHBOARD_PROVIDER_KEYS.map((providerKey) => [
      providerKey,
      normalizeProviderSection(providerKey, sectionCandidates[providerKey], warnings, meta),
    ]),
  );

  return {
    ...source,
    dashboard,
    overview: normalizeOverview(source, dashboard),
    providerSections: DASHBOARD_PROVIDER_KEYS.map((providerKey) => sections[providerKey]),
    sections,
    summary: dashboard.summary ?? source.summary ?? null,
    warnings,
    meta,
  };
}

export function normalizeProviderMetrics({ data, meta = {}, provider, warnings = [] } = {}) {
  const providerKey = provider;
  const source = data?.success ? data.data ?? {} : data ?? {};
  const mergedWarnings = dedupeWarnings([...toArray(warnings), ...toArray(source.warnings)]);
  const mergedMeta = {
    ...(source.meta ?? {}),
    ...meta,
  };
  const section = normalizeProviderSection(
    providerKey,
    {
      ...source,
      meta: mergedMeta,
      provider: providerKey,
      providerLabel: source.providerLabel ?? PROVIDERS[providerKey]?.label ?? providerKey,
      providerLogoKey: source.providerLogoKey ?? providerKey,
    },
    mergedWarnings,
    mergedMeta,
  );

  return {
    raw: source,
    section,
    primaryCards: section.primaryCards,
    secondaryCards: section.secondaryCards,
    warnings: mergedWarnings,
    meta: section.meta,
  };
}
