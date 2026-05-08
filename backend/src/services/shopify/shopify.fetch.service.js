import Integration from '../../models/Integration.js';
import { decrypt } from '../security/encryption.service.js';
import { logSyncSuccess, logSyncError } from '../logging/syncLog.service.js';
import { AppError } from '../../utils/errors.js';
import { SHOPIFY } from '../../config/app.constants.js';
import { env } from '../../config/env.js';

// ── Risoluzione integrazione ──────────────────────────────────────────────────

/**
 * Legge, valida e decifra l'integrazione Shopify per un client.
 *
 * L'ownership del client deve essere verificata dal chiamante prima di invocare
 * questo service: questa funzione controlla solo che il record integrazione esista
 * e sia in uno stato usabile.
 *
 * Non espone mai dominio shop o access token negli errori lanciati.
 *
 * @param {string} clientId
 * @returns {{ shop: string, accessToken: string }}
 */
async function resolveShopifyIntegration(clientId) {
  const integration = await Integration.findOne(
    { clientId, provider: 'shopify' }
  )
    .select('status externalRef credentials')
    .lean();

  if (!integration) {
    throw new AppError(
      'Shopify non è collegato a questo cliente.',
      404,
      'INTEGRATION_NOT_FOUND',
      { scope: 'shopify', provider: 'shopify' }
    );
  }

  if (integration.status !== 'connected') {
    throw new AppError(
      'Shopify richiede la riconnessione.',
      422,
      'INTEGRATION_NOT_ACTIVE',
      { scope: 'shopify', provider: 'shopify' }
    );
  }

  const shop        = decrypt(integration.externalRef);
  const accessToken = decrypt(integration.credentials?.accessToken);

  if (!shop || !accessToken) {
    throw new AppError(
      'La configurazione Shopify è incompleta. Ricollega lo store.',
      422,
      'INTEGRATION_INCOMPLETE',
      { scope: 'shopify', provider: 'shopify' }
    );
  }

  return { shop, accessToken };
}

// ── Helper HTTP ───────────────────────────────────────────────────────────────

