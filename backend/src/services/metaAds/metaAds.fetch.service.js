import crypto from 'crypto';
import Integration from '../../models/Integration.js';
import { META_ADS } from '../../config/app.constants.js';
import { env } from '../../config/env.js';
import { AppError, BadRequestError } from '../../utils/errors.js';
import { toAppDateString } from '../../utils/ranges.js';
import { decrypt } from '../security/encryption.service.js';
import { logSyncSuccess, logSyncError } from '../logging/syncLog.service.js';

const META_SCOPE = { scope: 'meta_ads', provider: 'meta_ads' };

// Gli insight a livello account sono sufficienti per il primo layer grezzo perché i service
// KPI possono aggregare da questa fonte senza richiedere granularità ad/adset/campaign.
const INSIGHTS_FIELDS = Object.freeze([
  'account_id',
  'account_name',
  'date_start',
  'date_stop',
  'spend',
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'actions',
  'action_values',
  'purchase_roas',
  'outbound_clicks',
  'cost_per_outbound_click',
  'cost_per_action_type',
]);

function assertMetaConfiguredForFetch() {
  if (!env.meta.appSecret) {
    throw new AppError(
      'Meta Ads non è ancora configurato. Contatta il supporto.',
      503,
      'META_NOT_CONFIGURED',
      META_SCOPE
    );
  }
}

function assertDateInput(startDate, endDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end   = endDate instanceof Date ? endDate : new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestError('Intervallo di date non valido.', META_SCOPE);
  }

  if (start > end) {
    throw new BadRequestError('La data di inizio deve essere precedente o uguale alla data di fine.', META_SCOPE);
  }

  return { startDate: start, endDate: end };
}

function computeAppSecretProof(accessToken) {
  return crypto
    .createHmac('sha256', env.meta.appSecret)
    .update(accessToken)
    .digest('hex');
}

function normalizeMetaAccountRef(externalRef) {
  if (!externalRef || typeof externalRef !== 'string') return null;

  if (externalRef.startsWith('act_')) {
    return externalRef;
  }

  if (/^\d+$/.test(externalRef)) {
    return `act_${externalRef}`;
  }

  return null;
}

async function resolveMetaAdsIntegration(clientId) {
  const integration = await Integration.findOne(
    { clientId, provider: 'meta_ads' }
  )
    .select('status externalRef credentials')
    .lean();

  if (!integration) {
    throw new AppError(
      'Meta Ads non è collegato a questo cliente.',
      404,
      'INTEGRATION_NOT_FOUND',
      META_SCOPE
    );
  }

  if (integration.status !== 'connected') {
    throw new AppError(
      integration.status === 'needs_account_selection' || integration.status === 'incomplete'
        ? 'Seleziona un account Meta Ads per completare il collegamento.'
        : 'Meta Ads richiede la riconnessione.',
      422,
      integration.status === 'needs_account_selection' || integration.status === 'incomplete'
        ? 'INTEGRATION_INCOMPLETE'
        : 'INTEGRATION_NOT_ACTIVE',
      META_SCOPE
    );
  }

  const accessToken = decrypt(integration.credentials?.accessToken);
  const externalRef = decrypt(integration.externalRef);
  const accountRef  = normalizeMetaAccountRef(externalRef);

  if (!accessToken || !accountRef) {
    throw new AppError(
      'La configurazione Meta Ads è incompleta. Ricollega l’account.',
      422,
      'INTEGRATION_INCOMPLETE',
      META_SCOPE
    );
  }

  const tokenExpiresAt = integration.credentials?.tokenExpiresAt
    ? new Date(integration.credentials.tokenExpiresAt)
    : null;

  if (tokenExpiresAt && !Number.isNaN(tokenExpiresAt.getTime()) && tokenExpiresAt <= new Date()) {
    throw new AppError(
      'L’autorizzazione Meta Ads è scaduta. Ricollega l’account per continuare.',
      422,
      'INTEGRATION_EXPIRED',
      META_SCOPE
    );
  }

  return { accessToken, accountRef };
}

function buildInsightsQuery({ startDate, endDate, accessToken, after = null }) {
  const params = new URLSearchParams({
    fields:          INSIGHTS_FIELDS.join(','),
    level:           'account',
    limit:           String(META_ADS.INSIGHTS_PAGE_LIMIT),
    time_increment:  '1',
    time_range:      JSON.stringify({
      since: toAppDateString(startDate),
      until: toAppDateString(endDate),
    }),
    appsecret_proof: computeAppSecretProof(accessToken),
  });

  if (after) params.set('after', after);

  return params;
}

