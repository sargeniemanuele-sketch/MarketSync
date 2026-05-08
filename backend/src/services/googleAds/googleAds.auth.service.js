import crypto from 'crypto';
import { env } from '../../config/env.js';
import { AppError, BadRequestError } from '../../utils/errors.js';

const GOOGLE_ADS_SCOPE = { scope: 'google_ads', provider: 'google_ads' };

const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_ADS_API_BASE_URL = 'https://googleads.googleapis.com';
const REQUIRED_GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
const STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_ADS_ACCOUNTS_TIMEOUT_MS = 15000;

function assertGoogleAdsOAuthConfigured() {
  if (!env.googleAds.clientId || !env.googleAds.clientSecret || !env.googleAds.redirectUri) {
    throw new AppError(
      'Google Ads non è ancora configurato. Contatta il supporto.',
      503,
      'GOOGLE_ADS_NOT_CONFIGURED',
      GOOGLE_ADS_SCOPE
    );
  }
}

function assertGoogleAdsApiConfigured() {
  assertGoogleAdsOAuthConfigured();

  if (!env.googleAds.developerToken) {
    throw new AppError(
      'Google Ads non è ancora configurato. Contatta il supporto.',
      503,
      'GOOGLE_ADS_NOT_CONFIGURED',
      GOOGLE_ADS_SCOPE
    );
  }
}

function generateState(clientId, userId) {
  const payload = {
    clientId,
    userId,
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: Date.now(),
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.googleAds.clientSecret)
    .update(encoded)
    .digest('hex');

  return `${encoded}.${signature}`;
}

function parseAndVerifyState(state) {
  const dot = state.lastIndexOf('.');

  if (dot === -1) {
    throw new BadRequestError('Collegamento Google Ads non valido. Riprova.', GOOGLE_ADS_SCOPE);
  }

  const encoded = state.slice(0, dot);
  const signature = state.slice(dot + 1);

  const expectedSignature = crypto
    .createHmac('sha256', env.googleAds.clientSecret)
    .update(encoded)
    .digest('hex');

  const givenBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (
    givenBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(givenBuffer, expectedBuffer)
  ) {
    throw new BadRequestError('Collegamento Google Ads non valido. Riprova.', GOOGLE_ADS_SCOPE);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestError('Collegamento Google Ads non valido. Riprova.', GOOGLE_ADS_SCOPE);
  }

  if (!payload.clientId || !payload.userId || typeof payload.iat !== 'number') {
    throw new BadRequestError('Collegamento Google Ads non valido. Riprova.', GOOGLE_ADS_SCOPE);
  }

  if (Date.now() - payload.iat > STATE_TTL_MS) {
    throw new BadRequestError('Il collegamento Google Ads è scaduto. Riprova.', GOOGLE_ADS_SCOPE);
  }

  return { clientId: payload.clientId, userId: payload.userId };
}

function buildTokenRequestBody(data) {
  return new URLSearchParams({
    client_id: env.googleAds.clientId,
    client_secret: env.googleAds.clientSecret,
    redirect_uri: env.googleAds.redirectUri,
    ...data,
  });
}

function toExpiresAt(expiresInSeconds) {
  const seconds = Number(expiresInSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000);
}

function getGoogleAdsOAuthScopes() {
  const configuredScopes = env.googleAds.scopes
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const scopes = new Set(configuredScopes);

  scopes.add(REQUIRED_GOOGLE_ADS_SCOPE);

  return Array.from(scopes).join(' ');
}

async function postGoogleOAuthToken(bodyParams) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GOOGLE_ADS_ACCOUNTS_TIMEOUT_MS);

  let response;

  try {
    response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: bodyParams.toString(),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError(
        'Google sta impiegando troppo tempo a rispondere. Riprova tra qualche minuto.',
        504,
        'GOOGLE_ADS_TIMEOUT',
        GOOGLE_ADS_SCOPE
      );
    }
    throw new AppError(
      'Impossibile completare il collegamento con Google. Riprova tra qualche minuto.',
      502,
      'GOOGLE_ADS_NETWORK_ERROR',
      GOOGLE_ADS_SCOPE
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new AppError(
      'Google ha restituito una risposta non valida. Riprova tra qualche minuto.',
      502,
      'GOOGLE_ADS_AUTH_ERROR',
      GOOGLE_ADS_SCOPE
    );
  }

  if (!response.ok) {
    const err = new AppError(
      'Non è stato possibile completare il collegamento con Google Ads. Riprova.',
      502,
      'GOOGLE_ADS_AUTH_ERROR',
      GOOGLE_ADS_SCOPE
    );
    err.providerHttpStatus = response.status;
    throw err;
  }

  if (!data.access_token) {
    throw new AppError(
      'Non è stato possibile completare il collegamento con Google Ads. Riprova.',
      502,
      'GOOGLE_ADS_AUTH_ERROR',
      GOOGLE_ADS_SCOPE
    );
  }

  return data;
}

