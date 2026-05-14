// Computazione sincrona pura: nessuna chiamata DB, nessun async, nessun side effect.
// Accetta l'output diretto di fetchRawShopifyData e restituisce un risultato KPI
// pronto per il backend. Non produce stringhe formattate per UI né valori formattati come valuta.

import { normalizeOrders } from './shopify.normalize.service.js';
import { compareNumericSummaries } from '../../utils/comparison.js';
import { toAppDateString } from '../../utils/ranges.js';
import { buildDailyDateKeys } from '../../utils/sparkline.js';
import {
  SHOPIFY_KPI_DEFINITIONS,
  SHOPIFY_KPI_KEYS,
} from '../../contracts/metrics/shopify.kpi.map.js';

export const SHOPIFY_COMPARISON_KEYS = Object.freeze([
  ...SHOPIFY_KPI_DEFINITIONS.map((definition) => definition.internalKey),
  ...SHOPIFY_KPI_DEFINITIONS.map((definition) => definition.legacyKey).filter(Boolean),
]);

// KPI che richiedono dati non presenti nella query minimale (customer, refunds, transactions).
// Quando isPartialData=true questi vengono omessi dal summary e dalla seriesByMetricKey
// così il card builder li marca `availability.status: not_available` anziché mostrarli a 0.
const PARTIAL_DATA_UNAVAILABLE_KEYS = Object.freeze(new Set([
  SHOPIFY_KPI_KEYS.returns,
  SHOPIFY_KPI_KEYS.refundedAmount,
  SHOPIFY_KPI_KEYS.newCustomers,
  SHOPIFY_KPI_KEYS.returningCustomers,
  SHOPIFY_KPI_KEYS.newCustomerOrders,
  SHOPIFY_KPI_KEYS.returningCustomerOrders,
]));

// ── Helper ────────────────────────────────────────────────────────────────────

/** Arrotonda un numero a 2 decimali (precisione monetaria). */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Somma un accessor numerico su un array di ordini normalizzati. */
function sumField(orders, accessor) {
  return orders.reduce((total, order) => total + accessor(order), 0);
}

function withLegacyAliases(officialSummary) {
  // Non aggiungere alias per chiavi omesse dal summary (evita `key: undefined`)
  const aliases = Object.fromEntries(
    SHOPIFY_KPI_DEFINITIONS
      .filter((definition) => definition.legacyKey)
      .map((definition) => [
        definition.legacyKey,
        officialSummary[definition.internalKey],
      ])
      .filter(([, value]) => value !== undefined)
  );

  return {
    ...officialSummary,
    ...aliases,
    order_revenue: officialSummary[SHOPIFY_KPI_KEYS.totalSales],
  };
}

/**
 * Risolve la valuta singola per il risultato, oppure segnala valute miste.
 *
 * Se tutti gli ordini condividono lo stesso codice valuta, quel codice viene restituito.
 * Se gli ordini coprono più valute (es. store multi-valuta), currency viene
 * impostato a null e mixedCurrency a true. Tutte le somme KPI vengono comunque calcolate,
 * ma i chiamanti devono trattare i valori monetari come non affidabili quando mixedCurrency è true.
 *
 * Gli ordini senza campo currency sono esclusi dalla risoluzione valuta
 * ma inclusi in tutti i calcoli KPI.
 */
function resolveCurrency(normalizedOrders) {
  const codes = new Set(
    normalizedOrders.map((o) => o.currency).filter((c) => c != null)
  );
  if (codes.size === 0)  return { currency: null,          mixedCurrency: false };
  if (codes.size === 1)  return { currency: [...codes][0], mixedCurrency: false };
  return                        { currency: null,          mixedCurrency: true  };
}

// Usa processedAt per il bucketing temporale: rappresenta quando l'ordine è stato
// effettivamente processato e corrisponde al filtro usato in fetchRawShopifyData.
// createdAt rimane disponibile nel NormalizedOrder come riferimento ma non viene
// usato per aggregazioni.
function orderDateKey(order) {
  if (!order?.processedAt) return null;

  try {
    return toAppDateString(order.processedAt);
  } catch {
    return null;
  }
}