function buildInsightsUrl(accountRef, queryParams) {
  return `https://graph.facebook.com/${META_ADS.API_VERSION}/${accountRef}/insights?${queryParams.toString()}`;
}

async function fetchMetaGraph(url, accessToken) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), META_ADS.FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError(
        'Meta Ads sta impiegando troppo tempo a rispondere. Riprova tra qualche minuto.',
        504,
        'META_TIMEOUT',
        META_SCOPE
      );
    }

    throw new AppError(
      'Impossibile comunicare con Meta Ads. Riprova tra qualche minuto.',
      502,
      'META_NETWORK_ERROR',
      META_SCOPE
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const message = retryAfter
      ? `Meta Ads rate limit raggiunto — riprova tra ${retryAfter} secondi`
      : 'Meta Ads rate limit raggiunto — riprova tra qualche minuto';
    const err = new AppError(message, 429, 'META_RATE_LIMITED', META_SCOPE);
    err.providerHttpStatus = 429;
    throw err;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new AppError(
      'Meta Ads ha restituito una risposta non valida. Riprova tra qualche minuto.',
      502,
      'META_API_ERROR',
      META_SCOPE
    );
  }

  if (!response.ok) {
    const isAuthFailure     = response.status === 401;
    const isPermissionError = response.status === 403;

    let message;
    let statusCode;
    let code;

    if (isAuthFailure) {
      message    = 'L’autorizzazione Meta Ads è scaduta. Ricollega l’account per continuare.';
      statusCode = 422;
      code       = 'META_REAUTH_REQUIRED';
    } else if (isPermissionError) {
      message    = 'Permessi Meta Ads insufficienti per leggere questo account pubblicitario.';
      statusCode = 403;
      code       = 'META_PERMISSION_DENIED';
    } else {
      message    = 'Errore durante il recupero dei dati da Meta Ads. Riprova tra qualche minuto.';
      statusCode = 502;
      code       = 'META_API_ERROR';
    }

    const err = new AppError(message, statusCode, code, META_SCOPE);
    err.providerHttpStatus = response.status;
    throw err;
  }

  return { data, httpStatus: response.status };
}

async function fetchAccountInsights({ accountRef, accessToken, startDate, endDate }) {
  const insights = [];

  let pagesFetched = 0;
  let lastHttpStatus = null;
  let after = null;

  while (pagesFetched < META_ADS.MAX_INSIGHTS_PAGES) {
    const query = buildInsightsQuery({ startDate, endDate, accessToken, after });
    const url = buildInsightsUrl(accountRef, query);

    const { data, httpStatus } = await fetchMetaGraph(url, accessToken);
    lastHttpStatus = httpStatus;

    const rows = Array.isArray(data.data) ? data.data : [];
    insights.push(...rows);

    pagesFetched += 1;
    after = data?.paging?.cursors?.after ?? null;

    if (!after) {
      break;
    }
  }

  return {
    insights,
    pagesFetched,
    truncated: Boolean(after),
    httpStatus: lastHttpStatus,
  };
}

export async function fetchRawMetaAdsData({ clientId, range, startDate, endDate }) {
  assertMetaConfiguredForFetch();

  if (!clientId) {
    throw new BadRequestError('Seleziona un cliente prima di caricare i dati Meta Ads.', META_SCOPE);
  }

  const normalizedDates = assertDateInput(startDate, endDate);
  const { accessToken, accountRef } = await resolveMetaAdsIntegration(clientId);

  const startedAt = Date.now();

  try {
    const {
      insights,
      pagesFetched,
      truncated,
      httpStatus,
    } = await fetchAccountInsights({
      accountRef,
      accessToken,
      ...normalizedDates,
    });

    const durationMs = Date.now() - startedAt;

    Integration.findOneAndUpdate(
      { clientId, provider: 'meta_ads' },
      { $set: { lastSyncAt: new Date() } }
    ).catch(() => {});

    logSyncSuccess({
      clientId,
      provider: 'meta_ads',
      endpoint: 'insights',
      rangeRequested: range ?? null,
      startDate: normalizedDates.startDate,
      endDate: normalizedDates.endDate,
      source: 'live',
      durationMs,
      httpStatus,
    }).catch(() => {});

    return {
      insights,
      meta: {
        fetchedAt: new Date(),
        range: range ?? null,
        startDate: normalizedDates.startDate,
        endDate: normalizedDates.endDate,
        pagesFetched,
        truncated,
        provider: 'meta_ads',
        source: 'live',
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    logSyncError({
      clientId,
      provider: 'meta_ads',
      endpoint: 'insights',
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
