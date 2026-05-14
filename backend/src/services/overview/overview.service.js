import Integration from '../../models/Integration.js';
import { BadRequestError } from '../../utils/errors.js';
import { METRIC_CACHE } from '../../config/app.constants.js';
import {
  APP_TIMEZONE,
  buildMetricsPeriodMeta,
  resolvePreviousMetricsRange,
  resolvePreviousRangeLabel,
  toAppDateString,
} from '../../utils/ranges.js';
import { fetchRawShopifyData } from '../shopify/shopify.fetch.service.js';
import {
  compareShopifyKpis,
  computeShopifyKpis,
} from '../shopify/shopify.kpi.service.js';
import { fetchRawMetaAdsData } from '../metaAds/metaAds.fetch.service.js';
import { normalizeMetaAdsInsights } from '../metaAds/metaAds.normalize.service.js';
import {
  compareMetaAdsKpis,
  computeMetaAdsKpis,
} from '../metaAds/metaAds.kpi.service.js';
import { fetchRawGoogleAdsData } from '../googleAds/googleAds.fetch.service.js';
import { normalizeGoogleAdsRows } from '../googleAds/googleAds.normalize.service.js';
import {
  compareGoogleAdsKpis,
  computeGoogleAdsKpis,
} from '../googleAds/googleAds.kpi.service.js';
import { resolveWithCache } from '../cache/metricCache.service.js';
import { logSyncSuccess } from '../logging/syncLog.service.js';
import {
  PROVIDER_LABELS,
  PROVIDER_ORDER,
  attachOverviewProviderSections,
} from '../../contracts/metrics/cards.js';

// ── Helpers input ─────────────────────────────────────────────────────────────

function assertDateInput(startDate, endDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestError('Intervallo di date non valido.');
  }

  if (start > end) {
    throw new BadRequestError('La data di inizio deve essere precedente o uguale alla data di fine.');
  }

  return { startDate: start, endDate: end };
}

// ── Helpers provider ──────────────────────────────────────────────────────────

function buildProviderDataContainer() {
  return { shopify: null, meta_ads: null, google_ads: null };
}

function isProviderConnected(integration) {
  return integration?.status === 'connected';
}

function hasRequiredSecrets(provider, integration) {
  if (!integration) return false;
  const hasAccessToken = Boolean(integration.credentials?.accessToken);
  if (provider === 'shopify') return hasAccessToken && Boolean(integration.externalRef);
  if (provider === 'meta_ads') return hasAccessToken && Boolean(integration.externalRef);
  if (provider === 'google_ads') return hasAccessToken && Boolean(integration.externalRef);
  return false;
}

function buildNotConnectedWarning(provider) {
  return { code: 'PROVIDER_NOT_CONNECTED', provider, message: `${PROVIDER_LABELS[provider]} non è collegato` };
}

function buildIntegrationIncompleteWarning(provider) {
  return {
    code: 'INTEGRATION_INCOMPLETE',
    provider,
    message: `${PROVIDER_LABELS[provider]} è collegato, ma la configurazione non è completa. Ricollega l'account dalla sezione Integrazioni.`,
  };
}

function buildFetchFailedWarning(provider) {
  return { code: 'PROVIDER_FETCH_FAILED', provider, message: `Impossibile caricare i dati ${PROVIDER_LABELS[provider]}` };
}

function buildComparisonFailedWarning(provider) {
  return {
    code: 'PROVIDER_COMPARISON_FAILED',
    provider,
    message: `Impossibile caricare i dati del periodo precedente per ${PROVIDER_LABELS[provider]}`,
  };
}

function buildTruncatedDataWarning(provider) {
  return {
    code: 'PROVIDER_DATA_TRUNCATED',
    provider,
    message: `I dati ${PROVIDER_LABELS[provider]} sono parziali. Prova a ridurre il periodo selezionato.`,
  };
}

function buildShopifyMixedCurrencyWarning() {
  return {
    code: 'SHOPIFY_MIXED_CURRENCY',
    provider: 'shopify',
    message: 'I dati Shopify coprono più valute: i valori monetari potrebbero non essere direttamente confrontabili',
  };
}