function createDailyBucket(date) {
  return {
    date,
    grossSales: 0,
    discounts: 0,
    returnsAmount: 0,
    shipping: 0,
    taxes: 0,
    duties: 0,
    additionalFees: 0,
    orders: 0,
    unitsSold: 0,
    refundedAmount: 0,
    newCustomerIds: new Set(),
    returningCustomerIds: new Set(),
    newCustomerOrders: 0,
    returningCustomerOrders: 0,
  };
}

function point(date, value) {
  return {
    date,
    value: Number.isFinite(value) ? round2(value) : null,
  };
}

function buildShopifySeriesByMetricKey(orders, fetchMeta = {}) {
  const dateKeys = buildDailyDateKeys(fetchMeta.startDate, fetchMeta.endDate);
  const buckets = new Map(dateKeys.map((date) => [date, createDailyBucket(date)]));

  for (const order of orders) {
    const date = orderDateKey(order);
    if (!date) continue;

    const bucket = buckets.get(date) ?? createDailyBucket(date);
    bucket.grossSales += order.grossSales;
    bucket.discounts += order.totalDiscounts;
    bucket.returnsAmount += order.returnsAmount;
    bucket.shipping += order.shipping;
    bucket.taxes += order.totalTax;
    bucket.duties += order.duties;
    bucket.additionalFees += order.additionalFees;
    bucket.orders += 1;
    bucket.unitsSold += order.unitsSold;
    bucket.refundedAmount += order.refundedAmount;

    if (order.isReturningCustomer === false) {
      bucket.newCustomerOrders += 1;
      if (order.customerId != null) bucket.newCustomerIds.add(order.customerId);
    } else if (order.isReturningCustomer === true) {
      bucket.returningCustomerOrders += 1;
      if (order.customerId != null) bucket.returningCustomerIds.add(order.customerId);
    }

    buckets.set(date, bucket);
  }

  const sortedBuckets = [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));

  function netSales(bucket) {
    return bucket.grossSales - bucket.discounts - bucket.returnsAmount;
  }

  function totalSales(bucket) {
    return netSales(bucket) + bucket.shipping + bucket.taxes + bucket.duties + bucket.additionalFees;
  }

  function averageOrderValue(bucket) {
    return bucket.orders > 0 ? (bucket.grossSales - bucket.discounts) / bucket.orders : 0;
  }

  return {
    [SHOPIFY_KPI_KEYS.totalSales]: sortedBuckets.map((b) => point(b.date, totalSales(b))),
    [SHOPIFY_KPI_KEYS.orders]: sortedBuckets.map((b) => point(b.date, b.orders)),
    [SHOPIFY_KPI_KEYS.averageOrderValue]: sortedBuckets.map((b) =>
      point(b.date, averageOrderValue(b))
    ),
    [SHOPIFY_KPI_KEYS.grossSales]: sortedBuckets.map((b) => point(b.date, b.grossSales)),
    [SHOPIFY_KPI_KEYS.discounts]: sortedBuckets.map((b) => point(b.date, b.discounts)),
    [SHOPIFY_KPI_KEYS.returns]: sortedBuckets.map((b) => point(b.date, b.returnsAmount)),
    [SHOPIFY_KPI_KEYS.netSales]: sortedBuckets.map((b) => point(b.date, netSales(b))),
    [SHOPIFY_KPI_KEYS.shipping]: sortedBuckets.map((b) => point(b.date, b.shipping)),
    [SHOPIFY_KPI_KEYS.taxes]: sortedBuckets.map((b) => point(b.date, b.taxes)),
    [SHOPIFY_KPI_KEYS.unitsSold]: sortedBuckets.map((b) => point(b.date, b.unitsSold)),
    [SHOPIFY_KPI_KEYS.newCustomers]: sortedBuckets.map((b) =>
      point(b.date, b.newCustomerIds.size)
    ),
    [SHOPIFY_KPI_KEYS.returningCustomers]: sortedBuckets.map((b) =>
      point(b.date, b.returningCustomerIds.size)
    ),
    [SHOPIFY_KPI_KEYS.newCustomerOrders]: sortedBuckets.map((b) =>
      point(b.date, b.newCustomerOrders)
    ),
    [SHOPIFY_KPI_KEYS.returningCustomerOrders]: sortedBuckets.map((b) =>
      point(b.date, b.returningCustomerOrders)
    ),
    [SHOPIFY_KPI_KEYS.refundedAmount]: sortedBuckets.map((b) => point(b.date, b.refundedAmount)),
  };
}