function buildShopifyHeaders(accessToken) {
  return {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function buildShopifyGraphQLUrl(shop) {
  const apiVersion = env.shopify.apiVersion || SHOPIFY.API_VERSION;
  return `https://${shop}/admin/api/${apiVersion}/graphql.json`;
}

/**
 * Costruisce il filtro query GraphQL per gli ordini nel range date dato.
 * Usa processed_at così il range copre gli ordini effettivamente processati
 * nel periodo, non solo quelli creati (utile per ordini con elaborazione differita).
 */
function buildOrdersQueryFilter(startDate, endDate) {
  // Shopify accetta ISO 8601 con timezone. I millisecondi (.000) vengono rimossi
  // per usare il formato più compatto e sicuro supportato dal parser Shopify.
  const start = startDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const end   = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `processed_at:>='${start}' AND processed_at:<='${end}'`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Query GraphQL ─────────────────────────────────────────────────────────────
//
// Campi minimi necessari per mantenere tutti i KPI attuali.
//
// lineItems e refundLineItems sono limitati a 250 elementi ciascuno;
// transactions per rimborso a 50. Per ordini con più voci dei limiti:
//   - totali monetari: invariati (vengono dai MoneyBag dell'ordine)
//   - unitsSold: potenzialmente parziale (lineItemsTruncated)
//   - refundedUnits / returnsAmount: potenzialmente parziali (refundItemsTruncated)
//   - refundedAmount: potenzialmente parziale (refundTransactionsTruncated)
// pageInfo.hasNextPage su ogni connection permette di rilevare il troncamento
// e propagarlo in meta, senza silenziarlo.
//
// sortKey: PROCESSED_AT garantisce coerenza tra il filtro processed_at
// usato in buildOrdersQueryFilter e l'ordine dei cursori di paginazione.
//
// Nota schema Admin API 2026-01:
//   Refund.transactions → OrderTransactionConnection (richiede edges/node)
//   Refund.orderAdjustments → [OrderAdjustment!]! (lista diretta, no edges)

const ORDERS_GRAPHQL_QUERY = `
  query FetchOrders($first: Int!, $after: String, $query: String!) {
    orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT, reverse: false) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          processedAt
          cancelledAt
          currencyCode
          displayFinancialStatus
          subtotalPriceSet      { shopMoney { amount } }
          totalPriceSet         { shopMoney { amount } }
          totalTaxSet           { shopMoney { amount } }
          totalDiscountsSet     { shopMoney { amount } }
          totalShippingPriceSet { shopMoney { amount } }
          lineItems(first: 250) {
            pageInfo { hasNextPage }
            edges {
              node { quantity }
            }
          }
          customer {
            id
            numberOfOrders
          }
          refunds {
            refundLineItems(first: 250) {
              pageInfo { hasNextPage }
              edges {
                node {
                  quantity
                  subtotalSet { shopMoney { amount } }
                  lineItem {
                    originalUnitPriceSet { shopMoney { amount } }
                  }
                }
              }
            }
            transactions(first: 50) {
              pageInfo { hasNextPage }
              edges {
                node {
                  kind
                  status
                  amountSet { shopMoney { amount } }
                }
              }
            }
            orderAdjustments {
              kind
              amountSet { shopMoney { amount } }
            }
          }
        }
      }
    }
  }
`;

// ── Fetch singola pagina ──────────────────────────────────────────────────────

/**
 * Recupera una singola pagina di ordini via GraphQL Admin API.
 *
 * Gestisce retry automatico per:
 *   - HTTP 429: attende il valore Retry-After (default 2s)
 *   - HTTP 5xx: backoff esponenziale (1s, 2s) fino a MAX_RETRIES tentativi aggiuntivi
 *   - GraphQL THROTTLED: backoff esponenziale come i 5xx
 *
 * Non ritenta su timeout (AbortError) né su errori di rete generici.
 * Non ritenta su 401/403: sono errori definitivi che richiedono riconnessione.
 *
 * @param {string} shop
 * @param {string} accessToken   Token in chiaro: mai loggato
 * @param {object} opts
 * @param {number}      opts.first        Numero di ordini da richiedere
 * @param {string|null} opts.after        Cursore paginazione (null = prima pagina)
 * @param {string}      opts.queryFilter  Stringa filtro GraphQL (processed_at range)
 * @returns {{
 *   orders: object[],
 *   hasNextPage: boolean,
 *   endCursor: string|null,
 *   lineItemsTruncated: boolean,
 *   refundItemsTruncated: boolean,
 *   refundTransactionsTruncated: boolean,
 * }}
 */
async function fetchOrdersGraphQL(shop, accessToken, { first, after, queryFilter }) {
  const url       = buildShopifyGraphQLUrl(shop);
  const variables = { first, after: after ?? null, query: queryFilter };
  let attempt     = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), SHOPIFY.FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, {
        method:  'POST',
        headers: buildShopifyHeaders(accessToken),
        body:    JSON.stringify({ query: ORDERS_GRAPHQL_QUERY, variables }),
        signal:  controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        // Il timeout è quasi certamente un problema lato Shopify o di rete pesante:
        // non ha senso ritentare subito la stessa richiesta che ha già impiegato 15s.
        throw new AppError(
          'Shopify sta impiegando troppo tempo a rispondere. Riprova tra qualche minuto.',
          504,
          'SHOPIFY_TIMEOUT',
          { scope: 'shopify', provider: 'shopify' }
        );
      }
      // Retry leggero su errore di rete generico (DNS, connessione rifiutata, ecc.)
      if (attempt < SHOPIFY.MAX_RETRIES) {
        attempt++;
        await sleep(SHOPIFY.RETRY_BASE_DELAY_MS);
        continue;
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

    // ── Gestione errori HTTP ────────────────────────────────────────────────

    if (!response.ok) {
      const isAuthFailure = response.status === 401 || response.status === 403;
      const isRateLimit   = response.status === 429;
      const isTransient   = response.status >= 500;

      if (isAuthFailure) {
        const err = new AppError(
          'L\'autorizzazione Shopify non è più valida. Ricollega lo store.',
          422,
          'SHOPIFY_REAUTH_REQUIRED',
          { scope: 'shopify', provider: 'shopify' }
        );
        err.providerHttpStatus = response.status;
        throw err;
      }

      if ((isRateLimit || isTransient) && attempt < SHOPIFY.MAX_RETRIES) {
        const delay = isRateLimit
          ? (parseInt(response.headers.get('Retry-After') ?? '2', 10) * 1000)
          : SHOPIFY.RETRY_BASE_DELAY_MS * (2 ** attempt);
        attempt++;
        await sleep(delay);
        continue;
      }

      const appErr = new AppError(
        isRateLimit
          ? 'Shopify rate limit raggiunto — riprova tra qualche secondo.'
          : 'Errore durante il recupero dei dati da Shopify. Riprova tra qualche minuto.',
        isRateLimit ? 429 : 502,
        isRateLimit ? 'SHOPIFY_RATE_LIMITED' : 'SHOPIFY_API_ERROR',
        { scope: 'shopify', provider: 'shopify' }
      );
      appErr.providerHttpStatus = response.status;
      throw appErr;
    }

    // ── Parsing risposta ────────────────────────────────────────────────────

    let body;
    try {
      body = await response.json();
    } catch {
      throw new AppError(
        'Shopify ha restituito una risposta non valida. Riprova tra qualche minuto.',
        502,
        'SHOPIFY_API_ERROR',
        { scope: 'shopify', provider: 'shopify' }
      );
    }

    // Shopify restituisce HTTP 200 anche in presenza di errori GraphQL
    if (Array.isArray(body?.errors) && body.errors.length > 0) {
      const firstError  = body.errors[0];
      const extensions  = firstError?.extensions ?? {};
      const errorCode   = extensions.code ?? '';
      const errorMsg    = String(firstError?.message ?? '').toLowerCase();

      if (errorCode === 'ACCESS_DENIED' || errorMsg.includes('access denied')) {
        throw new AppError(
          'L\'autorizzazione Shopify non è più valida. Ricollega lo store.',
          422,
          'SHOPIFY_REAUTH_REQUIRED',
          { scope: 'shopify', provider: 'shopify' }
        );
      }

      if (errorCode === 'THROTTLED') {
        if (attempt < SHOPIFY.MAX_RETRIES) {
          attempt++;
          await sleep(SHOPIFY.RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)));
          continue;
        }
        throw new AppError(
          'Shopify rate limit raggiunto — riprova tra qualche secondo.',
          429,
          'SHOPIFY_RATE_LIMITED',
          { scope: 'shopify', provider: 'shopify' }
        );
      }

      throw new AppError(
        'Errore durante il recupero dei dati da Shopify. Riprova tra qualche minuto.',
        502,
        'SHOPIFY_API_ERROR',
        { scope: 'shopify', provider: 'shopify' }
      );
    }

    const ordersConnection = body?.data?.orders;
    if (!ordersConnection) {
      throw new AppError(
        'Shopify ha restituito una risposta non valida. Riprova tra qualche minuto.',
        502,
        'SHOPIFY_API_ERROR',
        { scope: 'shopify', provider: 'shopify' }
      );
    }

    const orders = (ordersConnection.edges ?? []).map((edge) => edge.node);
    const { hasNextPage = false, endCursor = null } = ordersConnection.pageInfo ?? {};

    // Rileva se qualche ordine ha line items, rimborsi o transazioni rimborso parziali.
    // I totali monetari (grossSales, totalSales, ecc.) rimangono sempre corretti
    // perché vengono dai MoneyBag dell'ordine, non dalle connection limitate.
    const lineItemsTruncated = orders.some(
      (o) => o.lineItems?.pageInfo?.hasNextPage === true
    );
    const refundItemsTruncated = orders.some(
      (o) => Array.isArray(o.refunds) &&
             o.refunds.some((r) => r.refundLineItems?.pageInfo?.hasNextPage === true)
    );
    const refundTransactionsTruncated = orders.some(
      (o) => Array.isArray(o.refunds) &&
             o.refunds.some((r) => r.transactions?.pageInfo?.hasNextPage === true)
    );

    return {
      orders,
      hasNextPage,
      endCursor,
      lineItemsTruncated,
      refundItemsTruncated,
      refundTransactionsTruncated,
    };
  }
}

