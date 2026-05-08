import crypto from 'crypto';
import { env } from '../../config/env.js';
import { AppError, BadRequestError } from '../../utils/errors.js';

const META_GRAPH_VERSION = 'v21.0';
const STATE_TTL_MS       = 10 * 60 * 1000;

// ── State ─────────────────────────────────────────────────────────────────────
//
// Strategia identica a Shopify: payload senza stato firmato con HMAC-SHA256.
// Formato: base64url(JSON({ clientId, userId, nonce, iat })) + '.' + hmac_hex
// Chiave: META_APP_SECRET: usata qui solo per firmare lo state, non per chiamate Meta API.
// nonce aggiunge entropia per tentativo di connessione ma NON impone l'uso singolo senza
// archiviazione lato server del nonce: uno state valido può essere riutilizzato entro la finestra TTL.

function generateState(clientId, userId) {
  const payload = {
    clientId,
    userId,
    nonce: crypto.randomBytes(16).toString('hex'),
    iat:   Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig     = crypto
    .createHmac('sha256', env.meta.appSecret)
    .update(encoded)
    .digest('hex');
  return `${encoded}.${sig}`;
}

function parseAndVerifyState(state) {
  const dot = state.lastIndexOf('.');
  if (dot === -1) {
    throw new BadRequestError('Collegamento Meta Ads non valido. Riprova.', { scope: 'meta_ads', provider: 'meta_ads' });
  }

  const encoded = state.slice(0, dot);
  const sig     = state.slice(dot + 1);

  const expectedSig = crypto
    .createHmac('sha256', env.meta.appSecret)
    .update(encoded)
    .digest('hex');

  const sigBuf      = Buffer.from(sig,         'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new BadRequestError('Collegamento Meta Ads non valido. Riprova.', { scope: 'meta_ads', provider: 'meta_ads' });
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestError('Collegamento Meta Ads non valido. Riprova.', { scope: 'meta_ads', provider: 'meta_ads' });
  }

  if (!payload.clientId || !payload.userId || typeof payload.iat !== 'number') {
    throw new BadRequestError('Collegamento Meta Ads non valido. Riprova.', { scope: 'meta_ads', provider: 'meta_ads' });
  }

  if (Date.now() - payload.iat > STATE_TTL_MS) {
    throw new BadRequestError('Collegamento Meta Ads scaduto. Riprova dalla sezione Integrazioni.', { scope: 'meta_ads', provider: 'meta_ads' });
  }

  return { clientId: payload.clientId, userId: payload.userId };
}

// ── Controlli ─────────────────────────────────────────────────────────────────

function assertConfigured() {
  if (!env.meta.appId || !env.meta.appSecret || !env.meta.redirectUri) {
    throw new AppError(
      'Meta Ads non è ancora configurato. Contatta il supporto.',
      503,
      'META_NOT_CONFIGURED',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
  }
}

// ── Scambio token ─────────────────────────────────────────────────────────────
//
// Le richieste al token endpoint usano POST form-encoded per evitare che client_secret,
// code o token finiscano nella query string di log, proxy o error traces.

async function exchangeCodeForShortLivedToken(code) {
  const params = new URLSearchParams({
    client_id:     env.meta.appId,
    redirect_uri:  env.meta.redirectUri,
    client_secret: env.meta.appSecret,
    code,
  });

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } catch {
    throw new AppError(
      'Impossibile comunicare con Meta Ads. Riprova tra qualche minuto.',
      502,
      'META_NETWORK_ERROR',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
  }

  if (!response.ok) {
    const err = new AppError(
      'Non è stato possibile completare il collegamento con Meta Ads. Riprova.',
      502,
      'META_AUTH_ERROR',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
    err.providerHttpStatus = response.status;
    throw err;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new AppError(
      'Meta Ads ha restituito una risposta non valida. Riprova tra qualche minuto.',
      502,
      'META_AUTH_ERROR',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
  }

  if (!data.access_token) {
    throw new AppError(
      'Non è stato possibile completare il collegamento con Meta Ads. Riprova.',
      502,
      'META_AUTH_ERROR',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
  }

  return data.access_token;
}

/**
 * Aggiorna un token utente a breve durata in un token a lunga durata (~60 giorni).
 *
 * Se l'upgrade fallisce per qualsiasi motivo (errore rete, errore Meta API, risposta
 * malformata), la funzione restituisce in modo tollerante il token a breve durata originale
 * così l'integrazione resta funzionante fino alla prossima riconnessione invece di fallire
 * l'intero flusso OAuth.
 *
 * @param {string} shortLivedToken
 * @returns {{ accessToken: string, tokenExpiresAt: Date|null }}
 */
async function exchangeForLongLivedToken(shortLivedToken) {
  const params = new URLSearchParams({
    grant_type:        'fb_exchange_token',
    client_id:         env.meta.appId,
    client_secret:     env.meta.appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } catch {
    return { accessToken: shortLivedToken, tokenExpiresAt: null };
  }

  if (!response.ok) {
    return { accessToken: shortLivedToken, tokenExpiresAt: null };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { accessToken: shortLivedToken, tokenExpiresAt: null };
  }

  const accessToken    = data.access_token ?? shortLivedToken;
  const tokenExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  return { accessToken, tokenExpiresAt };
}

// ── appsecret_proof ───────────────────────────────────────────────────────────
//
// Meta richiede appsecret_proof sulle chiamate API lato server quando l'impostazione è
// abilitata nella dashboard app. Calcolato come HMAC-SHA256(key=app_secret, data=access_token).
// Mai loggato: derivato dal token in chiaro.

function computeAppSecretProof(accessToken) {
  return crypto
    .createHmac('sha256', env.meta.appSecret)
    .update(accessToken)
    .digest('hex');
}

// ── API pubblica ──────────────────────────────────────────────────────────────

/**
 * Verifica lo state firmato con HMAC senza eseguire alcuno scambio token.
 * Usato nel ramo callback di diniego/errore per confermare che la richiesta corrisponda
 * a un intento di connessione legittimo prima del redirect.
 *
 * Lancia BadRequestError se lo state manca, è manomesso o è scaduto.
 *
 * @param {string} state
 * @returns {{ clientId: string, userId: string }}
 */
export function verifyMetaState(state) {
  return parseAndVerifyState(state);
}

/**
 * Costruisce l'URL di autorizzazione OAuth Meta.
 *
 * clientId e userId sono incorporati nello state firmato con HMAC così possono
 * essere recuperati alla callback senza una sessione lato server.
 *
 * @param {string} clientId  Dashboard client ID
 * @param {string} userId    ID utente autenticato: incorporato nello state firmato
 * @returns {{ connectUrl: string }}
 */
export function buildMetaConnectUrl(clientId, userId) {
  assertConfigured();

  const state  = generateState(clientId, userId);
  const params = new URLSearchParams({
    client_id:     env.meta.appId,
    redirect_uri:  env.meta.redirectUri,
    state,
    scope:         env.meta.scopes,
    response_type: 'code',
  });

  return {
    connectUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`,
  };
}

/**
 * Processa la callback OAuth Meta.
 *
 * 1. Verifica lo state firmato con HMAC: conferma che la richiesta corrisponda
 *    all'intento di connessione originale e recupera clientId + userId senza sessione.
 * 2. Scambia l'authorization code con un token utente a breve durata.
 * 3. Aggiorna a un token a lunga durata (~60 giorni). In caso di fallimento
 *    dell'upgrade, usa come fallback quello a breve durata.
 *
 * Non logga né restituisce mai token nei messaggi di errore.
 *
 * @param {object} query  Query params callback validati (almeno code + state)
 * @returns {{ accessToken: string, tokenExpiresAt: Date|null, clientId: string, userId: string }}
 */
export async function processMetaCallback(query) {
  assertConfigured();

  const { code, state } = query;

  const { clientId, userId }            = parseAndVerifyState(state);
  const shortLivedToken                 = await exchangeCodeForShortLivedToken(code);
  const { accessToken, tokenExpiresAt } = await exchangeForLongLivedToken(shortLivedToken);

  return { accessToken, tokenExpiresAt, clientId, userId };
}

/**
 * Recupera gli account pubblicitari accessibili con l'access token utente Meta indicato.
 *
 * Limitato a 50 account: sufficiente per i casi d'uso tipici.
 * La paginazione a cursore non è implementata; viene restituita la prima pagina di risultati.
 * Il token è passato tramite header Authorization, non in query string.
 *
 * @param {string} accessToken  Access token utente Meta in chiaro
 * @returns {object[]}  Array di oggetti account mappati
 */
const FIELDS_WITH_BUSINESS = 'id,name,currency,timezone_name,account_status,business{name,id}';
const FIELDS_BASE          = 'id,name,currency,timezone_name,account_status';

/**
 * Esegue una singola chiamata GET /me/adaccounts con i fields indicati.
 * Restituisce { ok: true, data } in caso di successo,
 * oppure { ok: false, httpStatus, metaError? } se Meta risponde con un errore
 * (sia HTTP non-ok sia body con data.error).
 * Lancia AppError solo per errori di rete (nessuna risposta ricevuta).
 */
async function tryFetchAdAccountsRaw(accessToken, fields) {
  const params = new URLSearchParams({
    fields,
    limit:           '50',
    appsecret_proof: computeAppSecretProof(accessToken),
  });

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/adaccounts?${params.toString()}`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept:        'application/json',
      },
    });
  } catch {
    throw new AppError(
      'Impossibile comunicare con Meta Ads. Riprova tra qualche minuto.',
      502,
      'META_NETWORK_ERROR',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
  }

  if (!response.ok) {
    return { ok: false, httpStatus: response.status };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new AppError(
      'Meta Ads ha restituito una risposta non valida. Riprova tra qualche minuto.',
      502,
      'META_API_ERROR',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
  }

  // Meta può rispondere HTTP 200 ma con un oggetto error nel body
  if (data?.error) {
    return { ok: false, httpStatus: 200, metaError: data.error };
  }

  return { ok: true, data };
}

/**
 * Revoca best-effort il token Meta Ads tramite DELETE /me/permissions.
 *
 * Non lancia mai verso il caller: errori provider restituiti come { success: false }.
 * Il token non viene mai loggato.
 *
 * @param {string} accessToken  Access token Meta in chiaro
 * @returns {{ success: boolean, code?: string, status?: number }}
 */
export async function revokeMetaAdsToken(accessToken) {
  if (!accessToken) {
    return { success: false, code: 'META_TOKEN_MISSING' };
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/permissions`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  let response;
  try {
    response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const code = err.name === 'AbortError' ? 'META_REVOKE_TIMEOUT' : 'META_REVOKE_NETWORK_ERROR';
    return { success: false, code };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return { success: false, code: 'META_REVOKE_FAILED', status: response.status };
  }

  return { success: true };
}

export async function fetchMetaAdAccounts(accessToken) {
  // Prima prova: con business{name,id}
  let result = await tryFetchAdAccountsRaw(accessToken, FIELDS_WITH_BUSINESS);
  let withBusiness = true;

  if (!result.ok) {
    console.warn(
      '[MetaAds] fetchMetaAdAccounts: business{name,id} field rifiutato da Meta ' +
      '(httpStatus=%s, metaError=%o) — fallback senza campo business.',
      result.httpStatus,
      result.metaError ?? '(no error body)',
    );
    withBusiness = false;

    // Seconda prova: campi base senza business
    result = await tryFetchAdAccountsRaw(accessToken, FIELDS_BASE);
  }

  if (!result.ok) {
    const isPermissionError = result.httpStatus === 403;
    const err = new AppError(
      isPermissionError
        ? 'Permessi Meta Ads insufficienti per leggere gli account pubblicitari.'
        : 'Non siamo riusciti a recuperare gli account Meta Ads. Riprova tra poco oppure ricollega Meta Ads.',
      isPermissionError ? 403 : 502,
      isPermissionError ? 'META_PERMISSION_DENIED' : 'META_API_ERROR',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
    err.providerHttpStatus = result.httpStatus;
    throw err;
  }

  const accounts = Array.isArray(result.data.data) ? result.data.data : [];

  return accounts.map((account) => ({
    id:           account.id             ?? null,
    externalRef:  account.id             ?? null,  // "act_123456789"
    name:         account.name           ?? null,
    label:        account.name           ?? null,
    status:       account.account_status ?? null,
    currencyCode: account.currency       ?? null,
    currency:     account.currency       ?? null,
    timeZone:     account.timezone_name  ?? null,
    timezoneName: account.timezone_name  ?? null,
    businessName: withBusiness ? (account.business?.name ?? null) : null,
    businessId:   withBusiness ? (account.business?.id   ?? null) : null,
  }));
}