// ── API pubblica ──────────────────────────────────────────────────────────────

/**
 * Calcola i KPI Shopify dal risultato fetch grezzo prodotto da fetchRawShopifyData.
 *
 * Normalizza internamente gli ordini tramite shopify.normalize.service.js:
 * i chiamanti non devono pre-normalizzare.
 *
 * ── Formule KPI ──────────────────────────────────────────────────────────────
 *
 * shopify_orders            Conteggio di tutti gli ordini nel range date (status: any).
 *
 * shopify_units_sold        Somma delle quantita line item su tutti gli ordini.
 *
 * shopify_gross_sales       Somma di total_line_items_price (totale linee pre-sconto).
 *                           Rappresenta il valore venduto dei prodotti senza sconto.
 *
 * shopify_discounts         Somma di total_discounts su tutti gli ordini.
 *
 * shopify_returns           Somma del valore line item rimborsato da refunds.
 *
 * shopify_net_sales         Gross sales - Discounts - Returns.
 *
 * shopify_shipping          Shipping charges - discounts - refunded shipping.
 *
 * shopify_taxes             Somma di total_tax su tutti gli ordini.
 *
 * shopify_total_sales       Net sales + Shipping + Taxes, con Duties e Additional fees
 *                           inclusi solo se disponibili nei dati ordine recuperati.
 *
 * shopify_average_order_value (Gross sales - Discounts) / Orders.
 *                           Formula ufficiale Shopify per AOV; esclude gli aggiustamenti
 *                           post-ordine come edit, exchange e returns.
 *
 * shopify_new_customer_orders Conteggio ordini dove isReturningCustomer === false
 *                           (customer.orders_count === 1 al momento della chiamata API).
 *
 * shopify_returning_customer_orders Conteggio ordini dove isReturningCustomer === true
 *                           (customer.orders_count > 1).
 *
 * shopify_new_customers     ID customer distinti tra gli ordini di nuovi clienti.
 *                           Gli ordini guest checkout (senza customer ID) sono esclusi.
 *
 * shopify_returning_customers ID customer distinti tra gli ordini di clienti ricorrenti.
 *                           Gli ordini guest checkout (senza customer ID) sono esclusi.
 *
 * shopify_refunded_amount   Somma delle transazioni refund riuscite nei refunds ordine.
 *
 * ── Caveat sui segmenti cliente ──────────────────────────────────────────────
 *
 * I KPI di segmento cliente (new_customer_orders, returning_customer_orders,
 * new_customer_revenue, returning_customer_revenue, new_customers,
 * returning_customers) sono PROXY basati su customer.orders_count al momento
 * della chiamata API, non attribuzione storica per ordine. Un cliente che era nuovo
 * al momento dell'ordine ma ha riordinato in seguito mostrerà orders_count > 1 e
 * apparirà come "returning" per tutti i suoi ordini storici. È un vincolo
 * intrinseco dell'API Shopify.
 * meta.customerSegmentAttributionMode === 'current_orders_count_proxy'
 * segnala questa limitazione ai consumer.
 *
 * isReturningCustomer è null quando:
 *   - L'ordine è un guest checkout (nessun oggetto customer)
 *   - customer.orders_count è mancante o non valido
 *
 * Questi ordini contribuiscono ai KPI finanziari totali ma non ai breakdown
 * per segmento cliente. Il conteggio è esposto in meta.unknownCustomerSegmentCount
 * così i chiamanti possono valutare l'affidabilità dello split per segmento.
 *
 * @param {object} fetchResult  Risultato diretto di fetchRawShopifyData
 * @param {object[]} fetchResult.orders  Oggetti ordine Shopify grezzi
 * @param {object}   fetchResult.meta    Metadati fetch (range, date, truncated, ecc.)
 *
 * @returns {{
 *   summary: {
 *     shopify_gross_sales:               number,
 *     shopify_discounts:                 number,
 *     shopify_returns:                   number,
 *     shopify_net_sales:                 number,
 *     shopify_shipping:                  number,
 *     shopify_taxes:                     number,
 *     shopify_total_sales:               number,
 *     shopify_orders:                    number,
 *     shopify_average_order_value:       number,
 *     shopify_units_sold:                number,
 *     shopify_new_customers:             number,
 *     shopify_returning_customers:       number,
 *     shopify_new_customer_orders:       number,
 *     shopify_returning_customer_orders: number,
 *     shopify_refunded_amount:           number,
 *   },
 *   meta: {
 *     currency:                    string | null,
 *     mixedCurrency:               boolean,
 *     orderCount:                  number,
 *     range:                       string,
 *     startDate:                   Date,
 *     endDate:                     Date,
 *     fetchedAt:                   Date | null,
 *     truncated:                   boolean,
 *     pagesFetched:                number,
 *     hasUnknownCustomerSegments:  boolean,
 *     unknownCustomerSegmentCount: number,
 *     customerSegmentAttributionMode: string,
 *   }
 * }}
 */
