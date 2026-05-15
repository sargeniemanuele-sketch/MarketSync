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
  SHOPIFY_KPI_SCHEMA_VERSION,
} from '../../contracts/metrics/shopify.kpi.map.js';

export const SHOPIFY_COMPARISON_KEYS = Object.freeze([
  ...SHOPIFY_KPI_DEFINITIONS.map((definition) => definition.internalKey),
  ...SHOPIFY_KPI_DEFINITIONS.map((definition) => definition.legacyKey).filter(Boolean),
]);

// KPI che richiedono dati non presenti nella query minimale (customer, refunds).
// Quando isPartialData=true vengono omessi → card builder li marca not_available.
const PARTIAL_DATA_UNAVAILABLE_KEYS = Object.freeze(new Set([
  SHOPIFY_KPI_KEYS.returns,
  SHOPIFY_KPI_KEYS.newCustomers,
  SHOPIFY_KPI_KEYS.returningCustomers,
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

    if (order.isReturningCustomer === false) {
      bucket.newCustomerOrders += 1;
    } else if (order.isReturningCustomer === true) {
      bucket.returningCustomerOrders += 1;
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

  // Approssimazione order-based: rate calcolata sugli ordini con customer noto.
  function returningCustomerRate(bucket) {
    const known = bucket.newCustomerOrders + bucket.returningCustomerOrders;
    return known > 0 ? (bucket.returningCustomerOrders / known) * 100 : null;
  }

  function newCustomerRate(bucket) {
    const rate = returningCustomerRate(bucket);
    return rate != null ? 100 - rate : null;
  }

  return {
    [SHOPIFY_KPI_KEYS.totalSales]:        sortedBuckets.map((b) => point(b.date, totalSales(b))),
    [SHOPIFY_KPI_KEYS.orders]:            sortedBuckets.map((b) => point(b.date, b.orders)),
    [SHOPIFY_KPI_KEYS.averageOrderValue]: sortedBuckets.map((b) => point(b.date, averageOrderValue(b))),
    [SHOPIFY_KPI_KEYS.grossSales]:        sortedBuckets.map((b) => point(b.date, b.grossSales)),
    [SHOPIFY_KPI_KEYS.discounts]:         sortedBuckets.map((b) => point(b.date, b.discounts)),
    [SHOPIFY_KPI_KEYS.returns]:           sortedBuckets.map((b) => point(b.date, b.returnsAmount)),
    [SHOPIFY_KPI_KEYS.netSales]:          sortedBuckets.map((b) => point(b.date, netSales(b))),
    [SHOPIFY_KPI_KEYS.shipping]:          sortedBuckets.map((b) => point(b.date, b.shipping)),
    [SHOPIFY_KPI_KEYS.taxes]:             sortedBuckets.map((b) => point(b.date, b.taxes)),
    [SHOPIFY_KPI_KEYS.unitsSold]:         sortedBuckets.map((b) => point(b.date, b.unitsSold)),
    [SHOPIFY_KPI_KEYS.returningCustomers]: sortedBuckets.map((b) => point(b.date, returningCustomerRate(b))),
    [SHOPIFY_KPI_KEYS.newCustomers]:       sortedBuckets.map((b) => point(b.date, newCustomerRate(b))),
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
 * shopify_new_customers     Percentuale ordini da clienti first-time (approssimazione
 *                           order-based: new / (new+returning) × 100).
 *
 * shopify_returning_customers Percentuale ordini da clienti ricorrenti (approssimazione
 *                           order-based: returning / (new+returning) × 100).
 *
 * Nota: quando isPartialData=true (query minimale, no dati cliente) queste
 * metriche vengono omesse → card builder le marca not_available.
 *
 * @param {object} fetchResult  Risultato diretto di fetchRawShopifyData
 * @param {object[]} fetchResult.orders  Oggetti ordine Shopify grezzi
 * @param {object}   fetchResult.meta    Metadati fetch (range, date, truncated, ecc.)
 *
 * @returns {{
 *   summary: {
 *     shopify_gross_sales:           number,
 *     shopify_discounts:             number,
 *     shopify_returns:               number,
 *     shopify_net_sales:             number,
 *     shopify_shipping:              number,
 *     shopify_taxes:                 number,
 *     shopify_total_sales:           number,
 *     shopify_orders:                number,
 *     shopify_average_order_value:   number,
 *     shopify_units_sold:            number,
 *     shopify_new_customers:         number,
 *     shopify_returning_customers:   number,
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

  const unknownSegment  = orders.filter((o) => o.isReturningCustomer === null);
  const newOrders       = orders.filter((o) => o.isReturningCustomer === false);
  const returningOrders = orders.filter((o) => o.isReturningCustomer === true);

  // ── Aggregati finanziari ──────────────────────────────────────────────────

  const orderCount     = orders.length;
  const grossSales     = sumField(orders, (o) => o.grossSales);
  const discounts      = sumField(orders, (o) => o.totalDiscounts);
  const returnsAmount  = sumField(orders, (o) => o.returnsAmount);
  const netSales       = grossSales - discounts - returnsAmount;
  const shipping       = sumField(orders, (o) => o.shipping);
  const taxes          = sumField(orders, (o) => o.totalTax);
  const duties         = sumField(orders, (o) => o.duties);
  const additionalFees = sumField(orders, (o) => o.additionalFees);
  const totalSales     = netSales + shipping + taxes + duties + additionalFees;
  const unitsSold      = sumField(orders, (o) => o.unitsSold);

  const averageOrderValue = orderCount > 0 ? (grossSales - discounts) / orderCount : 0;

  // Approssimazione order-based per i customer rate (% su ordini con customer noto).
  const knownOrders = newOrders.length + returningOrders.length;
  const returningCustomersRate = knownOrders > 0
    ? round2((returningOrders.length / knownOrders) * 100)
    : 0;
  const newCustomersRate = round2(100 - returningCustomersRate);

  // ── Risultato ─────────────────────────────────────────────────────────────
  // Quando isPartialData=true i KPI che dipendono da customer/refunds vengono
  // omessi: il card builder li marca not_available anziché mostrare 0.
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
      [SHOPIFY_KPI_KEYS.returns]:            round2(returnsAmount),
      [SHOPIFY_KPI_KEYS.newCustomers]:       newCustomersRate,
      [SHOPIFY_KPI_KEYS.returningCustomers]: returningCustomersRate,
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
      apiSource:            'calculated_from_orders',
      isOrderBasedFallback: true,
      shopifyqlAvailable:   false,
      cacheSchemaVersion:   SHOPIFY_KPI_SCHEMA_VERSION,
      range:                fetchMeta.range,
      startDate:            fetchMeta.startDate,
      endDate:              fetchMeta.endDate,
      fetchedAt:            fetchMeta.fetchedAt ?? null,
      truncated:            fetchMeta.truncated ?? false,
      pagesFetched:         fetchMeta.pagesFetched ?? null,
      lineItemsTruncated:          fetchMeta.lineItemsTruncated          ?? false,
      refundItemsTruncated:        fetchMeta.refundItemsTruncated        ?? false,
      refundTransactionsTruncated: fetchMeta.refundTransactionsTruncated ?? false,
      isPartialData:               fetchMeta.isPartialData               ?? false,
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
//   - meta.apiSource === 'shopifyql'
//   - meta.isOrderBasedFallback === false
//   - unitsSold usa net_items_sold da ShopifyQL (netto resi) se disponibile
//   - newCustomers/returningCustomers sono percentuali da returning_customer_rate
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

    push(SHOPIFY_KPI_KEYS.totalSales, row.total_sales,      parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.grossSales, row.gross_sales,     parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.discounts,  row.discounts,       parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.returns,    row.returns,          parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.netSales,   row.net_sales,       parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.shipping,   row.shipping_charges, parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.taxes,      row.taxes,           parseQLDecimal);
    push(SHOPIFY_KPI_KEYS.orders,     row.orders,          parseQLInt);
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
 * Usa la riga TOTALS (day=null) per i valori aggregati del periodo.
 * Campi ShopifyQL: sales_reversals→returns, shipping_charges→shipping,
 *   net_items_sold→unitsSold, returning_customer_rate→returningCustomers %.
 *
 * Metriche not_available (omesse da summary):
 *   unitsSold    — se net_items_sold non era supportato (query minimal).
 *   customer rate — se returning_customer_rate non era supportato.
 *
 * @param {object} qlResult  Risultato di fetchShopifySalesReportQL
 * @param {object} params    { range, startDate, endDate }
 */
export function computeShopifyKpisFromQL(qlResult, { range, startDate, endDate }) {
  const {
    totalsRow,
    timeseriesRows,
    hasNetItemsSold,
    hasAverageOrderValue,
    hasReturningCustomerRate,
    hasReturns        = false,
    hasShipping       = false,
    diagnostics,
    meta: fetchMeta,
  } = qlResult;

  if (!totalsRow) {
    throw Object.assign(
      new Error('ShopifyQL ha restituito dati aggregati vuoti (nessuna riga TOTALS).'),
      { code: 'SHOPIFY_API_ERROR', statusCode: 502 }
    );
  }

  const agg = totalsRow;

  // ── Metriche aggregate ────────────────────────────────────────────────────
  // Campi core (sempre presenti, in fullQuery e minQuery):
  //   total_sales, orders, gross_sales, discounts, net_sales, taxes
  // Campi opzionali (solo in fullQuery; se la full fallisce → hasReturns/hasShipping=false):
  //   returns           → shopify_returns
  //   shipping_charges  → shopify_shipping
  //   net_items_sold, average_order_value, returning_customer_rate

  const grossSales = parseQLDecimal(agg.gross_sales) ?? 0;
  const discounts  = parseQLDecimal(agg.discounts)   ?? 0;
  const netSales   = parseQLDecimal(agg.net_sales)   ?? 0;
  const taxes      = parseQLDecimal(agg.taxes)       ?? 0;
  const totalSales = parseQLDecimal(agg.total_sales) ?? 0;
  const orders     = parseQLInt(agg.orders)          ?? 0;

  // returns: disponibile solo se la fullQuery ha incluso il campo 'returns'.
  // Non usare 0 come fallback: se unavailable deve essere null/omesso nel summary.
  const returnsVal  = hasReturns  ? (parseQLDecimal(agg.returns)          ?? null) : null;
  // shipping_charges: disponibile solo se la fullQuery ha incluso il campo.
  const shippingVal = hasShipping ? (parseQLDecimal(agg.shipping_charges)  ?? null) : null;

  // AOV: usa il valore QL se disponibile (non ricostruire da formula approssimata).
  let averageOrderValue = null;
  if (hasAverageOrderValue && agg.average_order_value != null) {
    averageOrderValue = parseQLDecimal(agg.average_order_value);
  }

  // net_items_sold: unità nette vendute (al netto dei resi) da ShopifyQL.
  let unitsSold = null;
  if (hasNetItemsSold && agg.net_items_sold != null) {
    unitsSold = parseQLInt(agg.net_items_sold);
  }

  // ── Customer rate (percentuale) ───────────────────────────────────────────
  // ShopifyQL può restituire returning_customer_rate in formato 0-100 (es. 42.5)
  // oppure 0-1 (es. 0.425) a seconda della versione API o del piano.
  // Normalizzazione: se il valore è <= 1, moltiplica per 100; poi clamp 0-100.

  let returningCustomersRate = undefined;
  let newCustomersRate       = undefined;

  if (hasReturningCustomerRate && agg.returning_customer_rate != null) {
    const raw = parseQLDecimal(agg.returning_customer_rate);
    if (raw != null) {
      const normalized = raw <= 1 ? raw * 100 : raw;
      const clamped    = Math.max(0, Math.min(100, normalized));
      returningCustomersRate = round2(clamped);
      newCustomersRate       = round2(Math.max(0, Math.min(100, 100 - clamped)));
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  // Campi opzionali omessi (non inclusi come 0) se la fullQuery non era disponibile.
  // Il card builder li marca not_available quando mancano dal summary.

  const officialSummary = {
    [SHOPIFY_KPI_KEYS.totalSales]:  round2(totalSales),
    [SHOPIFY_KPI_KEYS.grossSales]:  round2(grossSales),
    [SHOPIFY_KPI_KEYS.discounts]:   round2(discounts),
    [SHOPIFY_KPI_KEYS.netSales]:    round2(netSales),
    [SHOPIFY_KPI_KEYS.taxes]:       round2(taxes),
    [SHOPIFY_KPI_KEYS.orders]:      orders,
    ...(returnsVal != null          ? { [SHOPIFY_KPI_KEYS.returns]:            round2(returnsVal) }         : {}),
    ...(shippingVal != null         ? { [SHOPIFY_KPI_KEYS.shipping]:           round2(shippingVal) }        : {}),
    ...(averageOrderValue != null   ? { [SHOPIFY_KPI_KEYS.averageOrderValue]:  round2(averageOrderValue) }  : {}),
    ...(unitsSold != null           ? { [SHOPIFY_KPI_KEYS.unitsSold]:          unitsSold }                  : {}),
    ...(returningCustomersRate != null ? { [SHOPIFY_KPI_KEYS.returningCustomers]: returningCustomersRate }  : {}),
    ...(newCustomersRate != null    ? { [SHOPIFY_KPI_KEYS.newCustomers]:       newCustomersRate }           : {}),
  };

  const seriesByMetricKey = buildShopifyQLSeriesByMetricKey(timeseriesRows);
  const hasTimeseries = Array.isArray(timeseriesRows) && timeseriesRows.length > 0;

  return {
    summary: withLegacyAliases(officialSummary),
    seriesByMetricKey,
    meta: {
      currency:                  null,
      mixedCurrency:             false,
      orderCount:                orders,
      apiSource:                 'shopifyql',
      isOrderBasedFallback:      false,
      shopifyqlAvailable:        true,
      shopifyqlAttempted:        true,
      shopifyqlFullQueryAttempted:    diagnostics?.shopifyqlFullQueryAttempted    ?? true,
      shopifyqlMinimalQueryAttempted: diagnostics?.shopifyqlMinimalQueryAttempted ?? false,
      shopifyqlQueryType:             diagnostics?.shopifyqlQueryType             ?? null,
      shopifyqlRawTableShape:         diagnostics?.shopifyqlRawTableShape         ?? null,
      shopifyqlErrorCode:        null,
      shopifyqlErrorMessage:     null,
      shopifyqlReturnsFieldUsed:     hasReturns ? 'returns' : null,
      shopifyqlReturnsUnavailable:   !hasReturns,
      shopifyqlShippingFieldUsed:    hasShipping ? 'shipping_charges' : null,
      shopifyqlShippingUnavailable:  !hasShipping,
      cacheSchemaVersion:            SHOPIFY_KPI_SCHEMA_VERSION,
      range,
      startDate,
      endDate,
      fetchedAt:                 fetchMeta?.fetchedAt ?? null,
      truncated:                 false,
      pagesFetched:              null,
      isPartialData:             false,
      hasNetItemsSoldFromQL:     hasNetItemsSold,
      hasAverageOrderValueFromQL: hasAverageOrderValue,
      hasReturningCustomerRateFromQL: hasReturningCustomerRate,
      hasTimeseriesFromQL:       hasTimeseries,
    },
  };
}