// ── Paginazione completa ──────────────────────────────────────────────────────

/**
 * Recupera tutti gli ordini nel range date dato usando la paginazione cursor GraphQL.
 *
 * Limitato a SHOPIFY.MAX_PAGES (10 × 250 = 2.500 ordini) per fetch.
 * truncated:true segnala ai chiamanti che il limite è stato raggiunto
 * e i dati possono essere incompleti.
 *
 * @param {string} shop
 * @param {string} accessToken
 * @param {{ startDate: Date, endDate: Date }} dates
 * @returns {{
 *   orders: object[],
 *   pagesFetched: number,
 *   truncated: boolean,
 *   lineItemsTruncated: boolean,
 *   refundItemsTruncated: boolean,
 *   refundTransactionsTruncated: boolean,
 * }}
 */
async function fetchAllOrders(shop, accessToken, { startDate, endDate }) {
  const allOrders   = [];
  const queryFilter = buildOrdersQueryFilter(startDate, endDate);

  let endCursor                    = null;
  let pagesFetched                 = 0;
  let hasNextPage                  = false;
  let lineItemsTruncated           = false;
  let refundItemsTruncated         = false;
  let refundTransactionsTruncated  = false;

  do {
    const result = await fetchOrdersGraphQL(shop, accessToken, {
      first: SHOPIFY.ORDERS_PER_PAGE,
      after: endCursor,
      queryFilter,
    });

    allOrders.push(...result.orders);
    pagesFetched++;
    hasNextPage  = result.hasNextPage;
    endCursor    = result.endCursor;

    // Un singolo ordine con connection parziale basta a impostare il flag per l'intero fetch
    if (result.lineItemsTruncated)          lineItemsTruncated          = true;
    if (result.refundItemsTruncated)        refundItemsTruncated        = true;
    if (result.refundTransactionsTruncated) refundTransactionsTruncated = true;
  } while (hasNextPage && pagesFetched < SHOPIFY.MAX_PAGES);

  return {
    orders:    allOrders,
    pagesFetched,
    truncated:                   hasNextPage && pagesFetched >= SHOPIFY.MAX_PAGES,
    lineItemsTruncated,
    refundItemsTruncated,
    refundTransactionsTruncated,
  };
}

