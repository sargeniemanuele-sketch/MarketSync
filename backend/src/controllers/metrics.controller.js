import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../contracts/responseBuilders/success.js';
import { getClientById } from '../services/clients/clients.service.js';
import * as integrationsService from '../services/integrations/integrations.service.js';
import { buildMetricsPeriodMeta, resolveMetricsRange } from '../utils/ranges.js';
import {
  buildOverviewMetrics,
  getShopifyKpiResultWithComparison,
  getMetaAdsKpiResultWithComparison,
  getGoogleAdsKpiResultWithComparison,
} from '../services/overview/overview.service.js';
import { buildDashboardData } from '../services/dashboard/dashboard.service.js';
import { computeCustomMetrics } from '../services/customMetrics/customMetrics.service.js';
import { getMetricDetail as getMetricDetailService } from '../services/metrics/metricDetail.service.js';
import { PROVIDER_LABELS, buildProviderSection } from '../contracts/metrics/cards.js';

const incompleteCodes = new Set([
  'INTEGRATION_INCOMPLETE',
  'GOOGLE_ADS_ACCOUNT_SELECTION_REQUIRED',
  'META_ACCOUNT_SELECTION_REQUIRED',
]);

const reauthCodes = new Set([
  'INTEGRATION_NOT_ACTIVE',
  'INTEGRATION_EXPIRED',
  'GOOGLE_ADS_REAUTH_REQUIRED',
  'GOOGLE_ADS_AUTH_ERROR',
  'META_REAUTH_REQUIRED',
  'SHOPIFY_REAUTH_REQUIRED',
  // scope mancanti: il fallback minimale viene tentato prima, ma se propaga
  // significa che entrambe le query sono fallite → l'utente deve riconfigurare l'app
  'SHOPIFY_SCOPE_OR_ACCESS_DENIED',
]);

async function resolveOwnedMetricsParams(req) {
  const { clientId, range, startDate, endDate } = req.validated.query;

  await getClientById(req.user.id, clientId);

  const resolved = resolveMetricsRange({
    range,
    startDate,
    endDate,
  });

  return {
    clientId,
    range,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
  };
}

function buildUnavailableProviderResult(provider, status, message, code = 'PROVIDER_NOT_CONNECTED') {
  const providerLabel = PROVIDER_LABELS[provider] ?? provider;

  return {
    provider,
    providerLabel,
    providerLogoKey: provider,
    status,
    message,
    summary: null,
    comparison: null,
    primaryCards: [],
    secondaryCards: [],
    warnings: [
      {
        code,
        provider,
        scope: provider,
        message,
      },
    ],
    meta: {
      hasData: false,
      sourceProvider: provider,
    },
  };
}

function resolveUnavailableFromStatus(provider, integration) {
  const status = integration?.status ?? 'not_connected';
  const providerLabel = PROVIDER_LABELS[provider] ?? provider;

  if (status === 'connected') return null;

  if (status === 'incomplete' || status === 'needs_account_selection') {
    return buildUnavailableProviderResult(
      provider,
      status,
      `L'integrazione ${providerLabel} richiede la selezione di un account prima di poter caricare le metriche.`,
      'INTEGRATION_INCOMPLETE'
    );
  }

  if (status === 'expired' || status === 'needs_reauth' || status === 'error') {
    return buildUnavailableProviderResult(
      provider,
      status,
      `L'integrazione ${providerLabel} richiede la riconnessione prima di poter caricare le metriche.`,
      'INTEGRATION_NOT_ACTIVE'
    );
  }

  return buildUnavailableProviderResult(
    provider,
    'not_connected',
    `L'integrazione ${providerLabel} non è collegata.`,
    'PROVIDER_NOT_CONNECTED'
  );
}

function resolveUnavailableFromError(provider, error) {
  const providerLabel = PROVIDER_LABELS[provider] ?? provider;

  if (error?.code === 'INTEGRATION_NOT_FOUND') {
    return buildUnavailableProviderResult(
      provider,
      'not_connected',
      `L'integrazione ${providerLabel} non è collegata.`,
      'PROVIDER_NOT_CONNECTED'
    );
  }

  if (incompleteCodes.has(error?.code)) {
    return buildUnavailableProviderResult(
      provider,
      'incomplete',
      error.message || `L'integrazione ${providerLabel} è incompleta.`,
      'INTEGRATION_INCOMPLETE'
    );
  }

  if (reauthCodes.has(error?.code)) {
    return buildUnavailableProviderResult(
      provider,
      error.code === 'INTEGRATION_EXPIRED' ? 'expired' : 'needs_reauth',
      error.message || `L'integrazione ${providerLabel} richiede la riconnessione.`,
      error.code
    );
  }

  return null;
}

function attachResultPeriodMeta(result, { range, startDate, endDate }) {
  return {
    ...result,
    meta: {
      ...(result?.meta ?? {}),
      ...buildMetricsPeriodMeta({ range, startDate, endDate }),
    },
  };
}

async function getProviderMetricsResult({ params, provider, userId, getKpiResult }) {
  const statuses = await integrationsService.getIntegrationStatusByClient(params.clientId, userId);
  const unavailable = resolveUnavailableFromStatus(provider, statuses?.[provider]);

  if (unavailable) {
    return attachResultPeriodMeta(unavailable, params);
  }

  try {
    return await getKpiResult(params);
  } catch (error) {
    const unavailableFromError = resolveUnavailableFromError(provider, error);
    if (unavailableFromError) return attachResultPeriodMeta(unavailableFromError, params);
    throw error;
  }
}

