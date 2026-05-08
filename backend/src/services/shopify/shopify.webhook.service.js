import crypto from 'crypto';
import { env } from '../../config/env.js';
import Integration from '../../models/Integration.js';
import { decrypt } from '../security/encryption.service.js';
import { invalidateByClient } from '../cache/metricCache.service.js';

// ── Verifica HMAC webhook ─────────────────────────────────────────────────────
//
// Shopify firma i webhook con HMAC-SHA256 sul raw body, digest base64.
// Il confronto usa timingSafeEqual per prevenire timing attack.
// Restituisce false invece di lanciare: la decisione di rispondere 401 spetta al controller.

export function verifyShopifyWebhookHmac(rawBody, hmacHeader) {
  if (!rawBody || !hmacHeader || typeof hmacHeader !== 'string') return false;

  const computed = crypto
    .createHmac('sha256', env.shopify.apiSecret)
    .update(rawBody)
    .digest('base64');

  const computedBuf = Buffer.from(computed);
  const headerBuf   = Buffer.from(hmacHeader.trim());

  if (computedBuf.length !== headerBuf.length) return false;

  return crypto.timingSafeEqual(computedBuf, headerBuf);
}

// ── Cleanup integrazione Shopify disinstallata ────────────────────────────────
//
// Cerca tutte le integrazioni Shopify il cui externalRef cifrato corrisponde al
// shop domain notificato. Cancella il record e invalida la cache per ogni match.
//
// Approccio scansione lineare + decrypt: accettabile per MVP/scala bassa.
// Per SaaS ad alta scala conviene aggiungere un campo hash indicizzato dello shop
// domain (es. externalRefHash) per evitare la scansione completa.
//
// Idempotente: se l'integrazione non esiste restituisce deletedCount 0 senza errori.

export async function handleShopifyAppUninstalled(shopDomain) {
  const integrations = await Integration.find(
    { provider: 'shopify' },
    'clientId externalRef'
  ).lean();

  let deletedCount = 0;

  for (const intg of integrations) {
    if (!intg.externalRef) continue;

    let decryptedRef;
    try {
      decryptedRef = decrypt(intg.externalRef);
    } catch {
      continue;
    }

    if (decryptedRef !== shopDomain) continue;

    await Integration.findOneAndDelete({ clientId: intg.clientId, provider: 'shopify' });

    try {
      await invalidateByClient(intg.clientId);
    } catch {
      // invalidazione cache best-effort: non bloccare il cleanup
    }

    deletedCount++;
  }

  if (deletedCount > 0) {
    console.warn(`[shopify.webhook] app/uninstalled: removed ${deletedCount} integration(s) for shop ${shopDomain}`);
  }

  return { deletedCount };
}