export function computeShopifyKpis(fetchResult) {
  const { orders: rawOrders, meta: fetchMeta } = fetchResult;

  const orders = normalizeOrders(rawOrders);

  // ── Risoluzione valuta ────────────────────────────────────────────────────

  const { currency, mixedCurrency } = resolveCurrency(orders);

  // ── Split segmento cliente ────────────────────────────────────────────────

  const unknownSegment   = orders.filter((o) => o.isReturningCustomer === null);
  const newOrders        = orders.filter((o) => o.isReturningCustomer === false);
  const returningOrders  = orders.filter((o) => o.isReturningCustomer === true);

  // ID customer distinti: guest checkout (customerId === null) esclusi.
  const newCustomerIds = new Set(
    newOrders.map((o) => o.customerId).filter((id) => id != null)
  );
  const returningCustomerIds = new Set(
    returningOrders.map((o) => o.customerId).filter((id) => id != null)
  );

  // ── Aggregati finanziari ──────────────────────────────────────────────────

  const orderCount   = orders.length;
  const grossSales      = sumField(orders, (o) => o.grossSales);
  const discounts       = sumField(orders, (o) => o.totalDiscounts);
  const returnsAmount   = sumField(orders, (o) => o.returnsAmount);
  const netSales        = grossSales - discounts - returnsAmount;
  const shipping        = sumField(orders, (o) => o.shipping);
  const taxes           = sumField(orders, (o) => o.totalTax);
  const duties          = sumField(orders, (o) => o.duties);
  const additionalFees  = sumField(orders, (o) => o.additionalFees);
  const totalSales      = netSales + shipping + taxes + duties + additionalFees;
  const unitsSold       = sumField(orders, (o) => o.unitsSold);
  const refundedAmount  = sumField(orders, (o) => o.refundedAmount);

  const averageOrderValue = orderCount > 0 ? (grossSales - discounts) / orderCount : 0;

  // ── Risultato ─────────────────────────────────────────────────────────────
  // Quando isPartialData=true i KPI che dipendono da customer/refunds/transactions
  // vengono omessi: il card builder li marca `availability.status: not_available`
  // anziché mostrare 0 come dato reale.
  const officialSummary = {
    [SHOPIFY_KPI_KEYS.grossSales]:        round2(grossSales),
    [SHOPIFY_KPI_KEYS.discounts]:         round2(discounts),
    [SHOPIFY_KPI_KEYS.netSales]:          round2(netSales),
    [SHOPIFY_KPI_KEYS.shipping]:          round2(shipping),
    [SHOPIFY_KPI_KEYS.taxes]:             round2(taxes),
    [SHOPIFY_KPI_KEYS.totalSales]:        round2(totalSales),
    [SHOPIFY_KPI_KEYS.orders]:            orderCount,
    [SHOPIFY_KPI_KEYS.averageOrderValue]: round2(averageOrderValue),
    [SHOPIFY_KPI_KEYS.unitsSold]:         unitsSold,
    ...(fetchMeta.isPartialData ? {} : {
      [SHOPIFY_KPI_KEYS.returns]:                 round2(returnsAmount),
      [SHOPIFY_KPI_KEYS.newCustomers]:            newCustomerIds.size,
      [SHOPIFY_KPI_KEYS.returningCustomers]:      returningCustomerIds.size,
      [SHOPIFY_KPI_KEYS.newCustomerOrders]:       newOrders.length,
      [SHOPIFY_KPI_KEYS.returningCustomerOrders]: returningOrders.length,
      [SHOPIFY_KPI_KEYS.refundedAmount]:          round2(refundedAmount),
    }),
  };

  const allSeries = buildShopifySeriesByMetricKey(orders, fetchMeta);
  const seriesByMetricKey = fetchMeta.isPartialData
    ? Object.fromEntries(
        Object.entries(allSeries).filter(([key]) => !PARTIAL_DATA_UNAVAILABLE_KEYS.has(key))
      )
    : allSeries;

  return {
    summary: withLegacyAliases(officialSummary),
    seriesByMetricKey,
    meta: {
      currency,
      mixedCurrency,
      orderCount,
      apiSource: 'calculated_from_orders',
      range:                       fetchMeta.range,
      startDate:                   fetchMeta.startDate,
      endDate:                     fetchMeta.endDate,
      fetchedAt:                   fetchMeta.fetchedAt ?? null,
      truncated:                   fetchMeta.truncated ?? false,
      pagesFetched:                fetchMeta.pagesFetched ?? null,
      // true se almeno un ordine aveva >250 line items: unitsSold può essere parziale.
      lineItemsTruncated:              fetchMeta.lineItemsTruncated           ?? false,
      // true se almeno un ordine aveva >250 refund line items: refundedUnits/returnsAmount
      // possono essere parziali.
      refundItemsTruncated:            fetchMeta.refundItemsTruncated         ?? false,
      // true se almeno un rimborso aveva >50 transazioni: refundedAmount può essere parziale.
      refundTransactionsTruncated:     fetchMeta.refundTransactionsTruncated  ?? false,
      // true quando è stata usata la query minimale: customer/refunds/transactions non disponibili.
      isPartialData:               fetchMeta.isPartialData                ?? false,
      hasUnknownCustomerSegments:  unknownSegment.length > 0,
      unknownCustomerSegmentCount: unknownSegment.length,
      customerSegmentAttributionMode: 'current_orders_count_proxy',
    },
  };
}

