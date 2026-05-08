import MetricCache from '../../models/MetricCache.js';
import { METRIC_CACHE } from '../../config/app.constants.js';
import { BadRequestError } from '../../utils/errors.js';
import { normalizeProviderSlug } from '../../utils/providers.js';

// Mappa in-flight per deduplicare fetch live identiche concorrenti.
// Chiave: stringa cache key. Valore: Promise<{ data, meta, source }>.
// Ogni entry viene rimossa nel finally block della fetch live, indipendentemente dall'esito.
// Approccio single-instance (in-memory); sufficiente per MVP senza Redis.
const inflightMap = new Map();

// ── Helpers interni ───────────────────────────────────────────────────────────

function normalizeDate(date, fieldName) {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError('Intervallo di date non valido.', { scope: 'cache' });
  }
  return parsed;
}

function resolveMetricKey(provider, metricKey = null) {
  const normalizedProvider = normalizeProviderSlug(provider) ?? provider;

  if (normalizedProvider === 'custom_metric') {
    if (!metricKey || typeof metricKey !== 'string' || metricKey.trim() === '') {
      throw new BadRequestError(
        'Seleziona una metrica personalizzata.',
        { scope: 'cache' }
      );
    }
    return metricKey.trim();
  }

  if (typeof metricKey === 'string' && metricKey.trim()) {
    return metricKey.trim();
  }

  return null;
}

function resolveGranularity(granularity = null) {
  if (typeof granularity === 'string' && granularity.trim()) {
    return granularity.trim();
  }

  return null;
}

function buildFilter({
  clientId,
  provider,
  metricKey = null,
  granularity = null,
  range,
  startDate,
  endDate,
}) {
  if (!clientId) {
    throw new BadRequestError('Seleziona un cliente prima di caricare i dati.', { scope: 'cache' });
  }

  if (!provider) {
    throw new BadRequestError('Seleziona una piattaforma prima di caricare i dati.', { scope: 'cache' });
  }

  if (!range) {
    throw new BadRequestError('Seleziona un periodo prima di caricare i dati.', { scope: 'cache' });
  }

  const normalizedProvider = normalizeProviderSlug(provider) ?? provider;

  return {
    clientId,
    provider: normalizedProvider,
    metricKey: resolveMetricKey(normalizedProvider, metricKey),
    granularity: resolveGranularity(granularity),
    range,
    startDate: normalizeDate(startDate, 'startDate'),
    endDate: normalizeDate(endDate, 'endDate'),
  };
}

function buildCacheMeta(source, fetchedAt, expiresAt) {
  return {
    source,
    lastFetchedAt: fetchedAt,
    cachedUntil: expiresAt,
    nextLiveFetchAvailableAt: expiresAt,
  };
}

// Chiave stringa univoca per la mappa in-flight.
function buildCacheKey({ clientId, provider, metricKey, granularity, range, startDate, endDate }) {
  const start = startDate instanceof Date ? startDate.toISOString() : String(startDate ?? '');
  const end   = endDate   instanceof Date ? endDate.toISOString()   : String(endDate   ?? '');
  return `${clientId}:${provider}:${metricKey ?? ''}:${granularity ?? ''}:${range}:${start}:${end}`;
}

function computeExpiry(ttlMs = METRIC_CACHE.DEFAULT_TTL_MS) {
  const fetchedAt      = new Date();
  const expiresAt      = new Date(fetchedAt.getTime() + ttlMs);
  const staleExpiresAt = new Date(fetchedAt.getTime() + METRIC_CACHE.STALE_MAX_AGE_MS);
  return { fetchedAt, expiresAt, staleExpiresAt };
}

// ── Lettura: cache fresca ─────────────────────────────────────────────────────

export async function getCachedMetric(params) {
  const filter = buildFilter(params);

  const doc = await MetricCache.findOne({
    ...filter,
    expiresAt: { $gt: new Date() },
  }).lean();

  if (!doc) {
    return { hit: false, data: null, meta: null };
  }

  return {
    hit: true,
    data: doc.responsePayload,
    meta: buildCacheMeta('cache', doc.fetchedAt, doc.expiresAt),
  };
}

// ── Lettura: cache stale (scaduta ma entro la finestra 24h) ──────────────────

