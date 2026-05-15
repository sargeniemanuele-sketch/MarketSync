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
//   Refund.orderAdjustments → OrderAdjustmentConnection in 2026-01 (richiede edges/node).
//   Rimosso dalla query: la deduction shipping-refund non è critica per MVP.
//   sumRefundedShipping restituisce 0 quando assente → shipping = totalShippingPriceSet lordo.

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
          }
        }
      }
    }
  }
`;

// ── Query GraphQL minimale (fallback scope limitati) ─────────────────────────
//
// Usata quando la query completa fallisce per ACCESS_DENIED / scope mancanti.
// Non include customer, refunds, transactions, orderAdjustments.
// Compatibile con il solo scope read_orders.
// normalizeOrders gestisce già tutti i campi come opzionali.

const ORDERS_GRAPHQL_QUERY_MINIMAL = `
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
        }
      }
    }
  }
`;

// ── Helpers diagnostica e classificazione errori GraphQL ──────────────────────

/**
 * Determina se un errore GraphQL Shopify è causato da scope o accesso negato.
 * Copre sia errori di token invalido (ACCESS_DENIED) sia scope mancanti.
 */
function isShopifyScopeError(errorCode, errorMsg) {
  const codeUpper = String(errorCode ?? '').toUpperCase();
  const msgLower  = String(errorMsg  ?? '').toLowerCase();
  return (
    codeUpper === 'ACCESS_DENIED'           ||
    msgLower.includes('access denied')      ||
    msgLower.includes('required access')    ||
    msgLower.includes('protected customer data') ||
    msgLower.includes('scope')
  );
}

/**
 * Logga i dettagli di un errore GraphQL Shopify lato server.
 * Non espone mai accessToken. Il dominio shop viene mascherato parzialmente.
 * Questi dettagli non raggiungono mai il frontend.
 */
function logShopifyGraphQLError({ shop, errors, apiVersion }) {
  if (!Array.isArray(errors) || errors.length === 0) return;
  const firstError = errors[0];
  const extensions = firstError?.extensions ?? {};
  const shopMasked = typeof shop === 'string'
    ? shop.replace(/^[^.]+/, '[store]')
    : '[unknown]';
  console.error('[shopify:graphql_error]', JSON.stringify({
    provider:    'shopify',
    apiVersion,
    operation:   'FetchOrders',
    message:     firstError?.message  ?? null,
    code:        extensions?.code     ?? null,
    path:        firstError?.path     ?? null,
    errorCount:  errors.length,
    shop:        shopMasked,
  }));
}

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
async function fetchOrdersGraphQL(shop, accessToken, { first, after, queryFilter }, graphqlQuery = ORDERS_GRAPHQL_QUERY) {
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
        body:    JSON.stringify({ query: graphqlQuery, variables }),
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

      // Errori THROTTLED: retry con backoff, nessun log (sono transitori)
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

      // Log diagnostico server-side per tutti gli errori non-transitori (Task 1)
      // Non raggiunge mai il frontend.
      logShopifyGraphQLError({
        shop,
        errors: body.errors,
        apiVersion: env.shopify.apiVersion || SHOPIFY.API_VERSION,
      });

      // Errori scope / accesso negato: codice specifico per consentire il fallback
      // alla query minimale nel chiamante (Task 2)
      if (isShopifyScopeError(errorCode, errorMsg)) {
        throw new AppError(
          'Shopify ha negato l\'accesso ad alcuni dati richiesti. Verifica gli scope dell\'app e ricollega lo store.',
          422,
          'SHOPIFY_SCOPE_OR_ACCESS_DENIED',
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
async function fetchAllOrders(shop, accessToken, { startDate, endDate }, graphqlQuery = ORDERS_GRAPHQL_QUERY) {
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
    }, graphqlQuery);

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

// ── ShopifyQL / Shopify Reports ───────────────────────────────────────────────
//
// Usa shopifyqlQuery (GraphQL Admin API) come fonte primaria per le metriche
// sales. Richiede lo scope read_reports sul token.
//
// Query unica: TIMESERIES day WITH TOTALS — restituisce sia i valori aggregati
// del periodo (riga TOTALS con day=null) sia la serie giornaliera (sparkline).
//
// Campi ShopifyQL (Admin GraphQL 2026-01):
//   returns            → shopify_returns    (campo ufficiale; 'sales_reversals' rimosso)
//   shipping_charges   → shopify_shipping
//   net_items_sold     → shopify_units_sold (solo in fullQuery)
//   returning_customer_rate → shopify_returning_customers (solo in fullQuery)
//
// Strategia a due livelli:
//   fullQuery  — tutti i campi inclusi i campi opzionali
//   minQuery   — solo i 6 campi core (total_sales, orders, gross_sales, discounts,
//                net_sales, taxes); nessun campo che può causare Column Not Found.
//
// Se fullQuery lancia SHOPIFY_QL_PARSE_ERROR → retry con minQuery.
// Se minQuery riesce → campi opzionali marcati unavailable (hasReturns=false ecc.).
// Se anche minQuery fallisce → errore propagato, nessun fallback order-based.
// Se read_reports manca → lancia SHOPIFY_REPORTS_ACCESS_REQUIRED.

function formatShopifyQLDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseShopifyQLTable(tableData) {
  if (!tableData) return null;
  // columns (API 2024-04+) o headers (versioni precedenti)
  const columnDefs = tableData.columns ?? tableData.headers ?? [];
  const names = columnDefs.map((c) => c.name);
  // rows (API 2024-04+) o rowData (versioni precedenti)
  const rawRows = Array.isArray(tableData.rows) ? tableData.rows
    : Array.isArray(tableData.rowData)          ? tableData.rowData
    : [];
  return rawRows.map((row) => {
    const obj = {};
    names.forEach((name, i) => { obj[name] = row[i] ?? null; });
    return obj;
  });
}

function logShopifyQLError({ shop, queryType, errors }) {
  if (!errors || errors.length === 0) return;
  const shopMasked = typeof shop === 'string' ? shop.replace(/^[^.]+/, '[store]') : '[unknown]';
  console.error('[shopify:shopifyql_error]', JSON.stringify({
    provider:   'shopify',
    apiVersion: env.shopify.apiVersion || SHOPIFY.API_VERSION,
    queryType,
    message:    errors[0]?.message ?? null,
    code:       errors[0]?.code    ?? null,
    shop:       shopMasked,
  }));
}

/**
 * Normalizza `parseErrors` da shopifyqlQuery in un array di oggetti safe.
 *
 * In alcune versioni API Shopify parseErrors è uno scalar String, non un array
 * di oggetti strutturati. Gestisce tutti i casi senza crashare:
 *   - stringa non vuota  → [ { message: str, code: null } ]
 *   - array              → ogni elemento wrappato se non è oggetto
 *   - oggetto singolo    → [ oggetto ]
 *   - null / vuoto       → []
 */
function normalizeShopifyQLParseErrors(raw) {
  if (raw == null || raw === '') return [];
  if (typeof raw === 'string') return [{ message: raw, code: null }];
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    return raw.map((e) =>
      e && typeof e === 'object' ? e : { message: String(e), code: null }
    );
  }
  if (typeof raw === 'object') return [raw];
  return [];
}

/**
 * Esegue una singola query ShopifyQL via GraphQL Admin API.
 *
 * Gestisce retry per 429/5xx e THROTTLED esattamente come fetchOrdersGraphQL.
 * Lancia SHOPIFY_REPORTS_SCOPE_REQUIRED se manca read_reports.
 * Lancia SHOPIFY_QL_PARSE_ERROR se la query ShopifyQL ha errori di sintassi
 * (utile per retry senza campi opzionali).
 *
 * @returns {object[]} Righe parsed ({header: value, ...} per riga)
 */
async function executeShopifyQLQuery(shop, accessToken, qlQuery, queryType) {
  const url = buildShopifyGraphQLUrl(shop);
  const gqlBody = JSON.stringify({
    query: `query ShopifyQLReport($query: String!) {
      shopifyqlQuery(query: $query) {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }`,
    variables: { query: qlQuery },
  });

  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), SHOPIFY.FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, {
        method:  'POST',
        headers: buildShopifyHeaders(accessToken),
        body:    gqlBody,
        signal:  controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new AppError(
          'Shopify sta impiegando troppo tempo a rispondere. Riprova tra qualche minuto.',
          504, 'SHOPIFY_TIMEOUT', { scope: 'shopify', provider: 'shopify' }
        );
      }
      if (attempt < SHOPIFY.MAX_RETRIES) { attempt++; await sleep(SHOPIFY.RETRY_BASE_DELAY_MS); continue; }
      throw new AppError(
        'Impossibile comunicare con Shopify. Riprova tra qualche minuto.',
        502, 'SHOPIFY_NETWORK_ERROR', { scope: 'shopify', provider: 'shopify' }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const isAuth      = response.status === 401 || response.status === 403;
      const isRateLimit = response.status === 429;
      const isTransient = response.status >= 500;

      if (isAuth) {
        const authErr = new AppError(
          'L\'autorizzazione Shopify non è più valida. Ricollega lo store.',
          422, 'SHOPIFY_REAUTH_REQUIRED', { scope: 'shopify', provider: 'shopify' }
        );
        authErr.providerHttpStatus = response.status;
        throw authErr;
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

    let body;
    try {
      body = await response.json();
    } catch {
      throw new AppError(
        'Shopify ha restituito una risposta non valida. Riprova tra qualche minuto.',
        502, 'SHOPIFY_API_ERROR', { scope: 'shopify', provider: 'shopify' }
      );
    }

    // Errori GraphQL a livello trasporto (non parse errors ShopifyQL)
    if (Array.isArray(body?.errors) && body.errors.length > 0) {
      const firstError = body.errors[0];
      const extensions = firstError?.extensions ?? {};
      const errorCode  = extensions.code ?? '';
      const errorMsg   = String(firstError?.message ?? '').toLowerCase();

      if (errorCode === 'THROTTLED') {
        if (attempt < SHOPIFY.MAX_RETRIES) {
          attempt++;
          await sleep(SHOPIFY.RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)));
          continue;
        }
        throw new AppError(
          'Shopify rate limit raggiunto — riprova tra qualche secondo.',
          429, 'SHOPIFY_RATE_LIMITED', { scope: 'shopify', provider: 'shopify' }
        );
      }

      logShopifyQLError({ shop, queryType, errors: body.errors });

      if (isShopifyScopeError(errorCode, errorMsg)) {
        // Non assumiamo che manchi solo read_reports: potrebbe essere anche una
        // access policy su dati protetti. Il messaggio frontend è generico.
        throw new AppError(
          'Per mostrare metriche identiche ai report Shopify Analytics, l\'app deve avere accesso ai report Shopify tramite read_reports e agli eventuali dati protetti richiesti da Shopify.',
          422, 'SHOPIFY_REPORTS_ACCESS_REQUIRED', { scope: 'shopify', provider: 'shopify' }
        );
      }

      throw new AppError(
        'Errore durante il recupero dei dati da Shopify. Riprova tra qualche minuto.',
        502, 'SHOPIFY_API_ERROR', { scope: 'shopify', provider: 'shopify' }
      );
    }

    const qlResponse = body?.data?.shopifyqlQuery;
    if (!qlResponse) {
      throw new AppError(
        'Shopify ha restituito una risposta ShopifyQL non valida. Riprova tra qualche minuto.',
        502, 'SHOPIFY_API_ERROR', { scope: 'shopify', provider: 'shopify' }
      );
    }

    // Parse errors ShopifyQL: sintassi query non valida (es. campo non supportato).
    // parseErrors può essere String scalar o array a seconda della versione API.
    const normalizedParseErrors = normalizeShopifyQLParseErrors(qlResponse.parseErrors);
    if (normalizedParseErrors.length > 0) {
      logShopifyQLError({ shop, queryType, errors: normalizedParseErrors });
      const parseErr = new AppError(
        'Query ShopifyQL non valida — campo non supportato o sintassi errata.',
        502, 'SHOPIFY_QL_PARSE_ERROR', { scope: 'shopify', provider: 'shopify' }
      );
      parseErr.parseErrors = normalizedParseErrors;
      throw parseErr;
    }

    return parseShopifyQLTable(qlResponse.tableData);
  }
}

/**
/**
 * Separa la riga TOTALS (day=null/vuoto) dalle righe timeseries in una risposta
 * ShopifyQL TIMESERIES day WITH TOTALS.
 */
function splitTotalsAndTimeseries(rows) {
  if (!Array.isArray(rows)) return { totalsRow: null, timeseriesRows: [] };
  const totalsRow = rows.find((r) => r.day == null || r.day === '') ?? null;
  const timeseriesRows = rows.filter((r) => r.day != null && r.day !== '');
  return { totalsRow, timeseriesRows };
}

/**
 * Recupera le metriche Shopify tramite ShopifyQL / Shopify Reports.
 *
 * Usa una singola query TIMESERIES day WITH TOTALS che restituisce:
 *   - riga TOTALS (day=null): valori aggregati del periodo → usati per le card
 *   - righe day:              serie giornaliera → usata per le sparkline
 *
 * Campi ShopifyQL (Admin GraphQL 2026-01):
 *   returns            → shopify_returns    (campo ufficiale; usa il minQuery core se Column Not Found)
 *   shipping_charges   → shopify_shipping
 *   net_items_sold     → shopify_units_sold (solo fullQuery)
 *   returning_customer_rate → shopify_returning_customers (solo fullQuery)
 *
 * Se fullQuery lancia SHOPIFY_QL_PARSE_ERROR → retry con minQuery (campi core only).
 * Se minQuery riesce → hasReturns=false, hasShipping=false, hasNetItemsSold=false ecc.
 * Se anche minQuery fallisce → errore propagato (nessun fallback order-based da qui).
 *
 * @returns {{
 *   totalsRow:                object | null,
 *   timeseriesRows:           object[],
 *   hasNetItemsSold:          boolean,
 *   hasAverageOrderValue:     boolean,
 *   hasReturningCustomerRate: boolean,
 *   hasReturns:               boolean,
 *   hasShipping:              boolean,
 *   diagnostics:              object,
 *   meta:                     { startDate: Date, endDate: Date, fetchedAt: Date }
 * }}
 */
export async function fetchShopifySalesReportQL({ clientId, startDate, endDate }) {
  const { shop, accessToken } = await resolveShopifyIntegration(clientId);

  const since = formatShopifyQLDate(startDate);
  const until  = formatShopifyQLDate(endDate);

  // fullQuery: tutti i campi inclusi quelli opzionali.
  // minQuery: solo i 6 campi core universalmente disponibili — nessun campo
  // che possa causare Column Not Found (no returns, no shipping_charges).
  const fullQuery = `FROM sales SHOW total_sales, orders, average_order_value, gross_sales, discounts, returns, net_sales, shipping_charges, taxes, net_items_sold, returning_customer_rate TIMESERIES day WITH TOTALS, CURRENCY 'EUR' SINCE ${since} UNTIL ${until} ORDER BY day ASC LIMIT 1000`;
  const minQuery  = `FROM sales SHOW total_sales, orders, gross_sales, discounts, net_sales, taxes TIMESERIES day WITH TOTALS, CURRENCY 'EUR' SINCE ${since} UNTIL ${until} ORDER BY day ASC LIMIT 1000`;

  let allRows                        = null;
  let hasNetItemsSold                = false;
  let hasAverageOrderValue           = false;
  let hasReturningCustomerRate       = false;
  let hasReturns                     = false;
  let hasShipping                    = false;
  let shopifyqlQueryType             = 'sales_timeseries_full';
  let shopifyqlMinimalQueryAttempted = false;

  try {
    allRows                  = await executeShopifyQLQuery(shop, accessToken, fullQuery, 'sales_timeseries_full');
    hasNetItemsSold          = true;
    hasAverageOrderValue     = true;
    hasReturningCustomerRate = true;
    hasReturns               = true;
    hasShipping              = true;
  } catch (fullErr) {
    if (fullErr.code === 'SHOPIFY_QL_PARSE_ERROR') {
      shopifyqlMinimalQueryAttempted = true;
      shopifyqlQueryType = 'sales_timeseries_minimal';
      // minQuery non contiene campi opzionali → non può fallire per Column Not Found
      allRows = await executeShopifyQLQuery(shop, accessToken, minQuery, 'sales_timeseries_minimal');
      // tutti i campi opzionali unavailable → not_available nelle card
    } else {
      throw fullErr;
    }
  }

  const { totalsRow, timeseriesRows } = splitTotalsAndTimeseries(allRows);

  const shopifyqlRawTableShape = {
    hasTableData:       allRows !== null,
    hasColumns:         Array.isArray(allRows) && allRows.length > 0,
    hasRows:            Array.isArray(allRows) && allRows.length > 0,
    rowCount:           Array.isArray(allRows) ? allRows.length : 0,
    hasTotalsRow:       totalsRow !== null,
    timeseriesRowCount: timeseriesRows.length,
  };

  return {
    totalsRow,
    timeseriesRows,
    hasNetItemsSold,
    hasAverageOrderValue,
    hasReturningCustomerRate,
    hasReturns,
    hasShipping,
    diagnostics: {
      shopifyqlAttempted:             true,
      shopifyqlFullQueryAttempted:    true,
      shopifyqlMinimalQueryAttempted,
      shopifyqlQueryType,
      shopifyqlRawTableShape,
    },
    meta: { startDate, endDate, fetchedAt: new Date() },
  };
}

/**
 * Recupera gli scope realmente concessi al token Shopify installato.
 * Usato per diagnostica — non espone token né dati sensibili.
 * Ritorna null in caso di errore (best-effort).
 *
 * @param {string} clientId
 * @returns {Promise<string[] | null>}
 */
export async function fetchShopifyGrantedScopes(clientId) {
  try {
    const { shop, accessToken } = await resolveShopifyIntegration(clientId);
    const url = buildShopifyGraphQLUrl(shop);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SHOPIFY.FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url, {
        method:  'POST',
        headers: buildShopifyHeaders(accessToken),
        body:    JSON.stringify({ query: `{ appInstallation { accessScopes { handle } } }` }),
        signal:  controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    const scopes = body?.data?.appInstallation?.accessScopes;
    if (!Array.isArray(scopes)) return null;
    return scopes.map((s) => s?.handle).filter(Boolean);
  } catch {
    return null;
  }
}

// ── Admin API (ordini) ────────────────────────────────────────────────────────

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
    // Task 3: prova prima con la query completa; se Shopify nega l'accesso per
    // scope insufficienti, riprova con la query minimale compatibile read_orders.
    let fetchedData;
    let isPartialData = false;

    try {
      fetchedData = await fetchAllOrders(shop, accessToken, { startDate, endDate }, ORDERS_GRAPHQL_QUERY);
    } catch (scopeErr) {
      if (scopeErr instanceof AppError && scopeErr.code === 'SHOPIFY_SCOPE_OR_ACCESS_DENIED') {
        fetchedData   = await fetchAllOrders(shop, accessToken, { startDate, endDate }, ORDERS_GRAPHQL_QUERY_MINIMAL);
        isPartialData = true;
      } else {
        throw scopeErr;
      }
    }

    const {
      orders,
      pagesFetched,
      truncated,
      lineItemsTruncated,
      refundItemsTruncated,
      refundTransactionsTruncated,
    } = fetchedData;

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
        // isPartialData: true quando il fallback query minimale è stato usato.
        // customer, refunds, transactions e orderAdjustments non sono disponibili.
        isPartialData,
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