export function compareShopifyKpis(currentSummary, previousSummary) {
  return compareNumericSummaries(
    currentSummary,
    previousSummary,
    SHOPIFY_COMPARISON_KEYS
  );
}

// ── ShopifyQL path ────────────────────────────────────────────────────────────
//
// Queste funzioni processano il risultato di fetchShopifySalesReportQL e
// producono lo stesso contratto di computeShopifyKpis:
//   { summary, seriesByMetricKey, meta }
//
// Differenze rispetto al path Admin API:
//   - meta.apiSource === 'shopifyql_report'
//   - meta.isOrderBasedFallback === false
//   - refundedAmount non è presente in summary (ShopifyQL non espone il dato
//     come importo cash rimborsato → not_available, card mostra N/D)
//   - unitsSold usa net_quantity da ShopifyQL (netto resi) se disponibile
//   - currency null → il card builder usa CURRENCY_DEFAULT

function parseQLDecimal(value) {
  if (value == null || value === '') return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function parseQLInt(value) {
  if (value == null || value === '') return null;
  const n = parseInt(value, 10);
  return Number.isInteger(n) ? n : null;
}

function buildShopifyQLSeriesByMetricKey(timeseriesRows) {
  if (!Array.isArray(timeseriesRows) || timeseriesRows.length === 0) return {};

  const series = {
    [SHOPIFY_KPI_KEYS.totalSales]: [],
    [SHOPIFY_KPI_KEYS.grossSales]: [],
    [SHOPIFY_KPI_KEYS.discounts]:  [],
    [SHOPIFY_KPI_KEYS.returns]:    [],
    [SHOPIFY_KPI_KEYS.netSales]:   [],
    [SHOPIFY_KPI_KEYS.shipping]:   [],
    [SHOPIFY_KPI_KEYS.taxes]:      [],
    [SHOPIFY_KPI_KEYS.orders]:     [],
  };

  for (const row of timeseriesRows) {
    // TIMESERIES day produce una colonna 'day' con formato YYYY-MM-DD
    const date = row.day ? String(row.day).slice(0, 10) : null;
    if (!date) continue;

    const push = (key, rawVal, parser) => {
      const v = parser(rawVal);
      if (v != null) series[key].push({ date, value: round2(v) });
    };

    push(SHOPIFY_KPI_KEYS.totalSales, row.total_sales, parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.grossSales, row.gross_sales, parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.discounts,  row.discounts,   parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.returns,    row.returns,     parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.netSales,   row.net_sales,   parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.shipping,   row.shipping,    parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.taxes,      row.taxes,       parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.orders,     row.orders,      parseQLInt);
  }

  // Ordina per data e rimuove chiavi con serie vuote
  for (const key of Object.keys(series)) {
    series[key].sort((a, b) => a.date.localeCompare(b.date));
    if (series[key].length === 0) delete series[key];
  }

  return series;
}

/**
 * Calcola i KPI Shopify dal risultato di fetchShopifySalesReportQL.
 *
 * Produce lo stesso contratto di computeShopifyKpis:
 *   { summary, seriesByMetricKey, meta }
 *
 * Metriche con fonte ShopifyQL diretta:
 *   total_sales, gross_sales, discounts, returns, net_sales, shipping,
 *   taxes, orders, average_order_value (formula fallback se non esposta),
 *   net_quantity → units_sold (se disponibile), new/returning customer
 *   metrics (se customer_type disponibile).
 *
 * Metriche not_available (omesse da summary):
 *   refunded_amount — l'importo cash rimborsato non è in FROM sales.
 *   units_sold      — se net_quantity non era supportato da ShopifyQL.
 *   customer metrics — se customer_type non disponibile (parse error).
 *
 * @param {object} qlResult  Risultato di fetchShopifySalesReportQL
 * @param {object} params    { range, startDate, endDate }
 */
export function computeShopifyKpisFromQL(qlResult, { range, startDate, endDate }) {
  const {
    aggregateRows,
    customerTypeRows,
    customerTypeError,
    timeseriesRows,
    hasUnitsSold,
    hasAverageOrderValue,
    meta: fetchMeta,
  } = qlResult;

  const agg = Array.isArray(aggregateRows) && aggregateRows.length > 0 ? aggregateRows[0] : null;
  if (!agg) {
    throw Object.assign(
      new Error('ShopifyQL ha restituito dati aggregati vuoti.'),
      { code: 'SHOPIFY_API_ERROR', statusCode: 502 }
    );
  }

  // ── Metriche aggregate ────────────────────────────────────────────────────

  const grossSales = parseQLDecimal(agg.gross_sales) ?? 0;
  const discounts  = parseQLDecimal(agg.discounts)   ?? 0;
  const returns    = parseQLDecimal(agg.returns)     ?? 0;
  const netSales   = parseQLDecimal(agg.net_sales)   ?? (grossSales - discounts - returns);
  const shipping   = parseQLDecimal(agg.shipping)    ?? 0;
  const taxes      = parseQLDecimal(agg.taxes)       ?? 0;
  const totalSales = parseQLDecimal(agg.total_sales) ?? (netSales + shipping + taxes);
  const orders     = parseQLInt(agg.orders)          ?? 0;

  // AOV: usa il valore QL se disponibile.
  // Se ShopifyQL non espone average_order_value, NON calcolare con formula approssimata:
  // Shopify usa "gross sales excluding adjustments" che non coincide con gross_sales
  // aggregato in tutti i casi. averageOrderValue null → omesso da summary → not_available.
  let averageOrderValue = null;
  if (hasAverageOrderValue && agg.average_order_value != null) {
    averageOrderValue = parseQLDecimal(agg.average_order_value);
  }

  // units_sold: usa il campo units_sold da ShopifyQL (prima scelta documentata).
  // Se non disponibile (parse error nella query full → retry minimal), not_available.
  let unitsSold = null;
  if (hasUnitsSold && agg.units_sold != null) {
    unitsSold = parseQLInt(agg.units_sold);
  }

  // ── Customer type ─────────────────────────────────────────────────────────
  // GROUP BY customer_type restituisce 'first_time' e 'returning'.

  let newCustomers            = undefined;
  let returningCustomers      = undefined;
  let newCustomerOrders       = undefined;
  let returningCustomerOrders = undefined;

  if (Array.isArray(customerTypeRows) && customerTypeRows.length > 0) {
    for (const row of customerTypeRows) {
      const ct = String(row.customer_type ?? '').toLowerCase();
      if (ct === 'first_time') {
        newCustomerOrders = parseQLInt(row.orders)    ?? 0;
        newCustomers      = parseQLInt(row.customers) ?? 0;
      } else if (ct === 'returning') {
        returningCustomerOrders = parseQLInt(row.orders)    ?? 0;
        returningCustomers      = parseQLInt(row.customers) ?? 0;
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  // refundedAmount omesso: non esiste in FROM sales come importo cash.
  // unitsSold omesso se units_sold non era supportato dalla query QL.
  // Customer metrics omesse se la query customer_type non è disponibile.

  const officialSummary = {
    [SHOPIFY_KPI_KEYS.totalSales]:        round2(totalSales),
    [SHOPIFY_KPI_KEYS.grossSales]:        round2(grossSales),
    [SHOPIFY_KPI_KEYS.discounts]:         round2(discounts),
    [SHOPIFY_KPI_KEYS.returns]:           round2(returns),
    [SHOPIFY_KPI_KEYS.netSales]:          round2(netSales),
    [SHOPIFY_KPI_KEYS.shipping]:          round2(shipping),
    [SHOPIFY_KPI_KEYS.taxes]:             round2(taxes),
    [SHOPIFY_KPI_KEYS.orders]:            orders,
    ...(averageOrderValue != null ? { [SHOPIFY_KPI_KEYS.averageOrderValue]: round2(averageOrderValue) } : {}),
    ...(unitsSold != null ? { [SHOPIFY_KPI_KEYS.unitsSold]: unitsSold } : {}),
    ...(newCustomers != null            ? { [SHOPIFY_KPI_KEYS.newCustomers]: newCustomers }                       : {}),
    ...(returningCustomers != null      ? { [SHOPIFY_KPI_KEYS.returningCustomers]: returningCustomers }           : {}),
    ...(newCustomerOrders != null       ? { [SHOPIFY_KPI_KEYS.newCustomerOrders]: newCustomerOrders }             : {}),
    ...(returningCustomerOrders != null ? { [SHOPIFY_KPI_KEYS.returningCustomerOrders]: returningCustomerOrders } : {}),
    // shopify_refunded_amount: non incluso → card builder lo marca not_available
  };

  const seriesByMetricKey = buildShopifyQLSeriesByMetricKey(timeseriesRows);

  const hasCustomerType    = Array.isArray(customerTypeRows) && customerTypeRows.length > 0;
  const hasTimeseries      = Array.isArray(timeseriesRows)   && timeseriesRows.length   > 0;
  // customerTypeUnavailable: true solo se la query ha fallito con errore.
  // false se ha funzionato (anche con zero righe).
  const customerTypeUnavailable = Boolean(customerTypeError);

  return {
    summary: withLegacyAliases(officialSummary),
    seriesByMetricKey,
    meta: {
      currency:     null,
      mixedCurrency: false,
      orderCount:   orders,
      apiSource:    'shopifyql_report',
      range,
      startDate,
      endDate,
      fetchedAt:               fetchMeta?.fetchedAt ?? null,
      truncated:               false,
      pagesFetched:            null,
      isPartialData:           false,
      isOrderBasedFallback:    false,
      shopifyqlAvailable:      true,
      hasUnitsSoldFromQL:      hasUnitsSold,
      hasAverageOrderValueFromQL: hasAverageOrderValue,
      hasCustomerTypeFromQL:   hasCustomerType,
      customerTypeUnavailable,
      hasTimeseriesFromQL:     hasTimeseries,
      // refundedAmount non disponibile da ShopifyQL:
      // il card builder lo marca not_available perché la chiave è assente da summary.
      refundedAmountSource:    'not_available',
    },
  };
}
