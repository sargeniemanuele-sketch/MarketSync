import SyncLog from '../../models/SyncLog.js';
import { SYNC_LOG } from '../../config/app.constants.js';
import { normalizeProviderSlug } from '../../utils/providers.js';

// ── Helper di normalizzazione ─────────────────────────────────────────────────

/**
 * Restituisce un valore intero non negativo in millisecondi oppure null.
 * Rifiuta silenziosamente valori negativi, non finiti o non numerici.
 */
function normalizeDurationMs(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/**
 * Restituisce un codice di stato HTTP valido (100–599) oppure null.
 */
function normalizeHttpStatus(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 100 && n <= 599 ? n : null;
}

/**
 * Estrae un messaggio di errore sicuro in testo semplice.
 * Non persiste mai stack trace, oggetti grezzi o payload provider.
 */
function normalizeErrorMessage(error) {
  if (!error) return 'Unknown sync error';
  if (typeof error === 'string') return error.trim() || 'Unknown sync error';
  if (error instanceof Error) return error.message || 'Unknown sync error';
  return 'Unknown sync error';
}

/**
 * Converte un valore in Date oppure null.
 */
function normalizeDate(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Builder documento interno ─────────────────────────────────────────────────

function buildLogDoc({
  clientId,
  provider,
  endpoint,
  rangeRequested,
  startDate,
  endDate,
  source,
  status,
  httpStatus,
  durationMs,
  errorMessage,
  errorCode,
}) {
  return {
    clientId,
    provider: normalizeProviderSlug(provider) ?? provider,
    endpoint:       endpoint ?? null,
    rangeRequested: rangeRequested ?? null,
    startDate:      normalizeDate(startDate),
    endDate:        normalizeDate(endDate),
    source,
    status,
    httpStatus:     normalizeHttpStatus(httpStatus),
    durationMs:     normalizeDurationMs(durationMs),
    errorMessage:   errorMessage ?? null,
    errorCode:      typeof errorCode === 'string' && errorCode.trim() ? errorCode.trim() : null,
  };
}

// ── Scrittura: successo ───────────────────────────────────────────────────────

/**
 * Registra un'operazione di sync riuscita.
 *
 * @param {object} params
 * @param {string}      params.clientId
 * @param {string}      params.provider       Valore enum SyncLog.provider
 * @param {string}      [params.endpoint]     Etichetta endpoint specifica del provider
 * @param {string}      [params.rangeRequested]
 * @param {Date}        [params.startDate]
 * @param {Date}        [params.endDate]
 * @param {'live'|'cache'} params.source
 * @param {number}      [params.httpStatus]
 * @param {number}      [params.durationMs]   Tempo reale dell'operazione
 */
export async function logSyncSuccess({
  clientId,
  provider,
  endpoint = null,
  rangeRequested = null,
  startDate = null,
  endDate = null,
  source,
  httpStatus = null,
  durationMs = null,
}) {
  return SyncLog.create(buildLogDoc({
    clientId,
    provider,
    endpoint,
    rangeRequested,
    startDate,
    endDate,
    source,
    status: 'success',
    httpStatus,
    durationMs,
    errorMessage: null,
  }));
}

// ── Scrittura: errore ─────────────────────────────────────────────────────────

/**
 * Registra un'operazione di sync fallita.
 *
 * `error` accetta un'istanza Error, una stringa semplice o null.
 * Viene persistito solo il messaggio: nessuno stack trace, nessun payload provider grezzo.
 *
 * @param {object} params
 * @param {string}      params.clientId
 * @param {string}      params.provider
 * @param {string}      [params.endpoint]
 * @param {string}      [params.rangeRequested]
 * @param {Date}        [params.startDate]
 * @param {Date}        [params.endDate]
 * @param {'live'|'cache'} [params.source]    Predefinito a 'live' (gli errori di solito arrivano da fetch live)
 * @param {number}      [params.httpStatus]
 * @param {number}      [params.durationMs]
 * @param {Error|string|null} [params.error]
 */
export async function logSyncError({
  clientId,
  provider,
  endpoint = null,
  rangeRequested = null,
  startDate = null,
  endDate = null,
  source = 'live',
  httpStatus = null,
  durationMs = null,
  error = null,
  errorCode = null,
}) {
  const resolvedErrorCode = errorCode
    ?? (error instanceof Error ? (error.code ?? null) : null);

  return SyncLog.create(buildLogDoc({
    clientId,
    provider,
    endpoint,
    rangeRequested,
    startDate,
    endDate,
    source,
    status: 'error',
    httpStatus,
    durationMs,
    errorMessage: normalizeErrorMessage(error),
    errorCode: resolvedErrorCode,
  }));
}

// ── Lettura: mappa ultimo sync ────────────────────────────────────────────────

/**
 * Restituisce la voce sync più recente per ogni provider principale di un client.
 *
 * Strategia: una findOne per provider, eseguite in parallelo con Promise.all.
 * Ogni query usa direttamente l'indice composto { clientId, provider, createdAt: -1 }:
 * lookup ottimale senza complessità da pipeline di aggregazione.
 *
 * Struttura:
 *   { shopify: { lastSyncAt, source, status }, meta_ads: {...}, google_ads: {...} }
 *
 * Provider mancanti → { lastSyncAt: null, source: null, status: null }
 *
 * @param {string} clientId
 */
export async function getLastSyncMapByClient(clientId) {
  const results = await Promise.all(
    SYNC_LOG.MAIN_PROVIDERS.map((provider) =>
      SyncLog.findOne({ clientId, provider })
        .sort({ createdAt: -1 })
        .select('source status createdAt')
        .lean()
    )
  );

  return Object.fromEntries(
    SYNC_LOG.MAIN_PROVIDERS.map((provider, i) => {
      const doc = results[i];
      return [
        provider,
        doc
          ? { lastSyncAt: doc.createdAt, source: doc.source, status: doc.status }
          : { lastSyncAt: null, source: null, status: null },
      ];
    })
  );
}

// ── Lettura: log recenti ──────────────────────────────────────────────────────

/**
 * Restituisce i log di sync più recenti per un client, dal più nuovo.
 * Pensato per uso interno debug/admin, non ancora esposto come endpoint.
 *
 * @param {string}  clientId
 * @param {object}  [options]
 * @param {number}  [options.limit]     Numero massimo di voci da restituire (limitato a 100)
 * @param {string}  [options.provider]  Filtro provider opzionale
 */
export async function getRecentSyncLogsByClient(
  clientId,
  { limit = SYNC_LOG.RECENT_LIMIT, provider = null } = {}
) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || SYNC_LOG.RECENT_LIMIT));
  const filter = { clientId };
  if (provider) filter.provider = normalizeProviderSlug(provider) ?? provider;

  return SyncLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .select('-__v')
    .lean();
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

/**
 * Elimina i log di sync più vecchi della soglia indicata.
 * Progettato per essere chiamato dal job di cleanup (jobs/cleanupLogs.job.js).
 * Nessuno scheduling avviene qui: il job controlla i tempi.
 *
 * Usa l'indice { createdAt: 1 } su SyncLog per cancellazioni efficienti per range.
 *
 * @param {object} [options]
 * @param {number} [options.olderThanDays]  Finestra di retention in giorni (default: 30)
 * @returns {{ deletedCount: number, cutoffDate: Date }}
 */
export async function cleanupOldSyncLogs({ olderThanDays = SYNC_LOG.RETENTION_DAYS } = {}) {
  const days = Math.max(1, Number(olderThanDays) || SYNC_LOG.RETENTION_DAYS);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { deletedCount } = await SyncLog.deleteMany({ createdAt: { $lt: cutoffDate } });

  return { deletedCount, cutoffDate };
}
