import Client from '../../models/Client.js';
import Integration from '../../models/Integration.js';
import { AppError, NotFoundError } from '../../utils/errors.js';
import { encrypt, decrypt } from '../security/encryption.service.js';
import * as shopifyAuthService from '../shopify/shopify.auth.service.js';
import * as metaAdsAuthService from '../metaAds/metaAds.auth.service.js';
import * as googleAdsAuthService from '../googleAds/googleAds.auth.service.js';
import { invalidateByClient } from '../cache/metricCache.service.js';
import { INTERNAL_PROVIDER_KEYS, normalizeProviderSlug } from '../../utils/providers.js';

// ── Costanti ──────────────────────────────────────────────────────────────────

const MAIN_PROVIDERS = INTERNAL_PROVIDER_KEYS;

const DEFAULT_PROVIDER_STATUS = Object.freeze({
  connected: false,
  status: 'not_connected',
  connectedAt: null,
  lastSyncAt: null,
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function assertClientOwnership(clientId, userId) {
  const client = await Client.findOne(
    { _id: clientId, ownerUserId: userId },
    '_id'
  ).lean();

  if (!client) {
    throw new NotFoundError('Cliente non trovato.', { scope: 'integrations' });
  }
}

function serializeIntegration(doc) {
  return {
    connected: doc.status === 'connected',
    status: doc.status,
    connectedAt: doc.connectedAt ?? null,
    lastSyncAt: doc.lastSyncAt ?? null,
    accountInfo: doc.accountInfo ?? null,
  };
}

function buildProviderMap(integrations) {
  const byProvider = {};
  for (const intg of integrations) {
    byProvider[intg.provider] = intg;
  }

  return Object.fromEntries(
    MAIN_PROVIDERS.map((provider) => [
      provider,
      byProvider[provider]
        ? serializeIntegration(byProvider[provider])
        : { ...DEFAULT_PROVIDER_STATUS },
    ])
  );
}

function normalizeGoogleCustomerId(value) {
  if (!value || typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  return digits || null;
}

function normalizeMetaAdAccountId(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^act_\d+$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `act_${trimmed}`;
  return null;
}

async function verifySelectableAccount({
  provider,
  clientId,
  externalRef,
  managerCustomerId,
  userId,
}) {
  if (!provider) {
    throw new AppError(
      'Piattaforma non supportata.',
      400,
      'UNSUPPORTED_PROVIDER',
      { scope: 'integrations' }
    );
  }

  if (provider === 'shopify') {
    return { externalRef, managerCustomerId: null };
  }

  if (provider === 'meta_ads') {
    const requestedRef = normalizeMetaAdAccountId(externalRef);
    const { accounts } = await getMetaAdsAccounts(clientId, userId);
    const account = accounts.find((item) => normalizeMetaAdAccountId(item.externalRef ?? item.id) === requestedRef);

    if (!requestedRef || !account) {
      throw new AppError(
        'L’account Meta Ads selezionato non è più disponibile. Ricarica la lista degli account.',
        422,
        'META_ACCOUNT_SELECTION_REQUIRED',
        { scope: 'meta_ads', provider: 'meta_ads' }
      );
    }

    return { externalRef: requestedRef, managerCustomerId: null };
  }

  if (provider === 'google_ads') {
    const requestedRef = normalizeGoogleCustomerId(externalRef);
    const requestedManagerCustomerId = normalizeGoogleCustomerId(managerCustomerId);
    const { accounts } = await getGoogleAdsAccounts(clientId, userId);
    const account = accounts.find((item) => {
      const accountRef = normalizeGoogleCustomerId(item.externalRef ?? item.id);
      const accountManager = normalizeGoogleCustomerId(item.managerCustomerId);
      return accountRef === requestedRef && accountManager === requestedManagerCustomerId;
    });

    if (!requestedRef || !account) {
      throw new AppError(
        'L’account Google Ads selezionato non è più disponibile. Ricarica la lista degli account.',
        422,
        'GOOGLE_ADS_ACCOUNT_SELECTION_REQUIRED',
        { scope: 'google_ads', provider: 'google_ads' }
      );
    }

    return {
      externalRef: requestedRef,
      managerCustomerId: requestedManagerCustomerId,
    };
  }

  throw new AppError(
    'Piattaforma non supportata.',
    400,
    'UNSUPPORTED_PROVIDER',
    { scope: 'integrations', provider }
  );
}

// ── Stato ─────────────────────────────────────────────────────────────────────

export async function getIntegrationStatusByClient(clientId, userId) {
  await assertClientOwnership(clientId, userId);

  const integrations = await Integration.find(
    { clientId, provider: { $in: MAIN_PROVIDERS } }
  )
    .select('provider status connectedAt lastSyncAt accountInfo')
    .lean();

  return buildProviderMap(integrations);
}

// ── Disconnessione ────────────────────────────────────────────────────────────

/**
 * Elimina definitivamente il record integrazione.
 * Idempotente: record assente → 204, nessun errore.
 *
 * Per Google Ads, tenta la revoca best-effort del refresh token (preferito)
 * o dell'access token prima di cancellare il record.
 * Se la revoca fallisce (timeout, rete, token già scaduto), il disconnect locale
 * prosegue comunque: la cancellazione del record è garantita.
 */
export async function disconnectProvider(provider, clientId, userId) {
  await assertClientOwnership(clientId, userId);
  const normalizedProvider = normalizeProviderSlug(provider);

  // Leggi il record PRIMA di cancellarlo: necessario per la revoca best-effort.
  // Se il record non esiste, integration === null e il disconnect è idempotente.
  const integration = await Integration.findOne(
    { clientId, provider: normalizedProvider }
  )
    .select('credentials')
    .lean();

  if (integration && normalizedProvider === 'google_ads') {
    try {
      let tokenToRevoke = null;
      try {
        tokenToRevoke = decrypt(integration.credentials?.refreshToken);
      } catch {
        // refreshToken non decifrabile: prova accessToken
      }
      if (!tokenToRevoke) {
        try {
          tokenToRevoke = decrypt(integration.credentials?.accessToken);
        } catch {
          // accessToken non decifrabile: revoca non possibile
        }
      }

      if (tokenToRevoke) {
        const revokeResult = await googleAdsAuthService.revokeGoogleAdsToken(tokenToRevoke);
        if (!revokeResult.success) {
          console.warn('[google_ads.disconnect] Google Ads token revoke failed during disconnect:', revokeResult.code);
        }
      }
    } catch {
      console.warn('[google_ads.disconnect] Google Ads token revoke failed during disconnect.');
    }
  }

  if (integration && normalizedProvider === 'meta_ads') {
    try {
      let tokenToRevoke = null;
      try {
        tokenToRevoke = decrypt(integration.credentials?.accessToken);
      } catch {
        // accessToken non decifrabile: revoca non possibile
      }

      if (tokenToRevoke) {
        const revokeResult = await metaAdsAuthService.revokeMetaAdsToken(tokenToRevoke);
        if (!revokeResult.success) {
          console.warn('[meta_ads.disconnect] Meta Ads token revoke failed during disconnect:', revokeResult.code);
        }
      }
    } catch {
      console.warn('[meta_ads.disconnect] Meta Ads token revoke failed during disconnect.');
    }
  }

  await Integration.findOneAndDelete({ clientId, provider: normalizedProvider });
  await invalidateByClient(clientId);
}

// ── Selezione account (condivisa tra provider) ───────────────────────────────

/**
 * Salva il riferimento account provider scelto.
 * externalRef viene cifrato prima della persistenza; accountLabel è solo UI, non persistito.
 * credentials NON viene toccato: $set modifica solo i campi elencati.
 */
export async function selectAccount(provider, clientId, externalRef, accountLabel, managerCustomerId, userId, accountInfo = null) {
  await assertClientOwnership(clientId, userId);

  const normalizedProvider = normalizeProviderSlug(provider);
  const verifiedAccount = await verifySelectableAccount({
    provider: normalizedProvider,
    clientId,
    externalRef,
    managerCustomerId,
    userId,
  });
  const selectedRef = verifiedAccount.externalRef;
  const selectedManagerCustomerId = verifiedAccount.managerCustomerId ?? null;
  const encryptedRef = encrypt(selectedRef);
  const encryptedManagerCustomerId = selectedManagerCustomerId ? encrypt(selectedManagerCustomerId) : null;
  const now = new Date();

  const normalizedAccountInfo =
    accountInfo && typeof accountInfo === 'object'
      ? {
          displayName:     accountInfo.displayName     ?? accountLabel ?? null,
          businessName:    accountInfo.businessName    ?? null,
          businessId:      accountInfo.businessId      ?? null,
          parentManagerId: accountInfo.parentManagerId ?? null,
          currency:        accountInfo.currency        ?? null,
          timezone:        accountInfo.timezone        ?? null,
        }
      : accountLabel
        ? { displayName: accountLabel }
        : null;

  await Integration.findOneAndUpdate(
    { clientId, provider: normalizedProvider },
    {
      $set: {
        status: 'connected',
        externalRef: encryptedRef,
        managerCustomerId: encryptedManagerCustomerId,
        connectedAt: now,
        lastError: null,
        accountInfo: normalizedAccountInfo,
      },
    },
    { upsert: true, new: true }
  );
  await invalidateByClient(clientId);

  return {
    provider: normalizedProvider,
    clientId,
    status: 'connected',
    accountLabel: accountLabel ?? null,
  };
}

// ── Flusso connessione Shopify ────────────────────────────────────────────────

/**
 * Verifica l'ownership del client e poi delega la costruzione dell'URL al service
 * auth Shopify. L'ownership è controllata qui (livello service) prima che giri
 * qualsiasi logica specifica Shopify.
 *
 * @param {string} shop      Dominio store Shopify
 * @param {string} clientId
 * @param {string} userId
 * @returns {{ connectUrl: string }}
 */
export async function initiateShopifyConnect(shop, clientId, userId) {
  await assertClientOwnership(clientId, userId);
  return shopifyAuthService.buildShopifyConnectUrl(shop, clientId, userId);
}

/**
 * Processa la callback Shopify end-to-end:
 *   1. Il service auth Shopify verifica HMAC + state e scambia code con token
 *   2. saveShopifyConnection persiste il record (ownership riverificata tramite userId incluso nello state)
 *
 * Chiamata dal controller callback, che intercetta gli errori e redirige al frontend.
 *
 * @param {object} query  Query params callback validati (tutti i campi Shopify presenti)
 */
export async function processShopifyCallbackAndSave(query) {
  const { shop, accessToken, clientId, userId } =
    await shopifyAuthService.processShopifyCallback(query);

  await saveShopifyConnection({ shop, accessToken, clientId, userId });

  // Registrazione best-effort: non blocca il collegamento se fallisce.
  try {
    const result = await shopifyAuthService.registerShopifyAppUninstalledWebhook({ shopDomain: shop, accessToken });
    if (!result.success) {
      console.warn(`[shopify.webhook.register] Registration failed for shop ${shop}: ${result.code} (status ${result.status ?? '-'})`);
    }
  } catch {
    console.warn(`[shopify.webhook.register] Unexpected error during webhook registration for shop ${shop}.`);
  }
}

/**
 * Crea o aggiorna il record Integration dopo un flusso OAuth Shopify riuscito.
 *
 * externalRef (dominio shop) e credentials.accessToken sono cifrati prima
 * della persistenza: mai salvati in testo in chiaro.
 *
 * Shopify non emette refresh token nel flusso app OAuth standard.
 * credentials.refreshToken e credentials.tokenExpiresAt restano null.
 *
 * @param {object} params
 * @param {string} params.shop         Dominio shop in chiaro: cifrato qui
 * @param {string} params.accessToken  Access token in chiaro: cifrato qui
 * @param {string} params.clientId
 * @param {string} params.userId
 */
export async function saveShopifyConnection({ shop, accessToken, clientId, userId }) {
  await assertClientOwnership(clientId, userId);

  const now = new Date();

  await Integration.findOneAndUpdate(
    { clientId, provider: 'shopify' },
    {
      $set: {
        status: 'connected',
        externalRef:               encrypt(shop),
        'credentials.accessToken': encrypt(accessToken),
        'credentials.refreshToken':   null,
        'credentials.tokenExpiresAt': null,
        connectedAt: now,
        lastError:   null,
      },
    },
    { upsert: true, new: true }
  );

  // Arricchisce accountInfo con nome store e metadati (non-blocking).
  // In ogni caso salva almeno il dominio shop come fallback minimale.
  try {
    const profile = await shopifyAuthService.fetchShopProfile(shop, accessToken);
    const accountInfo = {
      displayName:     profile?.displayName     ?? shop,
      domain:          profile?.domain          ?? shop,
      myshopifyDomain: profile?.myshopifyDomain ?? shop,
      email:           profile?.email           ?? null,
      currency:        profile?.currency        ?? null,
      timezone:        profile?.timezone        ?? null,
    };
    await Integration.findOneAndUpdate(
      { clientId, provider: 'shopify' },
      { $set: { accountInfo } }
    );
  } catch {
    // Fallback finale: salva solo il dominio noto così la card non è vuota.
    try {
      await Integration.findOneAndUpdate(
        { clientId, provider: 'shopify' },
        { $set: { accountInfo: { displayName: shop, myshopifyDomain: shop } } }
      );
    } catch {
      // Non critico.
    }
  }

  await invalidateByClient(clientId);
}

// ── Flusso connessione Meta Ads ───────────────────────────────────────────────

/**
 * Verifica l'ownership del client e poi delega la costruzione dell'URL al service
 * auth Meta Ads.
 *
 * @param {string} clientId
 * @param {string} userId
 * @returns {{ connectUrl: string }}
 */
export async function initiateMetaAdsConnect(clientId, userId) {
  await assertClientOwnership(clientId, userId);
  return metaAdsAuthService.buildMetaConnectUrl(clientId, userId);
}

/**
 * Processa la callback Meta Ads end-to-end:
 *   1. Il service auth Meta verifica lo state e scambia code con token
 *   2. saveMetaAdsToken persiste il record (ownership riverificata tramite userId incluso nello state)
 *
 * Chiamata dal controller callback, che intercetta gli errori e redirige al frontend.
 *
 * externalRef NON viene impostato qui: viene riempito durante select-account dopo che l'utente
 * sceglie quale account pubblicitario connettere. Alla riconnessione, l'externalRef esistente
 * è preservato perché $set tocca solo i campi credentials.
 *
 * @param {object} query  Query params callback validati (almeno code + state)
 */
export async function processMetaAdsCallbackAndSave(query) {
  const { accessToken, tokenExpiresAt, clientId, userId } =
    await metaAdsAuthService.processMetaCallback(query);

  return saveMetaAdsToken({ accessToken, tokenExpiresAt, clientId, userId });
}

/**
 * Crea o aggiorna il record Integration dopo un flusso OAuth Meta Ads riuscito.
 *
 * credentials.accessToken è cifrato prima della persistenza. externalRef intenzionalmente
 * NON viene impostato qui: l'utente seleziona un account pubblicitario in uno step separato.
 * Alla riconnessione, l'externalRef esistente è preservato perché $set tocca solo i campi elencati.
 *
 * Meta emette token utente a lunga durata (~60 giorni). tokenExpiresAt è salvato così il
 * frontend può avvisare prima della scadenza. refreshToken è null: Meta richiede re-auth.
 *
 * @param {object}    params
 * @param {string}    params.accessToken     Access token Meta in chiaro: cifrato qui
 * @param {Date|null} params.tokenExpiresAt  Scadenza del token a lunga durata
 * @param {string}    params.clientId
 * @param {string}    params.userId
 */
async function saveMetaAdsToken({ accessToken, tokenExpiresAt, clientId, userId }) {
  await assertClientOwnership(clientId, userId);

  const existing = await Integration.findOne(
    { clientId, provider: 'meta_ads' }
  )
    .select('externalRef connectedAt')
    .lean();
  const hasSelectedAccount = Boolean(existing?.externalRef);
  const status = hasSelectedAccount ? 'connected' : 'needs_account_selection';

  await Integration.findOneAndUpdate(
    { clientId, provider: 'meta_ads' },
    {
      $set: {
        status,
        'credentials.accessToken':    encrypt(accessToken),
        'credentials.refreshToken':   null,
        'credentials.tokenExpiresAt': tokenExpiresAt ?? null,
        connectedAt: hasSelectedAccount ? (existing.connectedAt ?? new Date()) : null,
        lastError:   null,
      },
    },
    { upsert: true, new: true }
  );
  await invalidateByClient(clientId);

  return { provider: 'meta_ads', clientId, status };
}

/**
 * Legge l'integrazione Meta Ads per un client, decifra l'access token e
 * restituisce la lista degli account pubblicitari disponibili per quel token tramite Meta Graph API.
 *
 * L'ownership viene verificata prima di leggere l'integrazione.
 * Il token decifrato viene consumato internamente e mai restituito al controller.
 *
 * @param {string} clientId
 * @param {string} userId
 * @returns {{ provider: string, clientId: string, accounts: object[], mode: string }}
 */
export async function getMetaAdsAccounts(clientId, userId) {
  await assertClientOwnership(clientId, userId);

  const integration = await Integration.findOne(
    { clientId, provider: 'meta_ads' }
  )
    .select('status credentials')
    .lean();

  if (!integration) {
    throw new AppError(
      'Meta Ads non è collegato a questo cliente.',
      404,
      'INTEGRATION_NOT_FOUND',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
  }

  if (!['connected', 'incomplete', 'needs_account_selection'].includes(integration.status)) {
    throw new AppError(
      'Meta Ads richiede la riconnessione.',
      422,
      'INTEGRATION_NOT_ACTIVE',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
  }

  const accessToken = decrypt(integration.credentials?.accessToken);

  if (!accessToken) {
    throw new AppError(
      'La configurazione Meta Ads è incompleta. Ricollega l’account.',
      422,
      'INTEGRATION_INCOMPLETE',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
  }

  const accounts = await metaAdsAuthService.fetchMetaAdAccounts(accessToken);

  if (accounts.length === 0) {
    throw new AppError(
      'Nessun account pubblicitario Meta disponibile per questo utente.',
      422,
      'META_NO_AD_ACCOUNTS',
      { scope: 'meta_ads', provider: 'meta_ads' }
    );
  }

  return {
    provider: 'meta_ads',
    clientId,
    accounts,
    mode: 'live',
  };
}

// ── Flusso connessione Google Ads ─────────────────────────────────────────────

/**
 * Verifica l'ownership del client e poi delega la costruzione dell'URL al service
 * auth Google Ads.
 *
 * @param {string} clientId
 * @param {string} userId
 * @returns {{ connectUrl: string }}
 */
export async function initiateGoogleAdsConnect(clientId, userId) {
  await assertClientOwnership(clientId, userId);
  return googleAdsAuthService.buildGoogleAdsConnectUrl(clientId, userId);
}

/**
 * Processa la callback Google Ads:
 *   1. Verifica lo state firmato e scambia code con token OAuth
 *   2. Persiste credenziali cifrate su Integration(provider='google_ads')
 *
 * externalRef non viene aggiornato intenzionalmente qui; viene impostato da select-account.
 *
 * @param {object} query
 */
export async function processGoogleAdsCallbackAndSave(query) {
  const { accessToken, refreshToken, tokenExpiresAt, clientId, userId } =
    await googleAdsAuthService.processGoogleAdsCallback(query);

  return saveGoogleAdsConnection({ accessToken, refreshToken, tokenExpiresAt, clientId, userId });
}

/**
 * Salva i token Google Ads dopo la callback OAuth.
 *
 * refreshToken può mancare nei flussi di riconnessione; in quel caso viene
 * preservato il refresh token salvato in precedenza.
 *
 * @param {object} params
 * @param {string} params.accessToken
 * @param {string|null} params.refreshToken
 * @param {Date|null} params.tokenExpiresAt
 * @param {string} params.clientId
 * @param {string} params.userId
 */
async function saveGoogleAdsConnection({ accessToken, refreshToken, tokenExpiresAt, clientId, userId }) {
  await assertClientOwnership(clientId, userId);

  const now = new Date();

  const existing = await Integration.findOne(
    { clientId, provider: 'google_ads' }
  )
    .select('credentials.refreshToken externalRef connectedAt')
    .lean();

  const preservedRefreshToken = existing?.credentials?.refreshToken ?? null;
  const encryptedRefreshToken = refreshToken
    ? encrypt(refreshToken)
    : preservedRefreshToken;
  const hasSelectedAccount = Boolean(existing?.externalRef);
  const status = hasSelectedAccount ? 'connected' : 'needs_account_selection';

  await Integration.findOneAndUpdate(
    { clientId, provider: 'google_ads' },
    {
      $set: {
        status,
        'credentials.accessToken': encrypt(accessToken),
        'credentials.refreshToken': encryptedRefreshToken,
        'credentials.tokenExpiresAt': tokenExpiresAt ?? null,
        connectedAt: hasSelectedAccount ? (existing.connectedAt ?? now) : null,
        lastError: null,
      },
    },
    { upsert: true, new: true }
  );
  await invalidateByClient(clientId);

  return { provider: 'google_ads', clientId, status };
}

/**
 * Restituisce gli account customer Google Ads visibili al token dell'integrazione corrente.
 *
 * Se l'access token è scaduto ed esiste un refresh token, viene tentato un refresh
 * e le credenziali Integration vengono aggiornate prima del fetch degli account.
 *
 * @param {string} clientId
 * @param {string} userId
 * @returns {{ provider: string, clientId: string, accounts: object[], mode: string }}
 */
export async function getGoogleAdsAccounts(clientId, userId) {
  await assertClientOwnership(clientId, userId);

  const integration = await Integration.findOne(
    { clientId, provider: 'google_ads' }
  )
    .select('status credentials externalRef')
    .lean();

  if (!integration) {
    throw new AppError(
      'Google Ads non è collegato a questo cliente.',
      404,
      'INTEGRATION_NOT_FOUND',
      { scope: 'google_ads', provider: 'google_ads' }
    );
  }

  if (!['connected', 'incomplete', 'needs_account_selection'].includes(integration.status)) {
    throw new AppError(
      'Google Ads richiede la riconnessione.',
      422,
      'INTEGRATION_NOT_ACTIVE',
      { scope: 'google_ads', provider: 'google_ads' }
    );
  }

  if (integration.status === 'connected' && !integration.externalRef) {
    await Integration.findOneAndUpdate(
      { clientId, provider: 'google_ads' },
      { $set: { status: 'needs_account_selection' } }
    );
    integration.status = 'needs_account_selection';
  }

  let accessToken = decrypt(integration.credentials?.accessToken);
  const refreshToken = decrypt(integration.credentials?.refreshToken);
  const tokenExpiresAt = integration.credentials?.tokenExpiresAt
    ? new Date(integration.credentials.tokenExpiresAt)
    : null;

  if (!accessToken) {
    throw new AppError(
      'La configurazione Google Ads è incompleta. Ricollega l’account.',
      422,
      'INTEGRATION_INCOMPLETE',
      { scope: 'google_ads', provider: 'google_ads' }
    );
  }

  const isExpired = tokenExpiresAt && !Number.isNaN(tokenExpiresAt.getTime()) && tokenExpiresAt <= new Date();

  if (isExpired) {
    if (!refreshToken) {
      throw new AppError(
        'L’autorizzazione Google Ads è scaduta. Ricollega l’account per continuare.',
        422,
        'INTEGRATION_EXPIRED',
        { scope: 'google_ads', provider: 'google_ads' }
      );
    }

    let refreshedPreemptive;
    try {
      refreshedPreemptive = await googleAdsAuthService.refreshGoogleAdsAccessToken(refreshToken);
    } catch {
      Integration.findOneAndUpdate(
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
      ).catch(() => {});
      throw new AppError(
        'L’autorizzazione Google Ads non è più valida. Ricollega l’account per continuare.',
        422,
        'GOOGLE_ADS_REAUTH_REQUIRED',
        { scope: 'google_ads', provider: 'google_ads' }
      );
    }

    accessToken = refreshedPreemptive.accessToken;

    await Integration.findOneAndUpdate(
      { clientId, provider: 'google_ads' },
      {
        $set: {
          'credentials.accessToken': encrypt(refreshedPreemptive.accessToken),
          'credentials.tokenExpiresAt': refreshedPreemptive.tokenExpiresAt ?? null,
          status:
            integration.status === 'connected' && integration.externalRef
              ? 'connected'
              : 'needs_account_selection',
          lastError: null,
        },
      }
    );
  }

  let accounts;
  try {
    accounts = await googleAdsAuthService.fetchGoogleAdsAccounts(accessToken);
  } catch (err) {
    if (err.providerHttpStatus === 401 && refreshToken) {
      let refreshed401;
      try {
        refreshed401 = await googleAdsAuthService.refreshGoogleAdsAccessToken(refreshToken);
      } catch {
        Integration.findOneAndUpdate(
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
        ).catch(() => {});
        throw new AppError(
          'L’autorizzazione Google Ads non è più valida. Ricollega l’account per continuare.',
          422,
          'GOOGLE_ADS_REAUTH_REQUIRED',
          { scope: 'google_ads', provider: 'google_ads' }
        );
      }

      accessToken = refreshed401.accessToken;

      await Integration.findOneAndUpdate(
        { clientId, provider: 'google_ads' },
        {
          $set: {
            'credentials.accessToken': encrypt(refreshed401.accessToken),
            'credentials.tokenExpiresAt': refreshed401.tokenExpiresAt ?? null,
            status:
              integration.status === 'connected' && integration.externalRef
                ? 'connected'
                : 'needs_account_selection',
            lastError: null,
          },
        }
      );

      accounts = await googleAdsAuthService.fetchGoogleAdsAccounts(accessToken);
    } else {
      throw err;
    }
  }

  return {
    provider: 'google_ads',
    clientId,
    accounts,
    message:
      accounts.length === 0
        ? 'Nessun account Google Ads trovato. Se gestisci gli account tramite un account manager, verifica che l’account Google usato per il collegamento abbia accesso agli account necessari.'
        : null,
    mode: 'live',
  };
}
