import Client from '../../models/Client.js';
import {
  buildAggregateMetricValues,
  formatMetricValue,
} from '../../contracts/metrics/cards.js';
import {
  CUSTOM_METRIC_SOURCE_PROVIDERS,
  isSupportedSourceMetricKey,
} from '../../contracts/metrics/customMetricSources.js';
import { AppError, BadRequestError, NotFoundError } from '../../utils/errors.js';
import { buildMetricsPeriodMeta } from '../../utils/ranges.js';
import {
  buildOverviewMetrics,
  getShopifyKpiResult,
  getMetaAdsKpiResult,
  getGoogleAdsKpiResult,
} from '../overview/overview.service.js';
import {
  getCachedMetric,
  invalidateByMetricKey,
  invalidateByProvider,
  setCachedMetric,
} from '../cache/metricCache.service.js';
import { evaluateFormula as evaluateSafeFormula } from './formulaEngine.service.js';
import { customMetricConfigItemSchema } from '../../validators/shared/customMetric.schema.js';

const DIRECT_PROVIDERS = Object.freeze(['shopify', 'meta_ads', 'google_ads']);
const CUSTOM_METRIC_UNITS = Object.freeze(['currency', 'number', 'percentage', 'ratio']);
const PROVIDER_CONTEXTS = Object.freeze(['overview', 'shopify', 'meta_ads', 'google_ads', 'mixed']);

const PROVIDER_LABEL = Object.freeze({
  shopify: 'Shopify',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
});

function throwDuplicateMetricKeyError() {
  throw new AppError(
    'Esiste già una metrica custom con questa chiave per il cliente selezionato',
    409,
    'CUSTOM_METRIC_ALREADY_EXISTS',
    { scope: 'custom_metrics' }
  );
}