export async function getStaleMetric(params) {
  const filter = buildFilter(params);
  const now = new Date();

  const doc = await MetricCache.findOne({
    ...filter,
    expiresAt:      { $lte: now },   // scaduta (non più fresca)
    staleExpiresAt: { $gt: now },    // ma ancora entro la finestra stale
  }).lean();

  if (!doc) {
    return { hit: false, data: null, meta: null };
  }

  return {
    hit: true,
    data: doc.responsePayload,
    meta: buildCacheMeta('stale', doc.fetchedAt, doc.expiresAt),
  };
}

// ── Scrittura ─────────────────────────────────────────────────────────────────

export async function setCachedMetric(params, payload, { ttlMs } = {}) {
  const filter = buildFilter(params);
  const { fetchedAt, expiresAt, staleExpiresAt } = computeExpiry(ttlMs);

  await MetricCache.findOneAndUpdate(
    filter,
    {
      $set: {
        responsePayload: payload,
        source: 'live',
        fetchedAt,
        expiresAt,
        staleExpiresAt,
      },
    },
    { upsert: true, new: true }
  );

  return {
    meta: buildCacheMeta('live', fetchedAt, expiresAt),
  };
}

// ── Orchestratore principale: cache → dedup → live → stale ───────────────────

/**
 * Risolve una metrica rispettando la policy: cache fresca → dedup in-flight → fetch live → stale.
 *
 * @param {object}   opts
 * @param {object}   opts.cacheParams  Parametri filtro cache (clientId, provider, range, …)
 * @param {Function} opts.buildLive    Async function che esegue la fetch live e ritorna i dati grezzi
 * @param {number}   [opts.ttlMs]      TTL per il documento cache; default: METRIC_CACHE.DEFAULT_TTL_MS
 * @param {Function} [opts.isCacheValid] Validatore opzionale: se ritorna false il cache hit viene ignorato
 *
 * @returns {Promise<{ data: any, meta: object, source: 'cache'|'live'|'stale' }>}
 */
export async function resolveWithCache({ cacheParams, buildLive, ttlMs, isCacheValid }) {
  // 1. Cache fresca
  const cached = await getCachedMetric(cacheParams);
  if (cached.hit && (!isCacheValid || isCacheValid(cached.data))) {
    return { data: cached.data, meta: cached.meta, source: 'cache' };
  }

  const key = buildCacheKey(cacheParams);

  // 2. Dedup in-flight: se una fetch identica è già in corso, attende la stessa Promise
  if (inflightMap.has(key)) {
    try {
      return await inflightMap.get(key);
    } catch (inflightError) {
      // La fetch in-flight è fallita: prova stale prima di propagare l'errore
      const stale = await getStaleMetric(cacheParams);
      if (stale.hit) return { data: stale.data, meta: stale.meta, source: 'stale' };
      throw inflightError;
    }
  }

  // 3. Fetch live: wrappata in Promise per consentire la dedup
  const livePromise = (async () => {
    const liveData = await buildLive();
    const { meta: cacheMeta } = await setCachedMetric(cacheParams, liveData, { ttlMs });
    return { data: liveData, meta: cacheMeta, source: 'live' };
  })();

  inflightMap.set(key, livePromise);

  try {
    return await livePromise;
  } catch (error) {
    // 4. Stale fallback: se esiste un documento scaduto entro 24h, lo usa con warning
    const stale = await getStaleMetric(cacheParams);
    if (stale.hit) return { data: stale.data, meta: stale.meta, source: 'stale' };
    throw error;
  } finally {
    // Pulizia sempre: il successore troverà cache popolata (se live riuscita)
    // oppure ripeterà il ciclo (se fallita e nessun stale).
    inflightMap.delete(key);
  }
}

// ── Invalidazione ─────────────────────────────────────────────────────────────

export async function invalidateByClient(clientId) {
  const { deletedCount } = await MetricCache.deleteMany({ clientId });
  return { deletedCount: deletedCount ?? 0 };
}

export async function invalidateByProvider(clientId, provider) {
  const normalizedProvider = normalizeProviderSlug(provider) ?? provider;
  const { deletedCount } = await MetricCache.deleteMany({ clientId, provider: normalizedProvider });
  return { deletedCount: deletedCount ?? 0 };
}

export async function invalidateByMetricKey(clientId, metricKey) {
  const { deletedCount } = await MetricCache.deleteMany({
    clientId,
    provider: 'custom_metric',
    metricKey,
  });
  return { deletedCount: deletedCount ?? 0 };
}

export async function cleanupExpiredMetricCache() {
  const { deletedCount } = await MetricCache.deleteMany({
    expiresAt: { $lte: new Date() },
    staleExpiresAt: { $lte: new Date() },
  });

  return { deletedCount: deletedCount ?? 0 };
}
