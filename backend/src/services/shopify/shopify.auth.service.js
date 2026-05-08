import crypto from 'crypto';
import { env } from '../../config/env.js';
import { AppError, BadRequestError } from '../../utils/errors.js';
import { SHOPIFY } from '../../config/app.constants.js';

// ── State ─────────────────────────────────────────────────────────────────────
//
// Lo state codifica { clientId, userId, nonce, iat }, firmato con HMAC-SHA256 usando
// SHOPIFY_API_SECRET come chiave. Questo elimina la necessità di sessioni lato server:
//
//   - clientId e userId sono recuperabili alla callback senza archiviazione
//   - la firma HMAC impedisce manomissioni
//   - iat abilita la scadenza (finestra di 10 min)
//   - nonce aggiunge entropia e unicità per tentativo di connessione; NON impone
//     l'uso singolo: senza archiviazione lato server del nonce, uno state valido può essere
//     riutilizzato entro la finestra TTL
//
// Formato: base64url(JSON.stringify(payload)) + '.' + hmac_hex

const STATE_TTL_MS = 10 * 60 * 1000;

function normalizeShopDomain(shop) {
  if (!shop || typeof shop !== 'string') {
    return null;
  }

  const withoutProtocol = shop.trim().toLowerCase().replace(/^https?:\/\//, '');
  const host = withoutProtocol.split('/')[0];
  const normalized = host.includes('.') ? host : `${host}.myshopify.com`;

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function generateState(clientId, userId) {
  const payload = {
    clientId,
    userId,
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', env.shopify.apiSecret).update(encoded).digest('hex');
  return `${encoded}.${sig}`;
}

function parseAndVerifyState(state) {
  const dot = state.lastIndexOf('.');
  if (dot === -1) {
    throw new BadRequestError('Collegamento Shopify non valido. Riprova.', { scope: 'shopify', provider: 'shopify' });
  }

  const encoded = state.slice(0, dot);
  const sig     = state.slice(dot + 1);

  const expectedSig = crypto
    .createHmac('sha256', env.shopify.apiSecret)
    .update(encoded)
    .digest('hex');

  const sigBuf      = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new BadRequestError('Collegamento Shopify non valido. Riprova.', { scope: 'shopify', provider: 'shopify' });
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestError('Collegamento Shopify non valido. Riprova.', { scope: 'shopify', provider: 'shopify' });
  }

  if (!payload.clientId || !payload.userId || typeof payload.iat !== 'number') {
    throw new BadRequestError('Collegamento Shopify non valido. Riprova.', { scope: 'shopify', provider: 'shopify' });
  }

  if (Date.now() - payload.iat > STATE_TTL_MS) {
    throw new BadRequestError('Collegamento Shopify scaduto. Riprova dalla sezione Integrazioni.', { scope: 'shopify', provider: 'shopify' });
  }

  return { clientId: payload.clientId, userId: payload.userId };
}

// ── Verifica HMAC ─────────────────────────────────────────────────────────────
//
// Shopify firma la query string della callback con SHOPIFY_API_SECRET.
// Verifica: rimuovere 'hmac', ordinare alfabeticamente i parametri rimanenti,
// costruire la stringa 'key=value&...', confrontare il digest esadecimale HMAC-SHA256.
//
// queryParams deve contenere i valori grezzi (non trimmati) della richiesta:
// qualsiasi trasformazione romperebbe il confronto del digest.

function verifyShopifyHmac(queryParams) {
  const { hmac, ...rest } = queryParams;

  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('&');

  const digest = crypto
    .createHmac('sha256', env.shopify.apiSecret)
    .update(message)
    .digest('hex');

  const hmacBuf   = Buffer.from(hmac,   'hex');
  const digestBuf = Buffer.from(digest, 'hex');

  if (hmacBuf.length !== digestBuf.length || !crypto.timingSafeEqual(hmacBuf, digestBuf)) {
    throw new BadRequestError('Collegamento Shopify non valido. Riprova.', { scope: 'shopify', provider: 'shopify' });
  }
}

// ── Scambio token ─────────────────────────────────────────────────────────────

async function exchangeCodeForToken(shop, code) {
  const url = `https://${shop}/admin/oauth/access_token`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SHOPIFY.FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id:     env.shopify.apiKey,
        client_secret: env.shopify.apiSecret,
        code,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError(
        'Shopify sta impiegando troppo tempo a rispondere. Riprova tra qualche minuto.',
        504,
        'SHOPIFY_TIMEOUT',
        { scope: 'shopify', provider: 'shopify' }
      );
    }
    throw new AppError(
      'Impossibile comunicare con Shopify. Riprova tra qualche minuto.',
      502,
      'SHOPIFY_NETWORK_ERROR',
      { scope: 'shopify', provider: 'shopify' }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new AppError(
      'Non è stato possibile completare il collegamento con Shopify. Riprova.',
      502,
      'SHOPIFY_TOKEN_EXCHANGE_FAILED',
      { scope: 'shopify', provider: 'shopify' }
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new AppError(
      'Shopify ha restituito una risposta non valida. Riprova tra qualche minuto.',
      502,
      'SHOPIFY_AUTH_ERROR',
      { scope: 'shopify', provider: 'shopify' }
    );
  }

  if (!data.access_token) {
    throw new AppError(
      'Non è stato possibile completare il collegamento con Shopify. Riprova.',
      502,
      'SHOPIFY_TOKEN_EXCHANGE_FAILED',
      { scope: 'shopify', provider: 'shopify' }
    );
  }

  return data.access_token;
}

// ── Controlli ─────────────────────────────────────────────────────────────────

function assertConfigured() {
  if (!env.shopify.apiKey || !env.shopify.apiSecret) {
    throw new AppError(
      'Shopify non è ancora configurato. Contatta il supporto.',
      503,
      'SHOPIFY_NOT_CONFIGURED',
      { scope: 'shopify', provider: 'shopify' }
    );
  }
}

// ── Registrazione webhook ─────────────────────────────────────────────────────
//
// Prima verifica se esiste già una subscription app/uninstalled con lo stesso address:
// evita duplicati senza richiedere logica di dedup lato Shopify.
// Non lancia mai: il caller gestisce il risultato best-effort.
// Non logga mai accessToken.

async function fetchExistingAppUninstalledWebhook(shop, accessToken, expectedAddress) {
  const params = new URLSearchParams({ topic: 'app/uninstalled' });
  const url = `https://${shop}/admin/api/${SHOPIFY.API_VERSION}/webhooks.json?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SHOPIFY.FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) return null;

  let data;
  try {
    data = await response.json();
  } catch {
    return null;
  }

  return (data?.webhooks ?? []).find((wh) => wh.address === expectedAddress) ?? null;
}

// ── API pubblica ──────────────────────────────────────────────────────────────

/**
 * Costruisce l'URL di autorizzazione OAuth Shopify.
 *
 * clientId e userId sono incorporati nello state firmato con HMAC così possono
 * essere recuperati alla callback senza una sessione lato server.
 *
 * @param {string} shop      Dominio store Shopify (es. my-store.myshopify.com)
 * @param {string} clientId  Dashboard client ID
 * @param {string} userId    ID utente autenticato: incorporato nello state firmato
 * @returns {{ connectUrl: string }}
 */
export function buildShopifyConnectUrl(shop, clientId, userId) {
  assertConfigured();

  const normalizedShop = normalizeShopDomain(shop);
  if (!normalizedShop) {
    throw new AppError(
      'Inserisci il nome del tuo store Shopify, ad esempio: nome-store o nome-store.myshopify.com.',
      422,
      'SHOPIFY_INVALID_SHOP_DOMAIN',
      { scope: 'shopify', provider: 'shopify' }
    );
  }

  const state  = generateState(clientId, userId);
  const params = new URLSearchParams({
    client_id:    env.shopify.apiKey,
    scope:        env.shopify.scopes,
    redirect_uri: env.shopify.callbackUrl,
    state,
  });

  return { connectUrl: `https://${normalizedShop}/admin/oauth/authorize?${params.toString()}` };
}

/**
 * Processa la callback OAuth Shopify.
 *
 * 1. Verifica la firma HMAC di Shopify: conferma che la richiesta arrivi da Shopify.
 * 2. Verifica lo state firmato: conferma che la richiesta corrisponda all'intento
 *    di connessione originale e recupera clientId + userId senza una sessione.
 * 3. Scambia l'authorization code con un access token.
 *
 * Non logga né restituisce mai l'access token in un messaggio di errore.
 *
 * @param {object} query  Query params callback validati (.passthrough: tutti i campi Shopify presenti)
 * @returns {{ shop: string, accessToken: string, clientId: string, userId: string }}
 */
export async function processShopifyCallback(query) {
  assertConfigured();

  const { shop, code, state } = query;

  verifyShopifyHmac(query);

  const normalizedShop = normalizeShopDomain(shop);
  if (!normalizedShop) {
    throw new AppError(
      'Collegamento Shopify non valido. Riprova.',
      422,
      'SHOPIFY_INVALID_SHOP_DOMAIN',
      { scope: 'shopify', provider: 'shopify' }
    );
  }

  const { clientId, userId } = parseAndVerifyState(state);

  const accessToken = await exchangeCodeForToken(normalizedShop, code);

  return { shop: normalizedShop, accessToken, clientId, userId };
}

/**
 * Recupera il profilo pubblico dello store Shopify tramite Admin API.
 *
 * Non lancia errori: se la chiamata fallisce per qualsiasi motivo restituisce null
 * così il flusso di connessione non viene interrotto.
 *
 * @param {string} shop         Dominio shop normalizzato (es. nome-store.myshopify.com)
 * @param {string} accessToken  Access token Shopify in chiaro
 * @returns {object|null}
 */
export async function fetchShopProfile(shop, accessToken) {
  const url = `https://${shop}/admin/api/${SHOPIFY.API_VERSION}/shop.json`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        Accept: 'application/json',
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return null;
  }

  const s = data?.shop;
  if (!s) {
    return null;
  }

  return {
    displayName:     s.name              ?? null,
    domain:          s.domain            ?? null,
    myshopifyDomain: s.myshopify_domain  ?? null,
    email:           s.email             ?? null,
    currency:        s.currency          ?? null,
    timezone:        s.iana_timezone     ?? null,
  };
}

/**
 * Registra la webhook subscription app/uninstalled presso Shopify.
 *
 * Prima controlla se esiste già una subscription con lo stesso address per evitare duplicati.
 * Non lancia mai errori: restituisce sempre { success, ... } così il caller può gestirlo
 * in modo best-effort senza bloccare il flusso di connessione.
 *
 * Non logga accessToken in nessun percorso.
 *
 * @param {string} shopDomain    Dominio shop normalizzato (es. nome-store.myshopify.com)
 * @param {string} accessToken   Access token Shopify in chiaro
 * @returns {{ success: boolean, id?: number, code?: string, status?: number }}
 */
export async function registerShopifyAppUninstalledWebhook({ shopDomain, accessToken }) {
  if (!shopDomain || !accessToken) {
    return { success: false, code: 'MISSING_PARAMS' };
  }

  const address = `${env.backend.publicUrl}/api/v1/webhooks/shopify/app-uninstalled`;

  const existing = await fetchExistingAppUninstalledWebhook(shopDomain, accessToken, address);
  if (existing) {
    return { success: true, id: existing.id, code: 'ALREADY_REGISTERED' };
  }

  const url = `https://${shopDomain}/admin/api/${SHOPIFY.API_VERSION}/webhooks.json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SHOPIFY.FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        webhook: { topic: 'app/uninstalled', address, format: 'json' },
      }),
      signal: controller.signal,
    });
  } catch {
    return { success: false, code: 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return { success: false, code: 'SHOPIFY_ERROR', status: response.status };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { success: false, code: 'PARSE_ERROR' };
  }

  const id = data?.webhook?.id ?? null;
  return { success: true, id };
}
