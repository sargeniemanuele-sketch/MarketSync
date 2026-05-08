import { BadRequestError } from '../../utils/errors.js';
import { METRIC_CACHE } from '../../config/app.constants.js';
import { buildOverviewMetrics, buildStaleResult } from '../overview/overview.service.js';
import { computeCustomMetrics } from '../customMetrics/customMetrics.service.js';
import { resolveWithCache } from '../cache/metricCache.service.js';
import { buildMetricsPeriodMeta, resolvePreviousMetricsRange } from '../../utils/ranges.js';
import {
  PROVIDER_ORDER,
  attachDashboardProviderSections,
  buildCustomMetricCards,
} from '../../contracts/metrics/cards.js';

function assertInput({ clientId }) {
  if (!clientId) {
    throw new BadRequestError('Seleziona un cliente prima di caricare la dashboard.');
  }
}

function buildProviderContainer(overviewData = {}) {
  return {
    shopify:    overviewData.shopify    ?? null,
    meta_ads:   overviewData.meta_ads   ?? null,
    google_ads: overviewData.google_ads ?? null,
  };
}

function dedupeWarnings(warnings) {
  const list = Array.isArray(warnings) ? warnings : [];
  const seen = new Set();

  return list.filter((warning) => {
    const key = `${warning?.code ?? ''}|${warning?.provider ?? ''}|${warning?.message ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countConnectedProviders(attemptedProviders = []) { return attemptedProviders.length; }
function countSuccessfulProviders(availableProviders = []) { return availableProviders.length; }
function countFailedProviders(failedProviders = [])        { return failedProviders.length; }

function attachCacheMeta(payload, cacheMeta) {
  return {
    ...payload,
    meta: { ...(payload?.meta ?? {}), ...cacheMeta },
  };
}

function attachPeriodMeta(payload, { range, startDate, endDate }) {
  const previousDates = resolvePreviousMetricsRange({ startDate, endDate });

  return {
    ...payload,
    meta: {
      ...(payload?.meta ?? {}),
      ...buildMetricsPeriodMeta({
        range,
        startDate,
        endDate,
        comparison: previousDates,
      }),
    },
  };
}

function buildCustomMetricsFailedWarning() {
  return {
    code: 'CUSTOM_METRICS_FETCH_FAILED',
    provider: 'custom_metric',
    message: 'Impossibile caricare le metriche custom',
  };
}

function attachCustomMetricCards(payload, customMetricsResult) {
  const customMetricCards = buildCustomMetricCards(customMetricsResult.current, {
    previousResult: customMetricsResult.previous,
  });

  return {
    ...payload,
    dashboard: {
      ...(payload?.dashboard ?? {}),
      overview: {
        ...(payload?.dashboard?.overview ?? {}),
        customMetricCards,
      },
    },
    warnings: dedupeWarnings([
      ...(payload?.warnings ?? []),
      ...(customMetricsResult?.current?.warnings ?? []),
    ]),
    meta: {
      ...(payload?.meta ?? {}),
      customMetricCount: customMetricCards.length,
      customMetricSuccessCount: customMetricsResult?.current?.meta?.successCount ?? 0,
      customMetricFailedCount: customMetricsResult?.current?.meta?.failedCount ?? 0,
    },
  };
}

async function tryAttachCustomMetricCards(payload, params) {
  try {
    const previousDates = resolvePreviousMetricsRange({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    const current = await computeCustomMetrics(params);
    let previous = null;

    try {
      previous = await computeCustomMetrics({
        ...params,
        range: 'custom',
        startDate: previousDates.startDate,
        endDate: previousDates.endDate,
      });
    } catch {
      previous = null;
    }

    return attachCustomMetricCards(payload, { current, previous });
  } catch {
    return {
      ...payload,
      dashboard: {
        ...(payload?.dashboard ?? {}),
        overview: {
          ...(payload?.dashboard?.overview ?? {}),
          customMetricCards: [],
        },
      },
      warnings: dedupeWarnings([
        ...(payload?.warnings ?? []),
        buildCustomMetricsFailedWarning(),
      ]),
      meta: {
        ...(payload?.meta ?? {}),
        customMetricCount: 0,
        customMetricSuccessCount: 0,
        customMetricFailedCount: 0,
      },
    };
  }
}

function hasProviderComparison(providerResult) {
  return Boolean(
    providerResult &&
    providerResult.comparison &&
    typeof providerResult.comparison === 'object'
  );
}

function hasDashboardComparison(dashboardResult) {
  const providers = dashboardResult?.dashboard?.providers;
  if (!providers || typeof providers !== 'object') return false;

  return PROVIDER_ORDER.every((provider) => {
    const providerResult = providers[provider] ?? null;
    return providerResult === null || hasProviderComparison(providerResult);
  });
}

export async function buildDashboardData({ clientId, range, startDate, endDate }) {
  assertInput({ clientId });

  const cacheParams = {
    clientId,
    provider: 'dashboard',
    range,
    startDate,
    endDate,
  };

  const { data, meta, source } = await resolveWithCache({
    cacheParams,
    ttlMs: METRIC_CACHE.DASHBOARD_TTL_MS,
    isCacheValid: hasDashboardComparison,
    buildLive: async () => {
      const overview = await buildOverviewMetrics({ clientId, range, startDate, endDate });

      const providers = buildProviderContainer(overview.data);
      const attemptedProviders = overview.meta?.attemptedProviders ?? [];
      const availableProviders = overview.meta?.availableProviders ?? [];
      const failedProviders    = overview.meta?.failedProviders    ?? [];

      return attachDashboardProviderSections({
        dashboard: {
          providers,
          summary: {
            connectedProviders: countConnectedProviders(attemptedProviders),
            successfulProviders: countSuccessfulProviders(availableProviders),
            failedProviders:     countFailedProviders(failedProviders),
            range: overview.meta?.range ?? null,
          },
        },
        warnings: dedupeWarnings(overview.warnings),
        meta: {
          availableProviders,
          failedProviders,
          attemptedProviders,
          ...buildMetricsPeriodMeta({
            range: overview.meta?.range ?? range,
            startDate,
            endDate,
            comparison: overview.meta?.comparison,
          }),
          providerOrder: PROVIDER_ORDER,
        },
      });
    },
  });

  const finalResult = attachDashboardProviderSections(data);
  const withCustomMetrics = await tryAttachCustomMetricCards(finalResult, {
    clientId,
    range,
    startDate,
    endDate,
  });
  const withMeta = attachPeriodMeta(
    attachCacheMeta(withCustomMetrics, meta),
    { range, startDate, endDate }
  );

  if (source === 'stale') return buildStaleResult(withMeta, 'dashboard');
  return withMeta;
}
