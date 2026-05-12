export const API_PREFIX = '/api/v1';

export const TIMEZONE_DEFAULT = 'Europe/Rome';
export const CURRENCY_DEFAULT = 'EUR';
export const LOCALE_DEFAULT = 'it-IT';

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

export const METRIC_CACHE = Object.freeze({
  DEFAULT_TTL_MS:       7 * 60 * 1000,
  DASHBOARD_TTL_MS:     5 * 60 * 1000,
  OVERVIEW_TTL_MS:      5 * 60 * 1000,
  SHOPIFY_TTL_MS:       7 * 60 * 1000,
  META_ADS_TTL_MS:      3 * 60 * 1000,
  GOOGLE_ADS_TTL_MS:   10 * 60 * 1000,
  CUSTOM_METRIC_TTL_MS: 7 * 60 * 1000,
  STALE_MAX_AGE_MS:    24 * 60 * 60 * 1000,
});

export const SYNC_LOG = Object.freeze({
  RETENTION_DAYS: 30,           // soglia predefinita per cleanupOldSyncLogs
  RECENT_LIMIT: 20,             // valore predefinito per getRecentSyncLogsByClient
  MAIN_PROVIDERS: Object.freeze(['shopify', 'meta_ads', 'google_ads']),
});

export const UPLOAD = Object.freeze({
  MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024, // 2 MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
});

export const SHOPIFY = Object.freeze({
  API_VERSION:         process.env.SHOPIFY_API_VERSION || '2026-01',
  ORDERS_PER_PAGE:     250,
  MAX_PAGES:           10,     // limite di sicurezza: massimo 2.500 ordini per fetch su intervallo date
  FETCH_TIMEOUT_MS:    15000,  // 15 secondi per singola richiesta GraphQL Shopify
  MAX_RETRIES:         2,      // tentativi aggiuntivi per errori 429 / 5xx (totale: 3 tentativi)
  RETRY_BASE_DELAY_MS: 1000,   // backoff esponenziale base: 1s, 2s per i due retry su 5xx
});

export const META_ADS = Object.freeze({
  API_VERSION:        'v21.0',
  FETCH_TIMEOUT_MS:   15000, // 15 secondi per singola richiesta Meta Graph
  INSIGHTS_PAGE_LIMIT: 500,
  MAX_INSIGHTS_PAGES: 10,    // limite di sicurezza: massimo 5.000 righe insight per fetch
});

export const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
});