function collectProviderWarnings(provider, kpiResult) {
  const warnings = [];
  if (kpiResult?.meta?.truncated) warnings.push(buildTruncatedDataWarning(provider));
  if (provider === 'shopify' && kpiResult?.meta?.mixedCurrency) warnings.push(buildShopifyMixedCurrencyWarning());
  if (provider === 'shopify' && kpiResult?.meta?.isPartialData) {
    warnings.push({
      code:    'SHOPIFY_PARTIAL_DATA',
      provider: 'shopify',
      scope:    'shopify',
      message:  'Alcune metriche Shopify sono parziali perché i dati avanzati su clienti, resi o rimborsi non sono disponibili con gli scope correnti.',
    });
  }
  if (kpiResult?.meta?.comparison?.previous?.error) warnings.push(buildComparisonFailedWarning(provider));
  return warnings;
}

// ── Helpers meta ──────────────────────────────────────────────────────────────

function attachCacheMeta(payload, cacheMeta) {
  return {
    ...payload,
    meta: { ...(payload?.meta ?? {}), ...cacheMeta },
  };
}

function attachPeriodMeta(payload, { range, currentDates, previousDates }) {
  return {
    ...payload,
    meta: {
      ...(payload?.meta ?? {}),
      ...buildMetricsPeriodMeta({
        range,
        startDate: currentDates.startDate,
        endDate: currentDates.endDate,
        comparison: previousDates,
      }),
    },
  };
}

/**
 * Aggiunge warning stale alla risposta quando i dati provengono da cache scaduta.
 * Il warning è in italiano ed è visibile nella UI esistente senza modifiche.
 */
export function buildStaleResult(result, provider) {
  return {
    ...result,
    warnings: [
      ...(Array.isArray(result.warnings) ? result.warnings : []),
      {
        code: 'STALE_DATA',
        provider,
        scope: provider,
        message:
          'Dati non aggiornati: la piattaforma non è al momento raggiungibile. Vengono mostrati gli ultimi dati disponibili.',
      },
    ],
    meta: {
      ...(result.meta ?? {}),
      isStale: true,
    },
  };
}

// ── Helpers confronto ─────────────────────────────────────────────────────────

function resolveComparisonSource(currentSource, previousSource) {
  if (!currentSource) return previousSource ?? null;
  if (!previousSource) return currentSource;
  return currentSource === previousSource ? currentSource : 'mixed';
}

function buildComparisonPeriodMeta({ range, dates, result }) {
  return {
    range: range ?? null,
    startDate: toAppDateString(dates.startDate),
    endDate: toAppDateString(dates.endDate),
    timezone: APP_TIMEZONE,
    source: result?.meta?.source ?? null,
    lastFetchedAt: result?.meta?.lastFetchedAt ?? null,
    cachedUntil: result?.meta?.cachedUntil ?? null,
  };
}

function attachKpiComparison({
  currentResult,
  previousResult,
  range,
  currentDates,
  previousRange,
  previousDates,
  compareSummaries,
}) {
  const currentSource = currentResult?.meta?.source ?? null;
  const previousSource = previousResult?.meta?.source ?? null;

  return {
    ...currentResult,
    comparison: compareSummaries(
      currentResult?.summary ?? {},
      previousResult?.summary ?? {}
    ),
    meta: {
      ...(currentResult?.meta ?? {}),
      startDate: toAppDateString(currentDates.startDate),
      endDate: toAppDateString(currentDates.endDate),
      timezone: APP_TIMEZONE,
      source: resolveComparisonSource(currentSource, previousSource),
      comparison: {
        current: buildComparisonPeriodMeta({ range, dates: currentDates, result: currentResult }),
        previous: buildComparisonPeriodMeta({ range: previousRange, dates: previousDates, result: previousResult }),
      },
    },
  };
}

function attachUnavailableKpiComparison({
  currentResult,
  range,
  currentDates,
  previousRange,
  previousDates,
}) {
  return {
    ...currentResult,
    comparison: {},
    meta: {
      ...(currentResult?.meta ?? {}),
      startDate: toAppDateString(currentDates.startDate),
      endDate: toAppDateString(currentDates.endDate),
      timezone: APP_TIMEZONE,
      comparison: {
        current: buildComparisonPeriodMeta({ range, dates: currentDates, result: currentResult }),
        previous: {
          range: previousRange ?? null,
          startDate: toAppDateString(previousDates.startDate),
          endDate: toAppDateString(previousDates.endDate),
          timezone: APP_TIMEZONE,
            source: null,
            lastFetchedAt: null,
            cachedUntil: null,
            error: {
              code: 'COMPARISON_PREVIOUS_PERIOD_UNAVAILABLE',
            message: 'Non è stato possibile caricare i dati del periodo precedente.',
          },
        },
      },
    },
  };
}

