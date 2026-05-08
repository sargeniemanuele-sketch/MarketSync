import { z } from 'zod';
import { mongoIdSchema } from './client.validators.js';
import { normalizeProviderSlug } from '../utils/providers.js';

const providerEnum = z
  .string({ required_error: 'provider is required' })
  .trim()
  .transform((provider) => normalizeProviderSlug(provider))
  .refine(Boolean, {
    message: 'Provider must be one of: shopify, meta-ads/meta_ads, google-ads/google_ads',
  });

// ── Schemi params ─────────────────────────────────────────────────────────────

// Rotta: /:provider  (connessione generica, callback, accounts, select-account)
export const providerParamSchema = z.object({ provider: providerEnum });

// Rotta: /:provider/:clientId
export const integrationParamSchema = z.object({
  clientId: mongoIdSchema,
  provider: providerEnum,
});

// Rotta: /:clientId
export const clientIdParamSchema = z.object({
  clientId: mongoIdSchema,
});

// ── Schemi query ──────────────────────────────────────────────────────────────

// Query: ?clientId=  (connessione generica, callback, accounts)
export const clientIdQuerySchema = z.object({ clientId: mongoIdSchema });

// Query: ?clientId=&shop=  (connessione Shopify)
export const shopifyConnectQuerySchema = z.object({
  clientId: mongoIdSchema,
  shop: z
    .string({ required_error: 'shop is required' })
    .min(1)
    .max(255)
    .trim(),
});

// Query: parametri callback OAuth Shopify.
// .passthrough() è richiesto: tutti i query params, inclusi extra Shopify come 'host',
// devono arrivare invariati a verifyShopifyHmac. Nessun .trim() su alcun campo; il trim
// altererebbe i valori e romperebbe la verifica HMAC.
export const shopifyCallbackQuerySchema = z.object({
  shop:      z.string().min(1),
  code:      z.string().min(1),
  state:     z.string().min(1),
  hmac:      z.string().min(1),
  timestamp: z.string().min(1),
}).passthrough();

// Query: parametri callback OAuth Meta Ads.
// .passthrough() preserva eventuali parametri extra che Meta può includere.
// code è opzionale: Meta invia error+state invece di code se l'utente nega.
// state è sempre presente sia nelle callback di successo sia in quelle di errore.
export const metaAdsCallbackQuerySchema = z.object({
  state:             z.string().min(1),
  code:              z.string().min(1).optional(),
  error:             z.string().optional(),
  error_reason:      z.string().optional(),
  error_description: z.string().optional(),
}).passthrough();

// Query: parametri callback OAuth Google Ads.
// .passthrough() preserva i parametri extra Google OAuth quando presenti.
// code è opzionale: Google invia error+state invece di code in caso di diniego.
export const googleAdsCallbackQuerySchema = z.object({
  state: z.string().min(1),
  code: z.string().min(1).optional(),
  error: z.string().optional(),
  error_subtype: z.string().optional(),
  error_description: z.string().optional(),
}).passthrough();

// ── Schemi body ───────────────────────────────────────────────────────────────

// POST /integrations/:provider/select-account
// externalRef è l'identificatore account specifico del provider:
//   Shopify  → dominio shop (es. mystore.myshopify.com)
//   Meta     → ID account pubblicitario (es. act_123456789)
//   GoogleAds → customer ID (es. 123-456-7890)
export const selectAccountBodySchema = z
  .object({
    clientId: mongoIdSchema,
    externalRef: z.string().min(1).max(255).trim().optional(),
    accountId: z.string().min(1).max(255).trim().optional(),
    accountLabel: z
      .string()
      .max(150)
      .trim()
      .optional(),
    managerCustomerId: z
      .string()
      .max(255)
      .trim()
      .optional(),
    accountInfo: z.object({
      displayName:     z.string().max(255).optional().nullable(),
      businessName:    z.string().max(255).optional().nullable(),
      businessId:      z.string().max(255).optional().nullable(),
      parentManagerId: z.string().max(255).optional().nullable(),
      currency:        z.string().max(20).optional().nullable(),
      timezone:        z.string().max(100).optional().nullable(),
    }).optional().nullable(),
  })
  .strict()
  .transform((data) => ({
    ...data,
    externalRef: data.externalRef ?? data.accountId,
  }))
  .refine((data) => Boolean(data.externalRef), {
    message: 'externalRef or accountId is required',
    path: ['externalRef'],
  });
