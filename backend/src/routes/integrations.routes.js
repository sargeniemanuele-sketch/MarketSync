import { Router } from 'express';

import * as integrationsController from '../controllers/integrations.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { integrationFlowLimiter } from '../middlewares/rateLimit.middleware.js';
import {
  clientIdParamSchema,
  integrationParamSchema,
  providerParamSchema,
  clientIdQuerySchema,
  selectAccountBodySchema,
  shopifyConnectQuerySchema,
  shopifyCallbackQuerySchema,
  metaAdsCallbackQuerySchema,
  googleAdsCallbackQuerySchema,
} from '../validators/integration.validators.js';

const router = Router();

// requireAuth NON è applicato globalmente: le callback Shopify e Meta Ads non possono trasportare
// un JWT (redirect del browser dal provider). Ogni route dichiara il proprio requisito auth.

// ── Stato ─────────────────────────────────────────────────────────────────────

// GET /integrations/:clientId
router.get(
  '/:clientId',
  requireAuth,
  validate({ params: clientIdParamSchema }),
  integrationsController.getStatus
);

// ── Flusso connessione Shopify ────────────────────────────────────────────────
// Route specifiche Shopify registrate prima delle route generiche /:provider/*.
// Express fa match nell'ordine di dichiarazione; il literal '/shopify/...' prevale su '/:provider/...'.

// GET /integrations/shopify/connect?clientId=&shop=
router.get(
  '/shopify/connect',
  requireAuth,
  integrationFlowLimiter,
  validate({ query: shopifyConnectQuerySchema }),
  integrationsController.shopifyConnect
);

// GET /integrations/shopify/callback?shop=&code=&state=&hmac=&timestamp=
// Nessun requireAuth: redirect del browser da Shopify, nessun JWT negli header.
// Auth garantita da verifica HMAC + state firmato (contiene clientId + userId).
router.get(
  '/shopify/callback',
  integrationFlowLimiter,
  validate({ query: shopifyCallbackQuerySchema }),
  integrationsController.shopifyCallback
);

// ── Flusso connessione Meta Ads ───────────────────────────────────────────────
// Route specifiche Meta registrate prima delle route generiche /:provider/*.

// GET /integrations/meta-ads/connect?clientId=
router.get(
  '/meta-ads/connect',
  requireAuth,
  integrationFlowLimiter,
  validate({ query: clientIdQuerySchema }),
  integrationsController.metaAdsConnect
);

// GET /integrations/meta-ads/callback?code=&state=  (o ?error=&state= in caso di diniego)
// Nessun requireAuth: redirect del browser da Meta, nessun JWT negli header.
// Auth garantita dallo state firmato con HMAC (contiene clientId + userId).
router.get(
  '/meta-ads/callback',
  integrationFlowLimiter,
  validate({ query: metaAdsCallbackQuerySchema }),
  integrationsController.metaAdsCallback
);

// GET /integrations/meta-ads/accounts?clientId=
router.get(
  '/meta-ads/accounts',
  requireAuth,
  integrationFlowLimiter,
  validate({ query: clientIdQuerySchema }),
  integrationsController.metaAdsAccounts
);

// ── Flusso connessione Google Ads ─────────────────────────────────────────────
// Route specifiche Google registrate prima delle route generiche /:provider/*.

// GET /integrations/google-ads/connect?clientId=
router.get(
  '/google-ads/connect',
  requireAuth,
  integrationFlowLimiter,
  validate({ query: clientIdQuerySchema }),
  integrationsController.googleAdsConnect
);

// GET /integrations/google-ads/callback?code=&state=  (o ?error=&state= in caso di diniego)
// Nessun requireAuth: redirect del browser da Google OAuth, nessun JWT negli header.
// Auth garantita dallo state firmato con HMAC (contiene clientId + userId).
router.get(
  '/google-ads/callback',
  integrationFlowLimiter,
  validate({ query: googleAdsCallbackQuerySchema }),
  integrationsController.googleAdsCallback
);

// GET /integrations/google-ads/accounts?clientId=
router.get(
  '/google-ads/accounts',
  requireAuth,
  integrationFlowLimiter,
  validate({ query: clientIdQuerySchema }),
  integrationsController.googleAdsAccounts
);

// ── Selezione account (condivisa tra provider) ───────────────────────────────

// POST /integrations/:provider/select-account  body: { clientId, externalRef, accountLabel? }
// Usata da tutti i provider incluso Meta Ads: il gestore generico cifra externalRef
// e preserva le credenziali esistenti tramite $set (solo i campi elencati vengono sovrascritti).
router.post(
  '/:provider/select-account',
  requireAuth,
  integrationFlowLimiter,
  validate({ params: providerParamSchema, body: selectAccountBodySchema }),
  integrationsController.selectAccount
);

// ── Disconnessione ────────────────────────────────────────────────────────────

// DELETE /integrations/:provider/:clientId
router.delete(
  '/:provider/:clientId',
  requireAuth,
  integrationFlowLimiter,
  validate({ params: integrationParamSchema }),
  integrationsController.disconnect
);

export default router;
