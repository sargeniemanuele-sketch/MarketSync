import { Router } from 'express';
import express from 'express';
import {
  verifyShopifyWebhookHmac,
  handleShopifyAppUninstalled,
} from '../services/shopify/shopify.webhook.service.js';

const router = Router();

// Regex valida il formato *.myshopify.com (lowercase, senza protocollo).
const SHOPIFY_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

// POST /api/v1/webhooks/shopify/app-uninstalled
//
// Route pubblica: nessun requireAuth, nessun CSRF.
// express.raw() è montato qui (non globalmente) per preservare il raw body
// necessario alla verifica HMAC senza alterare express.json() sulle altre route.
//
// Flusso:
//  1. Verifica HMAC sul raw body                   → 401 se invalido
//  2. Controlla X-Shopify-Topic === app/uninstalled → 400 se topic diverso
//  3. Valida X-Shopify-Shop-Domain                  → 400 se mancante/malformato
//  4. Cancella integrazioni Shopify per lo shop      → sempre 200 (idempotente)
router.post(
  '/shopify/app-uninstalled',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const hmacHeader  = req.headers['x-shopify-hmac-sha256'];
    const topic       = req.headers['x-shopify-topic'];
    const shopDomain  = req.headers['x-shopify-shop-domain'];

    if (!verifyShopifyWebhookHmac(req.body, hmacHeader)) {
      return res.status(401).json({ success: false });
    }

    if (topic !== 'app/uninstalled') {
      return res.status(400).json({ success: false });
    }

    if (!shopDomain || !SHOPIFY_DOMAIN_RE.test(shopDomain.trim().toLowerCase())) {
      return res.status(400).json({ success: false });
    }

    try {
      await handleShopifyAppUninstalled(shopDomain.trim().toLowerCase());
    } catch {
      console.warn('[shopify.webhook] app/uninstalled cleanup failed.');
      return res.status(500).json({ success: false });
    }

    return res.status(200).json({ success: true });
  }
);

export default router;