function assertInput({ clientId, startDate, endDate }) {
  if (!clientId) {
    throw new BadRequestError('Seleziona un cliente prima di testare la metrica.');
  }

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

function toNumericOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildProviderDataContainer() {
  return {
    shopify: null,
    meta_ads: null,
    google_ads: null,
  };
}

function attachCacheMeta(payload, cacheMeta) {
  return {
    ...payload,
    meta: {
      ...(payload?.meta ?? {}),
      ...cacheMeta,
    },
  };
}

function attachPeriodMeta(payload, { range, startDate, endDate }) {
  return {
    ...payload,
    meta: {
      ...(payload?.meta ?? {}),
      ...buildMetricsPeriodMeta({ range, startDate, endDate }),
    },
  };
}

function collectRequiredSources(activeMetrics) {
  const sources = new Set();

  for (const metric of activeMetrics) {
    const variables = Array.isArray(metric?.variables) ? metric.variables : [];
    for (const variable of variables) {
      if (variable?.sourceProvider) sources.add(variable.sourceProvider);
    }
  }

  return sources;
}

function deriveProviderContext(variables = []) {
  const providers = [...new Set(
    (Array.isArray(variables) ? variables : [])
      .map((variable) => variable?.sourceProvider)
      .filter(Boolean)
  )];

  const dashboardProviders = providers.filter((provider) => provider !== 'client_setting');
  if (dashboardProviders.length === 1 && PROVIDER_CONTEXTS.includes(dashboardProviders[0])) {
    return dashboardProviders[0];
  }

  if (providers.length === 1 && providers[0] === 'client_setting') {
    return 'mixed';
  }

  return 'mixed';
}

function normalizeMetricConfig(metric) {
  const unit = CUSTOM_METRIC_UNITS.includes(metric?.unit) ? metric.unit : 'number';
  const providerContext = PROVIDER_CONTEXTS.includes(metric?.providerContext)
    ? metric.providerContext
    : deriveProviderContext(metric?.variables);

  return {
    key: metric.key,
    label: metric.label,
    description: metric.description ?? null,
    enabled: metric.enabled !== false,
    unit,
    formula: metric.formula,
    variables: Array.isArray(metric.variables) ? metric.variables : [],
    providerContext,
    createdAt: metric.createdAt,
    updatedAt: metric.updatedAt,
  };
}

function filterOverviewWarnings(warnings, allowedProviderSet) {
  const list = Array.isArray(warnings) ? warnings : [];

  return list.filter((warning) => {
    if (!warning?.provider) return true;
    return allowedProviderSet.has(warning.provider);
  });
}

function buildProviderFetchFailedWarning(provider) {
  return {
    code: 'PROVIDER_FETCH_FAILED',
    provider,
    message: `Impossibile caricare i dati ${PROVIDER_LABEL[provider]}`,
  };
}

function buildOverviewFetchFailedWarning() {
  return {
    code: 'OVERVIEW_FETCH_FAILED',
    message: 'Impossibile caricare i dati overview',
  };
}

const PROVIDER_PIPELINES = Object.freeze({
  shopify: getShopifyKpiResult,
  meta_ads: getMetaAdsKpiResult,
  google_ads: getGoogleAdsKpiResult,
});

async function loadDirectProviderData(providerList, params) {
  const providers = Array.from(providerList);
  const data = buildProviderDataContainer();
  const warnings = [];

  if (providers.length === 0) {
    return { data, warnings };
  }

  const tasks = providers.map((provider) => PROVIDER_PIPELINES[provider](params));
  const settled = await Promise.allSettled(tasks);

  for (let i = 0; i < settled.length; i++) {
    const provider = providers[i];
    const result = settled[i];

    if (result.status === 'fulfilled') {
      data[provider] = result.value;
    } else {
      data[provider] = null;
      warnings.push(buildProviderFetchFailedWarning(provider));
    }
  }

  return { data, warnings };
}

async function buildSourceContext({ requiredSources, activeMetrics, params }) {
  const providerData = buildProviderDataContainer();
  const warnings = [];

  const directProviderSet = new Set(
    Array.from(requiredSources).filter((source) => DIRECT_PROVIDERS.includes(source))
  );

  const needsOverview = requiredSources.has('overview');

  let overviewResult = null;

  if (needsOverview) {
    try {
      overviewResult = await buildOverviewMetrics(params);

      const filteredOverviewWarnings = filterOverviewWarnings(
        overviewResult.warnings,
        directProviderSet
      );

      warnings.push(...filteredOverviewWarnings);

      for (const provider of directProviderSet) {
        providerData[provider] = overviewResult.data?.[provider] ?? null;
      }
    } catch {
      warnings.push(buildOverviewFetchFailedWarning());
    }
  }

  // Se overview non è necessaria, o overview è fallita, recupera solo i provider richiesti direttamente.
  const providersToFetchDirectly = Array.from(directProviderSet).filter(
    (provider) => providerData[provider] === null
  );

  if (providersToFetchDirectly.length > 0 && (!needsOverview || !overviewResult)) {
    const directLoad = await loadDirectProviderData(providersToFetchDirectly, params);

    for (const provider of providersToFetchDirectly) {
      providerData[provider] = directLoad.data[provider];
    }

    warnings.push(...directLoad.warnings);
  }

  return {
    activeMetrics,
    requiredSources,
    directProviderSet,
    overviewResult,
    providerData,
    warnings,
  };
}

function readOverviewMetric(metricKey, overviewResult) {
  if (!overviewResult) {
    return {
      ok: false,
      code: 'OVERVIEW_DATA_UNAVAILABLE',
      message: 'Overview data is unavailable',
    };
  }

  const attemptedProviders = overviewResult?.meta?.attemptedProviders ?? [];
  const availableProviders = overviewResult?.meta?.availableProviders ?? [];
  const failedProviders = overviewResult?.meta?.failedProviders ?? [];

  const aggregateMetrics = buildAggregateMetricValues(overviewResult?.data ?? {});
  const aggregateMetric = aggregateMetrics[metricKey];

  if (aggregateMetric) {
    if (!aggregateMetric.available) {
      return {
        ok: false,
        code: 'OVERVIEW_METRIC_UNAVAILABLE',
        message: `Overview metric '${metricKey}' is unavailable`,
      };
    }

    return { ok: true, value: aggregateMetric.value };
  }

  const supported = {
    connectedProviders: attemptedProviders.length,
    successfulProviders: availableProviders.length,
    failedProviders: failedProviders.length,
    attemptedProvidersCount: attemptedProviders.length,
    availableProvidersCount: availableProviders.length,
    failedProvidersCount: failedProviders.length,
    warningsCount: Array.isArray(overviewResult?.warnings) ? overviewResult.warnings.length : 0,
  };

  if (!(metricKey in supported)) {
    return {
      ok: false,
      code: 'OVERVIEW_METRIC_NOT_SUPPORTED',
      message: `Overview metric '${metricKey}' is not supported`,
    };
  }

  return { ok: true, value: supported[metricKey] };
}

function readProviderMetric(provider, metricKey, sourceContext) {
  const providerData = sourceContext?.providerData?.[provider] ?? null;

  if (!providerData) {
    return {
      ok: false,
      code: 'PROVIDER_DATA_UNAVAILABLE',
      message: `${provider} data is unavailable`,
    };
  }

  const fromSummary = toNumericOrNull(providerData?.summary?.[metricKey]);
  if (fromSummary != null) {
    return { ok: true, value: fromSummary };
  }

  const fromMeta = toNumericOrNull(providerData?.meta?.[metricKey]);
  if (fromMeta != null) {
    return { ok: true, value: fromMeta };
  }

  return {
    ok: false,
    code: 'PROVIDER_METRIC_MISSING',
    message: `${provider} metric '${metricKey}' is unavailable`,
  };
}

function readClientSettingMetric(metricKey, context) {
  const client = context?.client ?? {};
  const metrics = Array.isArray(client.customMetricsConfig) ? client.customMetricsConfig : [];
  const bs = client.businessSettings ?? {};

  if (metricKey === 'commission_percentage') {
    const val = bs.commissionPercentage ?? null;
    if (val === null) {
      return { ok: false, code: 'CLIENT_SETTING_NOT_CONFIGURED', message: 'commission_percentage non configurata sul cliente' };
    }
    return { ok: true, value: val };
  }

  if (metricKey === 'fixed_commission') {
    const val = bs.fixedCommission ?? null;
    if (val === null) {
      return { ok: false, code: 'CLIENT_SETTING_NOT_CONFIGURED', message: 'fixed_commission non configurata sul cliente' };
    }
    return { ok: true, value: val };
  }

  if (metricKey === 'extra_costs_total') {
    const extraCosts = Array.isArray(bs.extraCosts) ? bs.extraCosts : [];
    const fixedCosts = extraCosts.filter((c) => c?.type === 'fixed');
    const percentageCosts = extraCosts.filter((c) => c?.type === 'percentage');
    const total = fixedCosts.reduce((sum, c) => sum + (Number(c.value) || 0), 0);
    const result = { ok: true, value: total };
    if (percentageCosts.length > 0) {
      result.warnings = [{
        code: 'EXTRA_COSTS_PERCENTAGE_SKIPPED',
        message: `${percentageCosts.length} costo/i extra in percentuale non incluso/i nel totale (base di calcolo non disponibile)`,
      }];
    }
    return result;
  }

  const legacySupported = {
    custom_metric_count: metrics.length,
    active_custom_metric_count: metrics.filter((m) => m?.enabled !== false).length,
  };

  if (!(metricKey in legacySupported)) {
    return {
      ok: false,
      code: 'CLIENT_SETTING_METRIC_NOT_SUPPORTED',
      message: `Client setting metric '${metricKey}' is not supported`,
    };
  }

  return { ok: true, value: legacySupported[metricKey] };
}

function resolveVariable(variable, context) {
  if (!variable || typeof variable !== 'object') {
    return {
      ok: false,
      code: 'VARIABLE_INVALID',
      message: 'La variabile configurata non è valida.',
    };
  }

  if (!CUSTOM_METRIC_SOURCE_PROVIDERS.includes(variable.sourceProvider)) {
    return {
      ok: false,
      code: 'VARIABLE_SOURCE_UNSUPPORTED',
      message: `Variable source '${variable.sourceProvider}' is not supported`,
    };
  }

  if (!isSupportedSourceMetricKey(variable.sourceProvider, variable.metricKey)) {
    return {
      ok: false,
      code: 'VARIABLE_METRIC_UNSUPPORTED',
      message: `Metric '${variable.metricKey}' is not supported for source '${variable.sourceProvider}'`,
    };
  }

  if (variable.sourceProvider === 'overview') {
    return readOverviewMetric(variable.metricKey, context.sourceContext.overviewResult);
  }

  if (variable.sourceProvider === 'client_setting') {
    return readClientSettingMetric(variable.metricKey, context);
  }

  return readProviderMetric(variable.sourceProvider, variable.metricKey, context.sourceContext);
}

function buildMetricFailure(metric, variableValues, errorCode) {
  const normalizedMetric = normalizeMetricConfig(metric);
  return {
    key: normalizedMetric.key,
    label: normalizedMetric.label,
    description: normalizedMetric.description,
    enabled: normalizedMetric.enabled,
    unit: normalizedMetric.unit,
    value: null,
    formattedValue: 'Non disponibile',
    formula: normalizedMetric.formula,
    providerContext: normalizedMetric.providerContext,
    variables: variableValues,
    variableDefinitions: normalizedMetric.variables,
    warnings: [],
    availability: {
      status: 'not_available',
      message: 'Metrica custom non disponibile per questo periodo.',
    },
    status: 'not_available',
    errorCode,
  };
}

function buildMetricSuccess(metric, variableValues, value) {
  const normalizedMetric = normalizeMetricConfig(metric);
  return {
    key: normalizedMetric.key,
    label: normalizedMetric.label,
    description: normalizedMetric.description,
    enabled: normalizedMetric.enabled,
    unit: normalizedMetric.unit,
    value,
    formattedValue: formatMetricValue(value, normalizedMetric.unit),
    formula: normalizedMetric.formula,
    providerContext: normalizedMetric.providerContext,
    variables: variableValues,
    variableDefinitions: normalizedMetric.variables,
    warnings: [],
    availability: {
      status: 'available',
      message: null,
    },
    status: 'ok',
  };
}

function dedupeWarnings(warnings) {
  const seen = new Set();
  const list = Array.isArray(warnings) ? warnings : [];

  return list.filter((warning) => {
    const key = [warning?.code ?? '', warning?.metricKey ?? '', warning?.variableKey ?? '', warning?.provider ?? '', warning?.message ?? ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toMetricArray(config) {
  if (!Array.isArray(config)) return [];
  return config
    .filter((metric) => metric?.enabled !== false)
    .map(normalizeMetricConfig);
}

function serializeMetricConfig(metric) {
  return normalizeMetricConfig(metric);
}

function ensureUniqueMetricKeys(metrics, ignoreKey = null) {
  const seen = new Set();

  for (const metric of metrics) {
    if (metric.key === ignoreKey) continue;
    if (seen.has(metric.key)) throwDuplicateMetricKeyError();
    seen.add(metric.key);
  }
}

async function getOwnedClient(ownerUserId, clientId) {
  const client = await Client.findOne({ _id: clientId, ownerUserId }).lean();
  if (!client) {
    throw new NotFoundError('Cliente non trovato.', { scope: 'custom_metrics' });
  }
  return client;
}

async function getOwnedClientDocument(ownerUserId, clientId) {
  const client = await Client.findOne({ _id: clientId, ownerUserId });
  if (!client) {
    throw new NotFoundError('Cliente non trovato.', { scope: 'custom_metrics' });
  }
  return client;
}

function prepareMetricForSave(metric, existing = null) {
  const prepared = {
    key: metric.key ?? existing?.key,
    label: metric.label ?? existing?.label,
    description: Object.prototype.hasOwnProperty.call(metric, 'description')
      ? metric.description
      : existing?.description ?? null,
    enabled: Object.prototype.hasOwnProperty.call(metric, 'enabled')
      ? metric.enabled !== false
      : existing?.enabled !== false,
    unit: metric.unit ?? existing?.unit ?? 'number',
    formula: metric.formula ?? existing?.formula,
    variables: metric.variables ?? existing?.variables ?? [],
    providerContext: metric.providerContext ?? deriveProviderContext(metric.variables ?? existing?.variables),
  };

  const validation = customMetricConfigItemSchema.safeParse(prepared);
  if (!validation.success) {
    throw new BadRequestError(
      validation.error.issues.map((issue) => issue.message).join('; '),
      { scope: 'custom_metrics' }
    );
  }

  return validation.data;
}

function normalizeClientMetricArrayForSave(client) {
  client.customMetricsConfig = (client.customMetricsConfig ?? []).map((item) => {
    return prepareMetricForSave(item.toObject?.() ?? item);
  });
}

async function computeMetricPreview({ client, metric, range, startDate, endDate }) {
  const normalizedDates = assertInput({ clientId: client._id, startDate, endDate });
  const preparedMetric = prepareMetricForSave(metric);
  const sourceContext = await buildSourceContext({
    requiredSources: collectRequiredSources([preparedMetric]),
    activeMetrics: [preparedMetric],
    params: {
      clientId: client._id,
      range,
      startDate: normalizedDates.startDate,
      endDate: normalizedDates.endDate,
    },
  });
  const context = { client, sourceContext };
  const variableValues = {};
  const warnings = [...sourceContext.warnings];
  let hasVariableErrors = false;

  for (const variable of preparedMetric.variables) {
    const resolution = resolveVariable(variable, context);
    if (resolution.ok) {
      variableValues[variable.variableKey] = resolution.value;
      if (Array.isArray(resolution.warnings)) {
        warnings.push(...resolution.warnings.map((w) => ({
          ...w,
          metricKey: preparedMetric.key,
          variableKey: variable.variableKey,
        })));
      }
    } else {
      hasVariableErrors = true;
      variableValues[variable.variableKey] = null;
      warnings.push({
        code: resolution.code,
        metricKey: preparedMetric.key,
        variableKey: variable.variableKey,
        provider: variable.sourceProvider,
        message: resolution.message,
      });
    }
  }

  if (hasVariableErrors) {
    return {
      metric: buildMetricFailure(preparedMetric, variableValues, 'VARIABLE_RESOLUTION_FAILED'),
      warnings: dedupeWarnings(warnings),
    };
  }

  try {
    const value = evaluateSafeFormula(
      preparedMetric.formula,
      variableValues,
      preparedMetric.variables.map((variable) => variable.variableKey)
    );

    return {
      metric: buildMetricSuccess(preparedMetric, variableValues, value),
      warnings: dedupeWarnings(warnings),
    };
  } catch (error) {
    warnings.push({
      code: error?.code ?? 'FORMULA_EVALUATION_ERROR',
      metricKey: preparedMetric.key,
      message: error?.message ?? 'Custom metric formula could not be evaluated',
    });

    return {
      metric: buildMetricFailure(
        preparedMetric,
        variableValues,
        error?.code ?? 'FORMULA_EVALUATION_ERROR'
      ),
      warnings: dedupeWarnings(warnings),
    };
  }
}

/**
 * TODO: buildCustomMetricSparkline
 *
 * Calcola la sparkline di una metrica custom punto per punto sulle serie temporali delle sorgenti.
 *
 * Dati mancanti per completare l'implementazione:
 * - Serie temporali per sourceProvider: attualmente shopify/meta_ads/google_ads espongono solo
 *   il summary aggregato (un valore per periodo), non una mappa date→valore per ogni metricKey.
 *   Servono pipeline separate che restituiscano Array<{ date: string, value: number }> per metricKey.
 * - Allineamento date: le sorgenti possono avere granularità diverse; serve costruire una lista
 *   di dateKey comuni (intersezione) prima di valutare la formula punto per punto.
 * - client_setting non ha serie temporali: le sue variabili sono costanti di periodo e vanno
 *   replicate su ogni punto della sparkline senza interpolazione.
 *
 * Signature attesa:
 * @param {object} metric           - Config metrica custom normalizzata (key, formula, variables, unit)
 * @param {object} sourceSeriesMap  - Map<sourceProvider, Map<metricKey, Map<dateKey, number>>>
 * @param {object} clientSettings   - businessSettings del cliente (per variabili client_setting)
 * @param {string} [granularity]
 * @returns {{ granularity: string, points: Array<{ date, label, value, formattedValue }> } | null}
 */
// eslint-disable-next-line no-unused-vars
function buildCustomMetricSparkline(_metric, _sourceSeriesMap, _clientSettings, _granularity) {
  // TODO: implementare
  // 1. Raccogliere date comuni da sourceSeriesMap (escludere client_setting che è costante)
  // 2. Per ogni dateKey: risolvere variabili (sorgente serie o costante client_setting)
  // 3. Valutare la formula con evaluateSafeFormula per ogni punto
  // 4. Costruire { date, value } array e passare a buildSparkline(points, { granularity, unit })
  return null;
}

/**
 * Calcola metriche custom per un client con valutazione sicura delle formule.
 *
 * Modello di sicurezza:
 * - Nessun eval, nessun costruttore Function, nessuna VM.
 * - La formula viene tokenizzata, parsata in RPN (shunting-yard), poi valutata deterministicamente.
 * - Sintassi supportata: numeri, variabili, + - * /, parentesi.
 *
 * Modello di caricamento dati:
 * - Pre-scansiona le metriche abilitate per rilevare i provider sorgente richiesti.
 * - Carica solo le sorgenti provider richieste (shopify/meta_ads/google_ads).
 * - Carica overview solo quando almeno una variabile usa sourceProvider:'overview'.
 *
 * Modello di isolamento errori:
 * - I fallimenti sono isolati per metrica; un errore su una metrica non interrompe mai le altre.
 * - Ogni metrica fallita riceve status:error ed errorCode stabile.
 * - I warning vengono accumulati e deduplicati.
 *
 * @param {object} params
 * @param {string} params.clientId
 * @param {string} params.range
 * @param {Date|string} params.startDate
 * @param {Date|string} params.endDate
 *
 * @returns {Promise<{
 *   metrics: Array<{
 *     key: string,
 *     label: string,
 *     value: number|null,
 *     formula: string,
 *     variables: Record<string, number|null>,
 *     status: 'ok'|'error',
 *     errorCode?: string,
 *   }>,
 *   warnings: Array<{ code: string, metricKey?: string, variableKey?: string, provider?: string, message: string }>,
 *   meta: {
 *     metricCount: number,
 *     successCount: number,
 *     failedCount: number,
 *     range: string|null,
 *     startDate: Date,
 *     endDate: Date,
 *   }
 * }>}
 */
export async function computeCustomMetrics({ clientId, range, startDate, endDate, granularity = null }) {
  const normalizedDates = assertInput({ clientId, startDate, endDate });
  const client = await Client.findById(clientId)
    .select('customMetricsConfig businessSettings')
    .lean();

  if (!client) {
    throw new NotFoundError('Cliente non trovato.', { scope: 'custom_metrics' });
  }

  const activeMetrics = toMetricArray(client.customMetricsConfig);
  const cachedMetrics = [];
  const metricsToCompute = [];
  const cacheMetas = {};

  for (const metric of activeMetrics) {
    const cached = await getCachedMetric({
      clientId,
      provider: 'custom_metric',
      metricKey: metric.key,
      granularity,
      range,
      startDate: normalizedDates.startDate,
      endDate: normalizedDates.endDate,
    });

    if (cached.hit) {
      cachedMetrics.push(cached.data);
      cacheMetas[metric.key] = cached.meta;
    } else {
      metricsToCompute.push(metric);
    }
  }

  const requiredSources = collectRequiredSources(metricsToCompute);

  const sourceContext = await buildSourceContext({
    requiredSources,
    activeMetrics: metricsToCompute,
    params: {
      clientId,
      range,
      startDate: normalizedDates.startDate,
      endDate: normalizedDates.endDate,
    },
  });

  const context = {
    client,
    sourceContext,
  };

  const metrics = [...cachedMetrics];
  const warnings = [...sourceContext.warnings];

  for (const metric of metricsToCompute) {
    const variableValues = {};
    let hasVariableErrors = false;

    const variables = Array.isArray(metric.variables) ? metric.variables : [];

    for (const variable of variables) {
      const resolution = resolveVariable(variable, context);

      if (resolution.ok) {
        variableValues[variable.variableKey] = resolution.value;
        if (Array.isArray(resolution.warnings)) {
          warnings.push(...resolution.warnings.map((w) => ({
            ...w,
            metricKey: metric.key,
            variableKey: variable.variableKey,
          })));
        }
      } else {
        hasVariableErrors = true;
        variableValues[variable.variableKey] = null;

        warnings.push({
          code: resolution.code,
          metricKey: metric.key,
          variableKey: variable.variableKey,
          provider: variable.sourceProvider,
          message: resolution.message,
        });
      }
    }

    if (hasVariableErrors) {
      const failedMetric = buildMetricFailure(metric, variableValues, 'VARIABLE_RESOLUTION_FAILED');
      metrics.push(failedMetric);
      warnings.push({
        code: 'CUSTOM_METRIC_FAILED',
        metricKey: metric.key,
        message: 'Custom metric could not be computed due to unresolved variables',
      });
      await setCachedMetric({
        clientId,
        provider: 'custom_metric',
        metricKey: metric.key,
        granularity,
        range,
        startDate: normalizedDates.startDate,
        endDate: normalizedDates.endDate,
      }, failedMetric);
      continue;
    }

    try {
      const evaluatedValue = evaluateSafeFormula(
        metric.formula,
        variableValues,
        variables.map((variable) => variable.variableKey)
      );

      const successMetric = buildMetricSuccess(metric, variableValues, evaluatedValue);
      metrics.push(successMetric);
      await setCachedMetric({
        clientId,
        provider: 'custom_metric',
        metricKey: metric.key,
        granularity,
        range,
        startDate: normalizedDates.startDate,
        endDate: normalizedDates.endDate,
      }, successMetric);
    } catch (err) {
      const errorCode = err?.code ?? 'FORMULA_EVALUATION_ERROR';

      const failedMetric = buildMetricFailure(metric, variableValues, errorCode);
      metrics.push(failedMetric);

      warnings.push({
        code: errorCode,
        metricKey: metric.key,
        message: err.message || 'Custom metric formula could not be evaluated',
      });

      warnings.push({
        code: 'CUSTOM_METRIC_FAILED',
        metricKey: metric.key,
        message: 'Custom metric could not be computed',
      });

      await setCachedMetric({
        clientId,
        provider: 'custom_metric',
        metricKey: metric.key,
        granularity,
        range,
        startDate: normalizedDates.startDate,
        endDate: normalizedDates.endDate,
      }, failedMetric);
    }
  }

  metrics.sort((a, b) => {
    const ai = activeMetrics.findIndex((metric) => metric.key === a.key);
    const bi = activeMetrics.findIndex((metric) => metric.key === b.key);
    return ai - bi;
  });

  const successCount = metrics.filter((item) => item.status === 'ok').length;
  const failedCount = metrics.length - successCount;

  const customMetricsResult = {
    metrics,
    warnings: dedupeWarnings(warnings),
    meta: {
      metricCount: metrics.length,
      successCount,
      failedCount,
      cachedMetricKeys: Object.keys(cacheMetas),
      ...buildMetricsPeriodMeta({
        range,
        startDate: normalizedDates.startDate,
        endDate: normalizedDates.endDate,
      }),
    },
  };

  return attachPeriodMeta(
    attachCacheMeta(customMetricsResult, {
      source: metricsToCompute.length === 0 ? 'cache' : 'live',
    }),
    {
      range,
      startDate: normalizedDates.startDate,
      endDate: normalizedDates.endDate,
    }
  );
}

export async function listCustomMetrics(ownerUserId, clientId) {
  const client = await getOwnedClient(ownerUserId, clientId);
  return {
    metrics: (client.customMetricsConfig ?? []).map(serializeMetricConfig),
    meta: {
      clientId,
      metricCount: Array.isArray(client.customMetricsConfig) ? client.customMetricsConfig.length : 0,
    },
  };
}

export async function createCustomMetric(ownerUserId, clientId, metric) {
  const client = await getOwnedClientDocument(ownerUserId, clientId);
  normalizeClientMetricArrayForSave(client);
  const currentMetrics = (client.customMetricsConfig ?? []).map((item) => item.toObject?.() ?? item);

  if (currentMetrics.some((item) => item.key === metric.key)) {
    throwDuplicateMetricKeyError();
  }

  const nextMetric = prepareMetricForSave(metric);
  ensureUniqueMetricKeys([...currentMetrics, nextMetric]);
  client.customMetricsConfig.push(nextMetric);
  await client.save();
  await invalidateByMetricKey(clientId, metric.key);

  return serializeMetricConfig(client.customMetricsConfig.at(-1).toObject());
}

export async function updateCustomMetric(ownerUserId, clientId, metricKey, patch) {
  const client = await getOwnedClientDocument(ownerUserId, clientId);
  normalizeClientMetricArrayForSave(client);
  const metrics = client.customMetricsConfig ?? [];
  const index = metrics.findIndex((item) => item.key === metricKey);

  if (index < 0) {
    throw new NotFoundError('Metrica personalizzata non trovata.', { scope: 'custom_metrics' });
  }

  if (patch.key && patch.key !== metricKey && metrics.some((item) => item.key === patch.key)) {
    throwDuplicateMetricKeyError();
  }

  const existing = metrics[index].toObject?.() ?? metrics[index];
  const nextMetric = prepareMetricForSave(patch, existing);
  metrics[index].set?.(nextMetric);
  if (!metrics[index].set) metrics[index] = nextMetric;

  ensureUniqueMetricKeys(metrics.map((item) => item.toObject?.() ?? item));
  await client.save();
  await invalidateByMetricKey(clientId, metricKey);
  if (nextMetric.key !== metricKey) {
    await invalidateByMetricKey(clientId, nextMetric.key);
  }

  return serializeMetricConfig((metrics[index].toObject?.() ?? metrics[index]));
}

export async function deleteCustomMetric(ownerUserId, clientId, metricKey) {
  const client = await getOwnedClientDocument(ownerUserId, clientId);
  normalizeClientMetricArrayForSave(client);
  const beforeCount = client.customMetricsConfig.length;
  client.customMetricsConfig = client.customMetricsConfig.filter((item) => item.key !== metricKey);

  if (client.customMetricsConfig.length === beforeCount) {
    throw new NotFoundError('Metrica personalizzata non trovata.', { scope: 'custom_metrics' });
  }

  await client.save();
  await invalidateByMetricKey(clientId, metricKey);
  return { deleted: true, metricKey };
}

export async function previewCustomMetric(ownerUserId, clientId, metric, { range, startDate, endDate }) {
  const client = await getOwnedClient(ownerUserId, clientId);
  const preview = await computeMetricPreview({
    client,
    metric,
    range,
    startDate,
    endDate,
  });

  return {
    metric: preview.metric,
    warnings: preview.warnings,
    meta: {
      clientId,
      source: 'live',
      cache: 'bypass',
    },
  };
}

export async function invalidateCustomMetricConfigCache(clientId) {
  return invalidateByProvider(clientId, 'custom_metric');
}
