import axiosClient, { API_BASE_URL } from "./axiosClient.js";
import { normalizeIntegrationAccounts, normalizeIntegrations } from "../utils/apiAdapters.js";
import { PROVIDER_KEYS } from "../utils/constants.js";
import { providerToPublicSlug } from "../utils/providers.js";

export const PROVIDER_API_SEGMENTS = {
  [PROVIDER_KEYS.shopify]: "shopify",
  [PROVIDER_KEYS.meta_ads]: "meta-ads",
  [PROVIDER_KEYS.google_ads]: "google-ads",
};

function getProviderApiSegment(provider) {
  const segment = providerToPublicSlug(provider) ?? PROVIDER_API_SEGMENTS[provider];

  if (!segment) {
    throw new Error("Piattaforma non supportata.");
  }

  return segment;
}

function unwrapIntegrationResponse(response) {
  if (response?.status === 204) {
    return {
      data: null,
      meta: {},
      warnings: [],
    };
  }

  const body = response?.data ?? {};

  if (Object.prototype.hasOwnProperty.call(body, "success")) {
    return {
      data: body.data ?? null,
      meta: body.meta ?? {},
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
    };
  }

  return {
    data: body ?? null,
    meta: body?.meta ?? {},
    warnings: Array.isArray(body?.warnings) ? body.warnings : [],
  };
}

function stripEmptyValues(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ""),
  );
}

function getFirstUrl(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) ?? null;
}

export function buildConnectUrl(provider, clientId) {
  const segment = getProviderApiSegment(provider);
  const params = new URLSearchParams({ clientId });

  return `${API_BASE_URL}/integrations/${segment}/connect?${params.toString()}`;
}

export function getIntegrationErrorMessage(
  error,
  fallback = "Operazione integrazione non riuscita.",
) {
  const apiError = error?.response?.data?.error;
  const code = apiError?.code;
  const provider = apiError?.provider;
  const message = apiError?.message || error?.message;

  if (code === "UNAUTHORIZED") {
    return "Sessione scaduta. Effettua di nuovo l'accesso.";
  }

  if (code === "FORBIDDEN") {
    return "Permessi insufficienti per modificare questa integrazione.";
  }

  if (code === "NOT_FOUND" || code === "INTEGRATION_NOT_FOUND") {
    return "Integrazione non trovata per il cliente selezionato.";
  }

  if (code === "INTEGRATION_NOT_ACTIVE" || code === "INTEGRATION_EXPIRED") {
    return "Collegamento scaduto o non attivo. Ricollega la piattaforma.";
  }

  if (code === "INTEGRATION_INCOMPLETE") {
    return "Collegamento incompleto. Ricollega la piattaforma o seleziona un account.";
  }

  if (code === "META_ACCOUNT_SELECTION_REQUIRED" || code === "GOOGLE_ADS_ACCOUNT_SELECTION_REQUIRED") {
    return "Seleziona un account valido tra quelli disponibili per completare il collegamento.";
  }

  if (code === "SHOPIFY_NOT_CONFIGURED") {
    return "Shopify non è ancora configurato. Contatta il supporto.";
  }

  if (code === "META_NOT_CONFIGURED") {
    return "Meta Ads non è ancora configurato. Contatta il supporto.";
  }

  if (code === "GOOGLE_ADS_NOT_CONFIGURED") {
    return "Google Ads non è ancora configurato. Contatta il supporto.";
  }

  if (code === "GOOGLE_ADS_API_NOT_ENABLED") {
    return "Non è stato possibile accedere a Google Ads. Contatta il supporto.";
  }

  if (code === "GOOGLE_ADS_DEVELOPER_TOKEN_INVALID") {
    return "Google Ads è stato autorizzato, ma MarketSync non può ancora leggere gli account. Contatta il supporto per completare la configurazione.";
  }

  if (code === "GOOGLE_ADS_ACCESS_LEVEL_RESTRICTED") {
    return "Google Ads non è ancora disponibile per questo account. Contatta il supporto per completare la configurazione.";
  }

  if (code === "GOOGLE_ADS_NO_ACCESSIBLE_CUSTOMERS") {
    return "Nessun account Google Ads trovato. Verifica che l'account Google usato abbia accesso a un account Google Ads.";
  }

  if (code === "GOOGLE_ADS_PERMISSION_DENIED") {
    return "Non è stato possibile accedere all'account Google Ads. Verifica i permessi dell'account Google e riprova.";
  }

  if (code === "GOOGLE_ADS_AUTH_SCOPE_MISSING") {
    return "L'autorizzazione Google Ads non include le autorizzazioni necessarie. Ricollega l'account e accetta tutte le autorizzazioni richieste.";
  }

  if (code === "META_NO_AD_ACCOUNTS") {
    return "Nessun account pubblicitario Meta disponibile per questo utente.";
  }

  if (code === "META_PERMISSION_DENIED") {
    return "Permessi Meta Ads insufficienti per leggere questo account pubblicitario.";
  }

  if (code === "VALIDATION_ERROR" && provider === "shopify") {
    return "Inserisci il nome del tuo store Shopify, ad esempio: nome-store o nome-store.myshopify.com.";
  }

  return message || fallback;
}

export async function getIntegrations(clientId) {
  const response = await axiosClient.get(`/integrations/${clientId}`);
  const unwrapped = unwrapIntegrationResponse(response);

  return {
    integrations: normalizeIntegrations(unwrapped.data),
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function connectIntegration(provider, params = {}) {
  const segment = getProviderApiSegment(provider);
  const response = await axiosClient.get(`/integrations/${segment}/connect`, {
    params: stripEmptyValues(params),
  });
  const unwrapped = unwrapIntegrationResponse(response);

  return {
    ...unwrapped.data,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function connect(provider, clientId) {
  const response = await connectIntegration(provider, { clientId });
  const url = getFirstUrl(
    response?.url,
    response?.connectUrl,
    response?.data?.url,
    response?.data?.connectUrl,
  );

  return {
    ...response,
    url,
  };
}

export async function getProviderAccounts(provider, params = {}) {
  const segment = getProviderApiSegment(provider);
  const response = await axiosClient.get(`/integrations/${segment}/accounts`, {
    params: stripEmptyValues(params),
  });
  const unwrapped = unwrapIntegrationResponse(response);

  return {
    ...unwrapped.data,
    accounts: normalizeIntegrationAccounts(unwrapped.data?.accounts),
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function selectProviderAccount(provider, payload = {}) {
  const segment = getProviderApiSegment(provider);
  const response = await axiosClient.post(
    `/integrations/${segment}/select-account`,
    stripEmptyValues(payload),
  );
  const unwrapped = unwrapIntegrationResponse(response);

  return {
    ...unwrapped.data,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function disconnectIntegration(provider, clientId) {
  const segment = getProviderApiSegment(provider);
  const response = await axiosClient.delete(`/integrations/${segment}/${clientId}`);
  const unwrapped = unwrapIntegrationResponse(response);

  return {
    disconnected: response.status === 204 || unwrapped.data === null,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}