function hasProviderComparison(providerResult) {
  return Boolean(
    providerResult &&
    providerResult.comparison &&
    typeof providerResult.comparison === 'object'
  );
}

function hasOverviewComparison(overviewResult) {
  if (!overviewResult?.data) return false;
  const providers = overviewResult.meta?.availableProviders ?? [];
  if (providers.length === 0) return true;
  return providers.every((provider) => hasProviderComparison(overviewResult.data[provider]));
}

// ── withMetricCache: wrapper cache per singolo provider ───────────────────────

async function withMetricCache({
  clientId,
  provider,
  metricKey = null,
  range,
  startDate,
  endDate,
  buildLive,
  ttlMs,
}) {
  const cacheParams = { clientId, provider, metricKey, range, startDate, endDate };

  const { data, meta, source } = await resolveWithCache({ cacheParams, buildLive, ttlMs });

  if (source === 'cache' || source === 'stale') {
    logSyncSuccess({
      clientId,
      provider,
      endpoint: metricKey ? `metricCache:${metricKey}` : 'metricCache',
      rangeRequested: range,
      startDate,
      endDate,
      source,
      durationMs: 0,
      httpStatus: 200,
    }).catch(() => {});
  }

  const result = attachCacheMeta(data, meta);
  if (source === 'stale') return buildStaleResult(result, provider);
  return result;
}

// ── Pipeline provider ─────────────────────────────────────────────────────────

async function runShopifyLive(params) {
  const rawResult = await fetchRawShopifyData(params);
  return computeShopifyKpis(rawResult);
}

async function runMetaAdsLive(params) {
  const rawResult = await fetchRawMetaAdsData(params);
  const normalized = normalizeMetaAdsInsights(rawResult);
  return computeMetaAdsKpis(normalized);
}

async function runGoogleAdsLive(params) {
  const rawResult = await fetchRawGoogleAdsData(params);
  const normalized = normalizeGoogleAdsRows(rawResult);
  return computeGoogleAdsKpis(normalized);
}

export async function getShopifyKpiResult({ clientId, range, startDate, endDate }) {
  return withMetricCache({
    clientId,
    provider: 'shopify',
    range,
    startDate,
    endDate,
    ttlMs: METRIC_CACHE.SHOPIFY_TTL_MS,
    buildLive: () => runShopifyLive({ clientId, range, startDate, endDate }),
  });
}

export async function getMetaAdsKpiResult({ clientId, range, startDate, endDate }) {
  return withMetricCache({
    clientId,
    provider: 'meta_ads',
    range,
    startDate,
    endDate,
    ttlMs: METRIC_CACHE.META_ADS_TTL_MS,
    buildLive: () => runMetaAdsLive({ clientId, range, startDate, endDate }),
  });
}

export async function getGoogleAdsKpiResult({ clientId, range, startDate, endDate }) {
  return withMetricCache({
    clientId,
    provider: 'google_ads',
    range,
    startDate,
    endDate,
    ttlMs: METRIC_CACHE.GOOGLE_ADS_TTL_MS,
    buildLive: () => runGoogleAdsLive({ clientId, range, startDate, endDate }),
  });
}

// ── Confronto periodi ─────────────────────────────────────────────────────────

async function getProviderKpiResultWithComparison({
  clientId,
  range,
  startDate,
  endDate,
  getKpiResultForRange,
  compareSummaries,
}) {
  const currentDates = assertDateInput(startDate, endDate);
  const previousDates = resolvePreviousMetricsRange(currentDates);
  const previousRange = resolvePreviousRangeLabel(range);

  const currentResult = await getKpiResultForRange({
    clientId,
    range,
    startDate: currentDates.startDate,
    endDate: currentDates.endDate,
  });

  let previousResult;
  try {
    previousResult = await getKpiResultForRange({
      clientId,
      range: previousRange,
      startDate: previousDates.startDate,
      endDate: previousDates.endDate,
    });
  } catch {
    return attachUnavailableKpiComparison({
      currentResult,
      range,
      currentDates,
      previousRange,
      previousDates,
    });
  }

  return attachKpiComparison({
    currentResult,
    previousResult,
    range,
    currentDates,
    previousRange,
    previousDates,
    compareSummaries,
  });
}