// ── API pubblica ──────────────────────────────────────────────────────────────

/**
 * Recupera i dati grezzi degli ordini Shopify per un client dentro un range date.
 *
 * Usa GraphQL Admin API con filtro processed_at così il range copre gli ordini
 * effettivamente processati nel periodo (non solo creati).
 *
 * Restituisce nodi ordine GraphQL (camelCase) pronti per shopify.normalize.service.js.
 * Nessuna normalizzazione, nessun calcolo KPI, nessuna formattazione UI.
 *
 * L'ownership di clientId deve essere verificata dal chiamante (layer route/controller)
 * prima di invocare questa funzione. Questo service controlla solo lo stato integrazione.
 *
 * I sync log sono a miglior sforzo: i fallimenti di log sono silenziati così non causano
 * mai il fallimento di un fetch. I log di successo vengono avviati senza attesa (nessuna latenza aggiunta).
 * Anche i log di errore vengono avviati senza attesa; l'errore originale viene rilanciato
 * a prescindere dal successo del logging.
 *
 * @param {object} params
 * @param {string} params.clientId
 * @param {string} params.range       Etichetta range (es. 'last_7_days'): per sync log
 * @param {Date}   params.startDate   Inizio inclusivo (normalizzato a UTC dal chiamante)
 * @param {Date}   params.endDate     Fine inclusiva   (normalizzata a UTC dal chiamante)
 *
 * @returns {Promise<{
 *   orders: object[],
 *   meta: {
 *     fetchedAt:    Date,
 *     range:        string,
 *     startDate:    Date,
 *     endDate:      Date,
 *     orderCount:   number,
 *     pagesFetched: number,
 *     truncated:    boolean,
 *   }
 * }>}
 */
export async function fetchRawShopifyData({ clientId, range, startDate, endDate }) {
  const { shop, accessToken } = await resolveShopifyIntegration(clientId);

  const start = Date.now();

  try {
    const {
      orders,
      pagesFetched,
      truncated,
      lineItemsTruncated,
      refundItemsTruncated,
      refundTransactionsTruncated,
    } = await fetchAllOrders(shop, accessToken, { startDate, endDate });

    const durationMs = Date.now() - start;

    // Aggiorna lastSyncAt sul record Integration così bootstrap e viste stato integrazione
    // riflettono il fetch riuscito più recente.
    // Fire-and-forget: un fallimento di scrittura qui non deve invalidare i dati recuperati.
    Integration.findOneAndUpdate(
      { clientId, provider: 'shopify' },
      { $set: { lastSyncAt: new Date() } }
    ).catch(() => {});

    logSyncSuccess({
      clientId,
      provider:       'shopify',
      endpoint:       'orders',
      rangeRequested: range,
      startDate,
      endDate,
      source:         'live',
      durationMs,
    }).catch(() => {});

    return {
      orders,
      meta: {
        fetchedAt:            new Date(),
        range,
        startDate,
        endDate,
        orderCount:           orders.length,
        pagesFetched,
        truncated,
        // lineItemsTruncated: true se almeno un ordine ha più di 250 line items.
        // In quel caso unitsSold è parziale; i totali monetari rimangono corretti.
        lineItemsTruncated,
        // refundItemsTruncated: true se almeno un ordine ha più di 250 refund line items.
        // In quel caso refundedUnits e returnsAmount possono essere parziali.
        refundItemsTruncated,
        // refundTransactionsTruncated: true se almeno un rimborso ha più di 50 transazioni.
        // In quel caso refundedAmount può essere parziale.
        refundTransactionsTruncated,
      },
    };
  } catch (err) {
    const durationMs = Date.now() - start;

    logSyncError({
      clientId,
      provider:       'shopify',
      endpoint:       'orders',
      rangeRequested: range,
      startDate,
      endDate,
      source:         'live',
      durationMs,
      httpStatus:     err.providerHttpStatus ?? null,
      error:          err,
    }).catch(() => {});

    throw err;
  }
}
