import Integration from '../../models/Integration.js';
import { env } from '../../config/env.js';
import { AppError, BadRequestError } from '../../utils/errors.js';
import { toAppDateString } from '../../utils/ranges.js';
import { decrypt, encrypt } from '../security/encryption.service.js';
import { refreshGoogleAdsAccessToken } from './googleAds.auth.service.js';
import { logSyncSuccess, logSyncError } from '../logging/syncLog.service.js';
import { GOOGLE_ADS_REQUIRED_GAQL_FIELDS } from '../../contracts/metrics/googleAds.kpi.map.js';

const GOOGLE_ADS_SCOPE = { scope: 'google_ads', provider: 'google_ads' };

const GOOGLE_ADS_API_BASE_URL = 'https://googleads.googleapis.com';
const GOOGLE_ADS_FETCH_TIMEOUT_MS = 15000;
const GOOGLE_ADS_MAX_ROWS = 100000;

function assertGoogleAdsFetchConfigured() {
  if (!env.googleAds.developerToken) {
    throw new AppError(
      'Google Ads non è ancora configurato. Contatta il supporto.',
      503,
      'GOOGLE_ADS_NOT_CONFIGURED',
      GOOGLE_ADS_SCOPE
    );
  }
}

function assertDateInput(startDate, endDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestError('Intervallo di date non valido.', GOOGLE_ADS_SCOPE);
  }

  if (start > end) {
    throw new BadRequestError('La data di inizio deve essere precedente o uguale alla data di fine.', GOOGLE_ADS_SCOPE);
  }

  return { startDate: start, endDate: end };
}

function toGoogleDate(date) {
  return toAppDateString(date);
}

function normalizeCustomerId(externalRef) {
  if (!externalRef || typeof externalRef !== 'string') return null;
  const digits = externalRef.replace(/\D/g, '');
  return digits || null;
}

function buildGoogleAdsApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${GOOGLE_ADS_API_BASE_URL}/${env.googleAds.apiVersion}${normalizedPath}`;
}

async function resolveGoogleAdsIntegration(clientId) {
  const integration = await Integration.findOne(
    { clientId, provider: 'google_ads' }
  )
    .select('status externalRef managerCustomerId credentials')
    .lean();

  if (!integration) {
    throw new AppError(
      'Google Ads non è collegato a questo cliente.',
      404,
      'INTEGRATION_NOT_FOUND',
      GOOGLE_ADS_SCOPE
    );
  }

  if (integration.status !== 'connected') {
    throw new AppError(
      integration.status === 'needs_account_selection' || integration.status === 'incomplete'
        ? "Scegli l'account Google Ads da usare per questo cliente."
        : 'Google Ads richiede la riconnessione.',
      422,
      integration.status === 'needs_account_selection' || integration.status === 'incomplete'
        ? 'INTEGRATION_INCOMPLETE'
        : 'INTEGRATION_NOT_ACTIVE',
      GOOGLE_ADS_SCOPE
    );
  }

  const accessToken = decrypt(integration.credentials?.accessToken);
  const refreshToken = decrypt(integration.credentials?.refreshToken);
  const customerId = normalizeCustomerId(decrypt(integration.externalRef));
  const managerCustomerId = normalizeCustomerId(decrypt(integration.managerCustomerId));

  if (!accessToken || !customerId) {
    throw new AppError(
      'La configurazione Google Ads è incompleta. Ricollega l’account.',
      422,
      'INTEGRATION_INCOMPLETE',
      GOOGLE_ADS_SCOPE
    );
  }

  const tokenExpiresAt = integration.credentials?.tokenExpiresAt
    ? new Date(integration.credentials.tokenExpiresAt)
    : null;

  return {
    accessToken,
    refreshToken,
    customerId,
    managerCustomerId,
    tokenExpiresAt,
  };
}

function buildGoogleAdsHeaders(accessToken, { loginCustomerId = null } = {}) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': env.googleAds.developerToken,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const normalizedLoginCustomerId = normalizeCustomerId(loginCustomerId);

  if (normalizedLoginCustomerId) {
    headers['login-customer-id'] = normalizedLoginCustomerId;
  }

  return headers;
}

async function readGoogleAdsResponse(response) {
  const contentType = response.headers.get('content-type') ?? '';
  const rawBody = await response.text();
  let data = null;
  let parseError = null;

  if (rawBody.trim()) {
    try {
      data = JSON.parse(rawBody);
    } catch (err) {
      parseError = err;
    }
  }

  return {
    contentType,
    data,
    parseError,
    rawBody,
  };
}

function buildGoogleAdsResponseDebug({ contentType, method, rawBody, response, url }) {
  return {
    debug: {
      url: url ?? null,
      method: method ?? null,
      httpStatus: response.status,
      contentType: contentType || null,
      rawBodyPreview: rawBody ? rawBody.slice(0, 500) : '',
      requestId: response.headers.get('request-id') ?? response.headers.get('x-request-id') ?? null,
    },
  };
}

function classifyGoogleAdsApiError({ data, rawBody, response }) {
  const serialized = JSON.stringify(data ?? {});
  const haystack = `${serialized} ${rawBody ?? ''}`.toLowerCase();

  if (
    response.status === 429 ||
    haystack.includes('resource_temporarily_exhausted') ||
    haystack.includes('quota_exceeded') ||
    haystack.includes('rateerror') ||
    haystack.includes('rate exceeded') ||
    haystack.includes('too many requests')
  ) {
    return {
      code: 'GOOGLE_ADS_RATE_LIMITED',
      message: 'Google Ads ha ricevuto troppe richieste. Riprova tra qualche minuto.',
      statusCode: 429,
    };
  }

  if (response.status === 401 || haystack.includes('invalid_grant') || haystack.includes('invalid token')) {
    return {
      code: 'GOOGLE_ADS_REAUTH_REQUIRED',
      message: 'L’autorizzazione Google Ads non è più valida. Ricollega l’account per continuare.',
      statusCode: 422,
    };
  }

  if (
    haystack.includes('access_token_scope_insufficient') ||
    haystack.includes('insufficient authentication scopes') ||
    haystack.includes('insufficient oauth scope') ||
    haystack.includes('missing required authentication scope')
  ) {
    return {
      code: 'GOOGLE_ADS_AUTH_SCOPE_MISSING',
      message:
        'L’autorizzazione Google Ads non include le autorizzazioni necessarie. Ricollega l’account e accetta tutte le autorizzazioni richieste.',
      statusCode: 422,
    };
  }

  if (
    haystack.includes('developer token') ||
    haystack.includes('developer-token') ||
    haystack.includes('developertoken') ||
    haystack.includes('developer_token')
  ) {
    return {
      code: 'GOOGLE_ADS_DEVELOPER_TOKEN_INVALID',
      message:
        'Google Ads è accessibile, ma MarketSync non è configurato correttamente per questo account. Contatta il supporto.',
      statusCode: 503,
    };
  }

  if (
    haystack.includes('service_disabled') ||
    haystack.includes('api has not been used') ||
    haystack.includes('api has not been enabled') ||
    haystack.includes('google ads api has not been used') ||
    haystack.includes('google ads api has not been enabled')
  ) {
    return {
      code: 'GOOGLE_ADS_API_NOT_ENABLED',
      message:
        'Non è stato possibile accedere a Google Ads. Contatta il supporto.',
      statusCode: 503,
    };
  }

  if (
    haystack.includes('test account') ||
    haystack.includes('test accounts') ||
    haystack.includes('access level') ||
    haystack.includes('not enabled for production')
  ) {
    return {
      code: 'GOOGLE_ADS_ACCESS_LEVEL_RESTRICTED',
      message:
        'Google Ads non è ancora disponibile per questo account. Contatta il supporto per completare la configurazione.',
      statusCode: 403,
    };
  }

  if (
    haystack.includes('permission_denied') ||
    haystack.includes('user_permission_denied') ||
    haystack.includes('does not have permission') ||
    response.status === 403
  ) {
    return {
      code: 'GOOGLE_ADS_PERMISSION_DENIED',
      message:
        'Non è stato possibile accedere all’account Google Ads. Verifica i permessi dell’account Google e riprova.',
      statusCode: 403,
    };
  }

  return {
    code: 'GOOGLE_ADS_API_ERROR',
    message: 'Errore durante il recupero dei dati da Google Ads. Riprova tra qualche minuto.',
    statusCode: 502,
  };
}

function buildGaqlQuery({ startDate, endDate }) {
  const from = toGoogleDate(startDate);
  const to = toGoogleDate(endDate);

  return [
    'SELECT',
    GOOGLE_ADS_REQUIRED_GAQL_FIELDS.map((field) => `  ${field}`).join(', '),
    'FROM customer',
    `WHERE segments.date BETWEEN '${from}' AND '${to}'`,
    'ORDER BY segments.date',
  ].join(' ');
}

function buildSearchStreamUrl(customerId) {
  const normalizedCustomerId = normalizeCustomerId(customerId);
  return buildGoogleAdsApiUrl(`/customers/${normalizedCustomerId}/googleAds:searchStream`);
}

async function runSearchStreamRequest({ customerId, accessToken, gaql, managerCustomerId = null }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GOOGLE_ADS_FETCH_TIMEOUT_MS);
  const method = 'POST';
  const url = buildSearchStreamUrl(customerId);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: buildGoogleAdsHeaders(accessToken, {
        loginCustomerId: managerCustomerId,
      }),
      body: JSON.stringify({ query: gaql }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError(
        'Google Ads sta impiegando troppo tempo a rispondere. Riprova tra qualche minuto.',
        504,
        'GOOGLE_ADS_TIMEOUT',
        GOOGLE_ADS_SCOPE
      );
    }

    throw new AppError(
      'Impossibile comunicare con Google Ads. Riprova tra qualche minuto.',
      502,
      'GOOGLE_ADS_NETWORK_ERROR',
      GOOGLE_ADS_SCOPE
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const { contentType, data, parseError, rawBody } = await readGoogleAdsResponse(response);
  const debugMeta = buildGoogleAdsResponseDebug({
    contentType,
    method,
    rawBody,
    response,
    url,
  });

  if (parseError) {
    const err = new AppError(
      'Google ha restituito una risposta non valida. Riprova tra qualche minuto.',
      502,
      'GOOGLE_ADS_API_ERROR',
      {
        ...GOOGLE_ADS_SCOPE,
        meta: debugMeta,
      }
    );
    err.providerHttpStatus = response.status;
    throw err;
  }

  if (!response.ok) {
    const classified = classifyGoogleAdsApiError({ data, rawBody, response });
    const err = new AppError(
      classified.message,
      classified.statusCode,
      classified.code,
      {
        ...GOOGLE_ADS_SCOPE,
        meta: debugMeta,
      }
    );
    err.providerHttpStatus = response.status;
    throw err;
  }

  const batches = Array.isArray(data) ? data : [];
  const rows = [];
  let truncated = false;

  for (const batch of batches) {
    if (!Array.isArray(batch?.results)) continue;

    for (const row of batch.results) {
      rows.push(row);
      if (rows.length >= GOOGLE_ADS_MAX_ROWS) {
        truncated = true;
        break;
      }
    }

    if (truncated) break;
  }

  return {
    rows,
    truncated,
    httpStatus: response.status,
  };
}

async function persistRefreshedAccessToken(clientId, accessToken, tokenExpiresAt) {
  await Integration.findOneAndUpdate(
    { clientId, provider: 'google_ads' },
    {
      $set: {
        'credentials.accessToken': encrypt(accessToken),
        'credentials.tokenExpiresAt': tokenExpiresAt ?? null,
        status: 'connected',
        lastError: null,
      },
    }
  );
}

// Marks the integration as needing reauth after a refresh token failure.
// Fire-and-forget: callers do not await, so a DB hiccup never masks the real error.
async function markIntegrationNeedsReauth(clientId) {
  await Integration.findOneAndUpdate(
    { clientId, provider: 'google_ads' },
    {
      $set: {
        status: 'needs_reauth',
        lastError: {
          code: 'GOOGLE_ADS_REAUTH_REQUIRED',
          message: 'L’autorizzazione Google Ads non è più valida. Ricollega l’account per continuare.',
          provider: 'google_ads',
          scope: 'google_ads',
          at: new Date(),
        },
      },
    }
  );
}

async function refreshAccessTokenOrFail(clientId, refreshToken) {
  if (!refreshToken) {
    markIntegrationNeedsReauth(clientId).catch(() => {});
    throw new AppError(
      'L’autorizzazione Google Ads è scaduta. Ricollega l’account per continuare.',
      422,
      'INTEGRATION_EXPIRED',
      GOOGLE_ADS_SCOPE
    );
  }

  try {
    const refreshed = await refreshGoogleAdsAccessToken(refreshToken);
    await persistRefreshedAccessToken(clientId, refreshed.accessToken, refreshed.tokenExpiresAt);
    return refreshed.accessToken;
  } catch (err) {
    // GOOGLE_ADS_AUTH_ERROR means the OAuth exchange itself was rejected (e.g. invalid_grant).
    // Mark the integration as needing reconnect so the next fetch fails fast with a clear status.
    if (err.code === 'GOOGLE_ADS_AUTH_ERROR') {
      markIntegrationNeedsReauth(clientId).catch(() => {});
    }
    throw err;
  }
}

export async function fetchRawGoogleAdsData({ clientId, range, startDate, endDate }) {
  assertGoogleAdsFetchConfigured();

  if (!clientId) {
    throw new BadRequestError('Seleziona un cliente prima di caricare i dati.', GOOGLE_ADS_SCOPE);
  }

  const normalizedDates = assertDateInput(startDate, endDate);
  const resolved = await resolveGoogleAdsIntegration(clientId);

  let accessToken = resolved.accessToken;
  const refreshToken = resolved.refreshToken;
  const customerId = resolved.customerId;
  const managerCustomerId = resolved.managerCustomerId;

  const startedAt = Date.now();

  try {
    if (
      resolved.tokenExpiresAt &&
      !Number.isNaN(resolved.tokenExpiresAt.getTime()) &&
      resolved.tokenExpiresAt <= new Date()
    ) {
      accessToken = await refreshAccessTokenOrFail(clientId, refreshToken);
    }

    const gaql = buildGaqlQuery(normalizedDates);

    let result;

    try {
      result = await runSearchStreamRequest({ customerId, accessToken, gaql, managerCustomerId });
    } catch (err) {
      if (err.providerHttpStatus === 401 && refreshToken) {
        accessToken = await refreshAccessTokenOrFail(clientId, refreshToken);
        result = await runSearchStreamRequest({ customerId, accessToken, gaql, managerCustomerId });
      } else {
        throw err;
      }
    }

    const durationMs = Date.now() - startedAt;

    Integration.findOneAndUpdate(
      { clientId, provider: 'google_ads' },
      { $set: { lastSyncAt: new Date() } }
    ).catch(() => {});

    logSyncSuccess({
      clientId,
      provider: 'google_ads',
      endpoint: 'googleAds:searchStream',
      rangeRequested: range ?? null,
      startDate: normalizedDates.startDate,
      endDate: normalizedDates.endDate,
      source: 'live',
      durationMs,
      httpStatus: result.httpStatus,
    }).catch(() => {});

    return {
      // Righe Google Ads grezze come restituite dai risultati searchStream (non appiattite).
      rows: result.rows,
      meta: {
        fetchedAt: new Date(),
        range: range ?? null,
        startDate: normalizedDates.startDate,
        endDate: normalizedDates.endDate,
        customerId,
        managerCustomerId,
        rowCount: result.rows.length,
        truncated: result.truncated,
        provider: 'google_ads',
        source: 'live',
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    logSyncError({
      clientId,
      provider: 'google_ads',
      endpoint: 'googleAds:searchStream',
      rangeRequested: range ?? null,
      startDate: normalizedDates.startDate,
      endDate: normalizedDates.endDate,
      source: 'live',
      durationMs,
      httpStatus: error.providerHttpStatus ?? null,
      error,
    }).catch(() => {});

    throw error;
  }
}