export async function getShopifyKpiResultWithComparison(params) {
  return getProviderKpiResultWithComparison({
    ...params,
    getKpiResultForRange: getShopifyKpiResult,
    compareSummaries: compareShopifyKpis,
  });
}

export async function getMetaAdsKpiResultWithComparison(params) {
  return getProviderKpiResultWithComparison({
    ...params,
    getKpiResultForRange: getMetaAdsKpiResult,
    compareSummaries: compareMetaAdsKpis,
  });
}

export async function getGoogleAdsKpiResultWithComparison(params) {
  return getProviderKpiResultWithComparison({
    ...params,
    getKpiResultForRange: getGoogleAdsKpiResult,
    compareSummaries: compareGoogleAdsKpis,
  });
}

const PROVIDER_PIPELINES = Object.freeze({
  shopify: getShopifyKpiResultWithComparison,
  meta_ads: getMetaAdsKpiResultWithComparison,
  google_ads: getGoogleAdsKpiResultWithComparison,
});

// ── buildOverviewMetrics ──────────────────────────────────────────────────────

export async function buildOverviewMetrics({ clientId, range, startDate, endDate }) {
  if (!clientId) {
    throw new BadRequestError('Seleziona un cliente prima di caricare i dati.');
  }

  const normalizedDates = assertDateInput(startDate, endDate);
  const previousDates = resolvePreviousMetricsRange(normalizedDates);
  const cacheParams = {
    clientId,
    provider: 'overview',
    range,
    startDate: normalizedDates.startDate,
    endDate: normalizedDates.endDate,
  };

  const { data, meta, source } = await resolveWithCache({
    cacheParams,
    ttlMs: METRIC_CACHE.OVERVIEW_TTL_MS,
    isCacheValid: hasOverviewComparison,
    buildLive: async () => {
      const integrations = await Integration.find({
        clientId,
        provider: { $in: PROVIDER_ORDER },
      })
        .select('provider status externalRef credentials')
        .lean();

      const integrationByProvider = Object.fromEntries(
        integrations.map((integration) => [integration.provider, integration])
      );

      const providerData = buildProviderDataContainer();
      const warnings = [];
      const attemptedProviders = [];
      const failedProviders = [];
      const availableProviders = [];
      const pipelineTasks = [];

      for (const provider of PROVIDER_ORDER) {
        const integration = integrationByProvider[provider] ?? null;

        if (!isProviderConnected(integration)) {
          warnings.push(buildNotConnectedWarning(provider));
          continue;
        }

        if (!hasRequiredSecrets(provider, integration)) {
          warnings.push(buildIntegrationIncompleteWarning(provider));
          continue;
        }

        attemptedProviders.push(provider);
        pipelineTasks.push(
          PROVIDER_PIPELINES[provider]({
            clientId,
            range,
            startDate: normalizedDates.startDate,
            endDate: normalizedDates.endDate,
          })
        );
      }

      const settled = await Promise.allSettled(pipelineTasks);

      for (let i = 0; i < settled.length; i++) {
        const provider = attemptedProviders[i];
        const result = settled[i];

        if (result.status === 'fulfilled') {
          providerData[provider] = result.value;
          availableProviders.push(provider);
          warnings.push(...collectProviderWarnings(provider, result.value));
        } else {
          providerData[provider] = null;
          failedProviders.push(provider);
          warnings.push(buildFetchFailedWarning(provider));
        }
      }

      return attachOverviewProviderSections({
        data: providerData,
        warnings,
        meta: {
          availableProviders,
          failedProviders,
          attemptedProviders,
          ...buildMetricsPeriodMeta({
            range,
            startDate: normalizedDates.startDate,
            endDate: normalizedDates.endDate,
            comparison: previousDates,
          }),
        },
      });
    },
  });

  if (source === 'cache' || source === 'stale') {
    logSyncSuccess({
      clientId,
      provider: 'overview',
      endpoint: 'metricCache',
      rangeRequested: range,
      startDate: normalizedDates.startDate,
      endDate: normalizedDates.endDate,
      source,
      durationMs: 0,
      httpStatus: 200,
    }).catch(() => {});
  }

  const sectionedResult = attachOverviewProviderSections(data);
  const withMeta = attachPeriodMeta(
    attachCacheMeta(sectionedResult, meta),
    { range, currentDates: normalizedDates, previousDates }
  );

  if (source === 'stale') return buildStaleResult(withMeta, 'overview');
  return withMeta;
}