function normalizeCustomerId(customerId) {
  if (!customerId || typeof customerId !== 'string') return null;
  const digits = customerId.replace(/\D/g, '');
  return digits || null;
}

function buildGoogleAdsApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${GOOGLE_ADS_API_BASE_URL}/${env.googleAds.apiVersion}${normalizedPath}`;
}

function buildGoogleAdsHeaders(accessToken, { includeJson = true, loginCustomerId = null } = {}) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': env.googleAds.developerToken,
    Accept: 'application/json',
  };

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  const normalizedLoginCustomerId = normalizeCustomerId(loginCustomerId);

  if (normalizedLoginCustomerId) {
    headers['login-customer-id'] = normalizedLoginCustomerId;
  }

  return headers;
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

  if (response.status === 401 || haystack.includes('invalid_grant') || haystack.includes('invalid token')) {
    return {
      code: 'GOOGLE_ADS_REAUTH_REQUIRED',
      message: 'L’autorizzazione Google Ads non è più valida. Ricollega l’account per continuare.',
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
    };
  }

  if (
    haystack.includes('no accessible customers') ||
    haystack.includes('does not have access to any google ads accounts')
  ) {
    return {
      code: 'GOOGLE_ADS_NO_ACCESSIBLE_CUSTOMERS',
      message:
        'Nessun account Google Ads trovato. Verifica che l’account Google usato abbia accesso a un account Google Ads.',
    };
  }

  return {
    code: 'GOOGLE_ADS_API_ERROR',
    message:
      'Errore durante il recupero dei dati da Google Ads. Riprova tra qualche minuto.',
  };
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

function extractCustomerId(resourceName) {
  return normalizeCustomerId(resourceName);
}

async function fetchAccessibleCustomerIds(accessToken) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GOOGLE_ADS_ACCOUNTS_TIMEOUT_MS);
  const method = 'GET';
  const url = buildGoogleAdsApiUrl('/customers:listAccessibleCustomers');

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: buildGoogleAdsHeaders(accessToken, { includeJson: false }),
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
  const debugMeta = buildGoogleAdsResponseDebug({ contentType, method, rawBody, response, url });

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
      502,
      classified.code,
      {
        ...GOOGLE_ADS_SCOPE,
        meta: debugMeta,
      }
    );
    err.providerHttpStatus = response.status;
    throw err;
  }

  if (!data || !Array.isArray(data.resourceNames)) {
    const err = new AppError(
      'Non è stato possibile leggere gli account Google Ads disponibili. Riprova tra qualche minuto.',
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

  const resourceNames = Array.isArray(data.resourceNames) ? data.resourceNames : [];

  return resourceNames
    .map(extractCustomerId)
    .filter((id, index, arr) => id && arr.indexOf(id) === index);
}

function buildSearchStreamUrl(customerId) {
  const normalizedCustomerId = normalizeCustomerId(customerId);
  return buildGoogleAdsApiUrl(`/customers/${normalizedCustomerId}/googleAds:searchStream`);
}

function normalizeGoogleAdsStatus(status) {
  return status === null || status === undefined ? null : String(status);
}

function toFrontendAccount({
  currencyCode = null,
  customerId,
  isManager = false,
  level = 0,
  name = null,
  parentManagerId = null,
  status = null,
  timeZone = null,
}) {
  const id = normalizeCustomerId(customerId);
  const normalizedParentManagerId = normalizeCustomerId(parentManagerId);
  const label = name || (id ? `Google Ads ${id}` : 'Google Ads');

  return {
    id,
    externalRef: id,
    name: label,
    label,
    status: normalizeGoogleAdsStatus(status),
    currencyCode: currencyCode ?? null,
    currency: currencyCode ?? null,
    timeZone: timeZone ?? null,
    timezone: timeZone ?? null,
    isManager: Boolean(isManager),
    parentManagerId: normalizedParentManagerId,
    managerCustomerId: normalizedParentManagerId,
    level: Number.isFinite(Number(level)) ? Number(level) : 0,
  };
}

async function parseGoogleAdsSearchStreamResponse(response, fallbackMessage, requestInfo = {}) {
  const { contentType, data, parseError, rawBody } = await readGoogleAdsResponse(response);
  const debugMeta = buildGoogleAdsResponseDebug({
    contentType,
    method: requestInfo.method,
    rawBody,
    response,
    url: requestInfo.url,
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
      classified.message || fallbackMessage,
      502,
      classified.code,
      {
        ...GOOGLE_ADS_SCOPE,
        meta: debugMeta,
      }
    );
    err.providerHttpStatus = response.status;
    throw err;
  }

  return Array.isArray(data) ? data : [];
}

async function fetchCustomerInfo(accessToken, customerId) {
  const normalizedCustomerId = normalizeCustomerId(customerId);

  if (!normalizedCustomerId) {
    return toFrontendAccount({ customerId });
  }

  const url = buildSearchStreamUrl(normalizedCustomerId);
  const method = 'POST';
  const query = [
    'SELECT',
    '  customer.id,',
    '  customer.descriptive_name,',
    '  customer.currency_code,',
    '  customer.time_zone,',
    '  customer.manager,',
    '  customer.status',
    'FROM customer',
    'LIMIT 1',
  ].join(' ');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GOOGLE_ADS_ACCOUNTS_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: buildGoogleAdsHeaders(accessToken),
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
  } catch {
    return toFrontendAccount({ customerId: normalizedCustomerId });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), GOOGLE_ADS_ACCOUNTS_TIMEOUT_MS);

    try {
      response = await fetch(url, {
        method,
        headers: buildGoogleAdsHeaders(accessToken, {
          loginCustomerId: normalizedCustomerId,
        }),
        body: JSON.stringify({ query }),
        signal: controller2.signal,
      });
    } catch {
      return toFrontendAccount({ customerId: normalizedCustomerId });
    } finally {
      clearTimeout(timeoutId2);
    }
  }

  let chunks;
  try {
    chunks = await parseGoogleAdsSearchStreamResponse(
      response,
      'Errore durante il recupero degli account Google Ads. Riprova tra qualche minuto.',
      { method, url }
    );
  } catch (err) {
    throw err;
  }

  const firstChunk = chunks.find((chunk) => Array.isArray(chunk.results) && chunk.results.length > 0);
  const customer = firstChunk?.results?.[0]?.customer;

  if (!customer) {
    return toFrontendAccount({ customerId: normalizedCustomerId });
  }

  const descriptiveName = customer.descriptiveName ?? null;

  return toFrontendAccount({
    currencyCode: customer.currencyCode ?? null,
    customerId: String(customer.id ?? normalizedCustomerId),
    isManager: Boolean(customer.manager),
    level: 0,
    name: descriptiveName,
    status: customer.status ?? null,
    timeZone: customer.timeZone ?? null,
  });
}

async function fetchManagerCustomerClients(accessToken, managerCustomerId) {
  const normalizedManagerCustomerId = normalizeCustomerId(managerCustomerId);

  if (!normalizedManagerCustomerId) return [];

  const query = [
    'SELECT',
    '  customer_client.client_customer,',
    '  customer_client.descriptive_name,',
    '  customer_client.currency_code,',
    '  customer_client.time_zone,',
    '  customer_client.manager,',
    '  customer_client.status,',
    '  customer_client.level',
    'FROM customer_client',
  ].join(' ');

  const method = 'POST';
  const url = buildSearchStreamUrl(normalizedManagerCustomerId);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GOOGLE_ADS_ACCOUNTS_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: buildGoogleAdsHeaders(accessToken, {
        loginCustomerId: normalizedManagerCustomerId,
      }),
      body: JSON.stringify({ query }),
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

  const batches = await parseGoogleAdsSearchStreamResponse(
    response,
    'Errore durante il recupero degli account Google Ads. Riprova tra qualche minuto.',
    { method, url }
  );
  const accounts = [];

  for (const batch of batches) {
    if (!Array.isArray(batch?.results)) continue;

    for (const row of batch.results) {
      const customerClient = row.customerClient;
      const childCustomerId = normalizeCustomerId(customerClient?.clientCustomer);

      if (!childCustomerId || childCustomerId === normalizedManagerCustomerId) {
        continue;
      }

      accounts.push(toFrontendAccount({
        currencyCode: customerClient.currencyCode ?? null,
        customerId: childCustomerId,
        isManager: Boolean(customerClient.manager),
        level: customerClient.level ?? 1,
        name: customerClient.descriptiveName ?? null,
        parentManagerId: normalizedManagerCustomerId,
        status: customerClient.status ?? null,
        timeZone: customerClient.timeZone ?? null,
      }));
    }
  }

  return accounts;
}

function dedupeAccounts(accounts) {
  const byKey = new Map();

  for (const account of accounts) {
    if (!account?.externalRef) continue;

    const key = `${account.externalRef}:${account.managerCustomerId ?? 'direct'}`;

    if (!byKey.has(key)) {
      byKey.set(key, account);
    }
  }

  return Array.from(byKey.values());
}

export function verifyGoogleAdsState(state) {
  assertGoogleAdsOAuthConfigured();
  return parseAndVerifyState(state);
}

export function buildGoogleAdsConnectUrl(clientId, userId) {
  assertGoogleAdsOAuthConfigured();

  const state = generateState(clientId, userId);
  const scopes = getGoogleAdsOAuthScopes();

  const params = new URLSearchParams({
    client_id: env.googleAds.clientId,
    redirect_uri: env.googleAds.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: scopes,
    state,
  });

  return {
    connectUrl: `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`,
  };
}

export async function processGoogleAdsCallback(query) {
  assertGoogleAdsOAuthConfigured();

  const { code, state } = query;

  const { clientId, userId } = parseAndVerifyState(state);

  const tokenData = await postGoogleOAuthToken(
    buildTokenRequestBody({
      grant_type: 'authorization_code',
      code,
    })
  );

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    tokenExpiresAt: toExpiresAt(tokenData.expires_in),
    clientId,
    userId,
  };
}

export async function refreshGoogleAdsAccessToken(refreshToken) {
  assertGoogleAdsOAuthConfigured();

  const tokenData = await postGoogleOAuthToken(
    buildTokenRequestBody({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
  );

  return {
    accessToken: tokenData.access_token,
    tokenExpiresAt: toExpiresAt(tokenData.expires_in),
  };
}

export async function fetchGoogleAdsAccounts(accessToken) {
  assertGoogleAdsApiConfigured();

  const customerIds = await fetchAccessibleCustomerIds(accessToken);

  if (customerIds.length === 0) {
    throw new AppError(
      'Nessun account Google Ads trovato. Verifica che l’account Google usato abbia accesso a un account Google Ads.',
      422,
      'GOOGLE_ADS_NO_ACCESSIBLE_CUSTOMERS',
      GOOGLE_ADS_SCOPE
    );
  }

  const accounts = [];

  for (const customerId of customerIds) {
    const account = await fetchCustomerInfo(accessToken, customerId);

    accounts.push(account);

    if (account.isManager) {
      const childAccounts = await fetchManagerCustomerClients(accessToken, account.id);
      accounts.push(...childAccounts);
    }
  }

  return dedupeAccounts(accounts);
}

/**
 * Revoca un token Google OAuth (access token o refresh token) best-effort.
 *
 * Il token viene inviato nel corpo della richiesta POST (non nella query string)
 * per evitare che compaia negli access log del server.
 *
 * Codici di ritorno:
 *   { success: true }                                  → revoca confermata da Google
 *   { success: false, code: 'GOOGLE_ADS_REVOKE_FAILED' }         → Google ha rifiutato (es. token già scaduto/revocato)
 *   { success: false, code: 'GOOGLE_ADS_REVOKE_TIMEOUT' }        → timeout 15s
 *   { success: false, code: 'GOOGLE_ADS_REVOKE_NETWORK_ERROR' }  → rete non raggiungibile
 *
 * Non lancia mai eccezioni verso il chiamante.
 * Non logga il token.
 *
 * @param {string} token  Access token o refresh token in chiaro
 * @returns {Promise<{ success: boolean, code?: string }>}
 */
export async function revokeGoogleAdsToken(token) {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { success: false, code: 'GOOGLE_ADS_REVOKE_FAILED' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GOOGLE_ADS_ACCOUNTS_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GOOGLE_OAUTH_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, code: 'GOOGLE_ADS_REVOKE_TIMEOUT' };
    }
    return { success: false, code: 'GOOGLE_ADS_REVOKE_NETWORK_ERROR' };
  } finally {
    clearTimeout(timeoutId);
  }

  // 200: revoca riuscita.
  // 400: token già invalido o revocato — trattato come non-bloccante (la disconnessione locale prosegue).
  if (!response.ok) {
    return { success: false, code: 'GOOGLE_ADS_REVOKE_FAILED' };
  }

  return { success: true };
}