export const getOverviewMetrics = asyncHandler(async (req, res) => {
  const params = await resolveOwnedMetricsParams(req);
  const result = await buildOverviewMetrics(params);
  return sendSuccess(res, result);
});

export const getShopifyMetrics = asyncHandler(async (req, res) => {
  const params = await resolveOwnedMetricsParams(req);
  const result = await getProviderMetricsResult({
    params,
    provider: 'shopify',
    userId: req.user.id,
    getKpiResult: getShopifyKpiResultWithComparison,
  });
  if (result?.summary) {
    const warnings = [...(result.warnings ?? [])];

    if (result.meta?.isPartialData) {
      warnings.push({
        code:     'SHOPIFY_PARTIAL_DATA',
        provider: 'shopify',
        scope:    'shopify',
        message:  'Alcune metriche Shopify sono parziali perché i dati avanzati su clienti, resi o rimborsi non sono disponibili con gli scope correnti.',
      });
    }

    if (result.meta?.truncated) {
      warnings.push({
        code:     'SHOPIFY_DATA_TRUNCATED',
        provider: 'shopify',
        scope:    'shopify',
        message:  'I dati Shopify sono parziali perché il numero di ordini nel periodo supera il limite di sicurezza del fetch.',
      });
    }

    if (result.meta?.lineItemsTruncated) {
      warnings.push({
        code:     'SHOPIFY_LINE_ITEMS_TRUNCATED',
        provider: 'shopify',
        scope:    'shopify',
        message:  'Alcune quantità Shopify potrebbero essere parziali perché uno o più ordini superano il limite di righe recuperabili per ordine.',
      });
    }

    if (result.meta?.refundItemsTruncated) {
      warnings.push({
        code:     'SHOPIFY_REFUND_ITEMS_TRUNCATED',
        provider: 'shopify',
        scope:    'shopify',
        message:  'Alcuni dati sui resi Shopify potrebbero essere parziali perché uno o più rimborsi superano il limite di righe recuperabili.',
      });
    }

    if (result.meta?.refundTransactionsTruncated) {
      warnings.push({
        code:     'SHOPIFY_REFUND_TRANSACTIONS_TRUNCATED',
        provider: 'shopify',
        scope:    'shopify',
        message:  'Il totale rimborsato Shopify potrebbe essere parziale perché uno o più rimborsi hanno più di 50 transazioni associate.',
      });
    }

    if (result.meta?.isOrderBasedFallback) {
      if (result.meta?.shopifyqlAccessRequired) {
        warnings.push({
          code:     'SHOPIFY_REPORTS_ACCESS_REQUIRED',
          provider: 'shopify',
          scope:    'shopify',
          message:  'Per mostrare metriche identiche ai report Shopify Analytics, l\'app deve avere accesso ai report Shopify tramite read_reports e agli eventuali dati protetti richiesti da Shopify.',
        });
      }
      warnings.push({
        code:     'SHOPIFY_ORDER_BASED_FALLBACK',
        provider: 'shopify',
        scope:    'shopify',
        message:  'Alcune metriche Shopify sono calcolate dagli ordini e potrebbero non coincidere perfettamente con Shopify Analytics.',
      });
    }

    if (result.meta?.customerTypeUnavailable) {
      warnings.push({
        code:     'SHOPIFY_CUSTOMER_REPORT_UNAVAILABLE',
        provider: 'shopify',
        scope:    'shopify',
        message:  'I dati sul tipo di cliente (new/returning) non sono disponibili dai report Shopify. Le metriche new customers, returning customers e i relativi ordini non sono disponibili.',
      });
    }

    return sendSuccess(res, buildProviderSection({
      provider: 'shopify',
      providerResult: result,
      warnings,
      meta: result.meta ?? {},
    }));
  }

  return sendSuccess(res, result);
});

export const getMetaAdsMetrics = asyncHandler(async (req, res) => {
  const params = await resolveOwnedMetricsParams(req);
  const result = await getProviderMetricsResult({
    params,
    provider: 'meta_ads',
    userId: req.user.id,
    getKpiResult: getMetaAdsKpiResultWithComparison,
  });
  if (result?.summary) {
    return sendSuccess(res, buildProviderSection({
      provider: 'meta_ads',
      providerResult: result,
      warnings: result.warnings ?? [],
      meta: result.meta ?? {},
    }));
  }

  return sendSuccess(res, result);
});

export const getGoogleAdsMetrics = asyncHandler(async (req, res) => {
  const params = await resolveOwnedMetricsParams(req);
  const result = await getProviderMetricsResult({
    params,
    provider: 'google_ads',
    userId: req.user.id,
    getKpiResult: getGoogleAdsKpiResultWithComparison,
  });
  if (result?.summary) {
    return sendSuccess(res, buildProviderSection({
      provider: 'google_ads',
      providerResult: result,
      warnings: result.warnings ?? [],
      meta: result.meta ?? {},
    }));
  }

  return sendSuccess(res, result);
});

export const getCustomMetrics = asyncHandler(async (req, res) => {
  const params = await resolveOwnedMetricsParams(req);
  const result = await computeCustomMetrics(params);
  return sendSuccess(res, result);
});

export const getDashboardMetrics = asyncHandler(async (req, res) => {
  const params = await resolveOwnedMetricsParams(req);
  const result = await buildDashboardData(params);
  return sendSuccess(res, result);
});

export const getMetricDetail = asyncHandler(async (req, res) => {
  const result = await getMetricDetailService({
    userId: req.user.id,
    ...req.validated.query,
  });

  return sendSuccess(res, result.data, {
    warnings: result.warnings,
    meta: result.meta,
  });
});
