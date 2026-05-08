import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendNoContent } from '../contracts/responseBuilders/success.js';
import { env } from '../config/env.js';
import * as integrationsService from '../services/integrations/integrations.service.js';
import { verifyMetaState } from '../services/metaAds/metaAds.auth.service.js';
import { verifyGoogleAdsState } from '../services/googleAds/googleAds.auth.service.js';

// ── Stato ─────────────────────────────────────────────────────────────────────

export const getStatus = asyncHandler(async (req, res) => {
  const integrations = await integrationsService.getIntegrationStatusByClient(
    req.validated.params.clientId,
    req.user.id
  );
  return sendSuccess(res, integrations);
});

// ── Disconnessione ────────────────────────────────────────────────────────────

export const disconnect = asyncHandler(async (req, res) => {
  await integrationsService.disconnectProvider(
    req.validated.params.provider,
    req.validated.params.clientId,
    req.user.id
  );
  return sendNoContent(res);
});

// ── Selezione account (condivisa tra provider) ───────────────────────────────

export const selectAccount = asyncHandler(async (req, res) => {
  const { clientId, externalRef, accountLabel, managerCustomerId, accountInfo } = req.validated.body;
  const data = await integrationsService.selectAccount(
    req.validated.params.provider,
    clientId,
    externalRef,
    accountLabel,
    managerCustomerId,
    req.user.id,
    accountInfo ?? null
  );
  return sendSuccess(res, data);
});

// ── Connessione Shopify ───────────────────────────────────────────────────────

export const shopifyConnect = asyncHandler(async (req, res) => {
  const { clientId, shop } = req.validated.query;
  const { connectUrl } = await integrationsService.initiateShopifyConnect(shop, clientId, req.user.id);
  return sendSuccess(res, { provider: 'shopify', clientId, connectUrl, mode: 'oauth' });
});

/**
 * Callback OAuth Shopify: redirect dal browser avviato da Shopify.
 *
 * Nessun middleware requireAuth su questa route: il browser arriva da Shopify senza
 * header JWT. L'autenticazione è garantita dalla verifica HMAC (richiesta proveniente
 * da Shopify) e dalla verifica dello state (la richiesta corrisponde all'intento di
 * connessione originale; clientId e userId vengono recuperati dallo state firmato).
 *
 * In caso di errore: redirect al frontend con status=error. I dettagli dell'errore
 * non sono mai inclusi nell'URL: i redirect del browser li esporrebbero in cronologia e Referer.
 */
export const shopifyCallback = asyncHandler(async (req, res) => {
  try {
    await integrationsService.processShopifyCallbackAndSave(req.validated.query);
    return res.redirect(
      `${env.frontend.url}/integrations/callback?provider=shopify&status=connected`
    );
  } catch (err) {
    console.error('[shopify.callback] Connect flow failed:', err.message);
    return res.redirect(
      `${env.frontend.url}/integrations/callback?provider=shopify&status=error`
    );
  }
});

// ── Connessione Meta Ads ──────────────────────────────────────────────────────

export const metaAdsConnect = asyncHandler(async (req, res) => {
  const { clientId } = req.validated.query;
  const { connectUrl } = await integrationsService.initiateMetaAdsConnect(clientId, req.user.id);
  return sendSuccess(res, { provider: 'meta_ads', clientId, connectUrl, mode: 'oauth' });
});

/**
 * Callback OAuth Meta Ads: redirect dal browser avviato da Meta.
 *
 * Nessun middleware requireAuth su questa route: il browser arriva da Meta senza
 * header JWT. L'autenticazione è garantita dalla verifica dello state (clientId e
 * userId vengono recuperati dallo state firmato con HMAC).
 *
 * Meta invia parametri di errore (error, error_reason, error_description) invece
 * del code quando l'utente nega i permessi: il caso è gestito esplicitamente prima
 * della chiamata al service, così il redirect avviene in modo pulito senza throw.
 *
 * In caso di errore: redirect al frontend con status=error.
 */
export const metaAdsCallback = asyncHandler(async (req, res) => {
  const { error, code, state } = req.validated.query;

  if (error || !code) {
    // Verifica lo state anche in caso di diniego: conferma che il redirect provenga da un
    // intento di connessione legittimo, non da una callback non richiesta. L'esito è sempre status=error.
    try {
      verifyMetaState(state);
    } catch (err) {
      console.error('[meta_ads.callback] State verification failed during denial:', err.message);
    }
    return res.redirect(
      `${env.frontend.url}/integrations/callback?provider=meta-ads&status=error`
    );
  }

  try {
    const result = await integrationsService.processMetaAdsCallbackAndSave(req.validated.query);
    return res.redirect(
      `${env.frontend.url}/integrations/callback?provider=meta-ads&status=${result.status}`
    );
  } catch (err) {
    console.error('[meta_ads.callback] Connect flow failed:', err.message);
    return res.redirect(
      `${env.frontend.url}/integrations/callback?provider=meta-ads&status=error`
    );
  }
});

export const metaAdsAccounts = asyncHandler(async (req, res) => {
  const data = await integrationsService.getMetaAdsAccounts(
    req.validated.query.clientId,
    req.user.id
  );
  return sendSuccess(res, data);
});

// ── Connessione Google Ads ───────────────────────────────────────────────────

export const googleAdsConnect = asyncHandler(async (req, res) => {
  const { clientId } = req.validated.query;
  const { connectUrl } = await integrationsService.initiateGoogleAdsConnect(clientId, req.user.id);
  return sendSuccess(res, { provider: 'google_ads', clientId, connectUrl, mode: 'oauth' });
});

/**
 * Callback OAuth Google Ads: redirect del browser da Google OAuth.
 *
 * Nessun middleware requireAuth su questa route: le richieste di callback Google
 * non trasportano il JWT della dashboard. L'autenticazione è garantita dalla verifica dello state firmato.
 */
export const googleAdsCallback = asyncHandler(async (req, res) => {
  const { error, code, state } = req.validated.query;

  if (error || !code) {
    try {
      verifyGoogleAdsState(state);
    } catch (err) {
      console.error('[google_ads.callback] State verification failed during denial:', err.message);
    }

    return res.redirect(
      `${env.frontend.url}/integrations/callback?provider=google-ads&status=error`
    );
  }

  try {
    const result = await integrationsService.processGoogleAdsCallbackAndSave(req.validated.query);
    return res.redirect(
      `${env.frontend.url}/integrations/callback?provider=google-ads&status=${result.status}`
    );
  } catch (err) {
    console.error('[google_ads.callback] Connect flow failed:', err.message);
    return res.redirect(
      `${env.frontend.url}/integrations/callback?provider=google-ads&status=error`
    );
  }
});

export const googleAdsAccounts = asyncHandler(async (req, res) => {
  const data = await integrationsService.getGoogleAdsAccounts(
    req.validated.query.clientId,
    req.user.id
  );
  return sendSuccess(res, data);
});
