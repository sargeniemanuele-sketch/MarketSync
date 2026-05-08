// Trasformazione sincrona pura: nessuna chiamata DB, nessun async, nessun import da service esterni.
// Converte nodi ordine Shopify GraphQL (camelCase, MoneyBag per i valori monetari) in
// una struttura interna stabile e tipizzata su cui i layer KPI e overview possono fare affidamento.

// ── Parser numerici ───────────────────────────────────────────────────────────

/**
 * Converte una stringa monetaria Shopify (es. "149.99") in un numero JS.
 * Restituisce 0 per null, undefined, stringa vuota o risultati non finiti.
 */
function parseDecimal(value) {
  if (value == null || value === '') return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Estrae il valore monetario da un MoneyBag GraphQL ({ shopMoney: { amount } }).
 * Usa shopMoney come primario (valuta store) e presentmentMoney come fallback.
 */
function parseMoneySet(value) {
  return parseDecimal(value?.shopMoney?.amount ?? value?.presentmentMoney?.amount);
}

/**
 * Converte un campo intero Shopify in un intero JS.
 * Restituisce null per valori mancanti, non validi o zero: zero non è un
 * numberOfOrders valido per un customer esistente.
 */
function parsePositiveInt(value) {
  if (value == null) return null;
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Estrae l'ID numerico da un Global ID Shopify (es. "gid://shopify/Order/123456").
 * Restituisce null se l'ID non è estraibile o non positivo.
 */
function extractNumericId(gid) {
  if (gid == null) return null;
  if (typeof gid === 'number') return gid > 0 ? gid : null;
  if (typeof gid !== 'string') return null;
  const lastSegment = gid.split('/').pop();
  const n = parseInt(lastSegment, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ── Line item ─────────────────────────────────────────────────────────────────

/**
 * Somma la quantità di tutti i line item in un ordine GraphQL.
 * Accetta la shape connection GraphQL: { edges: [{ node: { quantity } }] }.
 */
function sumLineItemQuantities(lineItems) {
  const edges = lineItems?.edges;
  if (!Array.isArray(edges) || edges.length === 0) return 0;
  return edges.reduce((total, edge) => {
    const qty = parseInt(edge?.node?.quantity, 10);
    return total + (Number.isInteger(qty) && qty > 0 ? qty : 0);
  }, 0);
}

// ── Rimborsi ──────────────────────────────────────────────────────────────────

/**
 * Somma le quantità articolo rimborsate su tutti i rimborsi di un ordine GraphQL.
 *
 * Fonte: refunds[].refundLineItems.edges[].node.quantity
 *
 * È il proxy più vicino per "returned items" disponibile nell'API standard
 * Shopify senza recuperare l'endpoint Returns dedicato.
 *
 * Limitazione: refundLineItems può includere aggiustamenti inventario che non sono
 * resi cliente. Il layer normalize passa il conteggio grezzo;
 * i chiamanti devono trattare `refundedUnits` come limite superiore conservativo
 * sui resi cliente, non come dato esatto.
 */
function sumRefundedUnits(refunds) {
  if (!Array.isArray(refunds) || refunds.length === 0) return 0;
  return refunds.reduce((total, refund) => {
    const edges = refund?.refundLineItems?.edges;
    if (!Array.isArray(edges)) return total;
    return total + edges.reduce((s, edge) => {
      const qty = parseInt(edge?.node?.quantity, 10);
      return s + (Number.isInteger(qty) && qty > 0 ? qty : 0);
    }, 0);
  }, 0);
}

function sumRefundedLineItemSubtotal(refunds) {
  if (!Array.isArray(refunds) || refunds.length === 0) return 0;

  return refunds.reduce((total, refund) => {
    const edges = refund?.refundLineItems?.edges;
    if (!Array.isArray(edges)) return total;

    return total + edges.reduce((sum, edge) => {
      const item = edge?.node;
      if (!item) return sum;

      const subtotal = parseDecimal(item?.subtotalSet?.shopMoney?.amount);
      if (subtotal > 0) return sum + subtotal;

      // Fallback: quantità × prezzo unitario originale del line item
      const quantity  = parseInt(item?.quantity, 10);
      const unitPrice = parseDecimal(item?.lineItem?.originalUnitPriceSet?.shopMoney?.amount);
      return sum + (Number.isInteger(quantity) && quantity > 0 ? unitPrice * quantity : 0);
    }, 0);
  }, 0);
}

function sumRefundTransactions(refunds) {
  if (!Array.isArray(refunds) || refunds.length === 0) return 0;

  return refunds.reduce((total, refund) => {
    // In Admin GraphQL API 2024-01+, Refund.transactions è una OrderTransactionConnection
    // (richiede edges/node). La query usa transactions(first: 50) { edges { node { ... } } }.
    const edges = refund?.transactions?.edges;
    if (!Array.isArray(edges)) return total;

    return total + edges.reduce((sum, edge) => {
      const transaction = edge?.node;
      if (!transaction) return sum;

      const kind   = String(transaction?.kind   ?? '').toUpperCase();
      const status = String(transaction?.status ?? '').toUpperCase();

      // Enum GraphQL uppercase: kind === 'REFUND', status === 'SUCCESS'
      if (kind !== 'REFUND' || (status && status !== 'SUCCESS')) return sum;

      return sum + parseDecimal(transaction?.amountSet?.shopMoney?.amount);
    }, 0);
  }, 0);
}

function sumRefundedShipping(refunds) {
  if (!Array.isArray(refunds) || refunds.length === 0) return 0;

  return refunds.reduce((total, refund) => {
    const adjustments = refund?.orderAdjustments;
    if (!Array.isArray(adjustments)) return total;

    return total + adjustments.reduce((sum, adjustment) => {
      // In GraphQL il kind è l'enum SHIPPING_REFUND
      const kind = String(adjustment?.kind ?? '').toUpperCase();
      if (kind !== 'SHIPPING_REFUND') return sum;

      const amount = parseDecimal(adjustment?.amountSet?.shopMoney?.amount);
      return sum + Math.abs(amount);
    }, 0);
  }, 0);
}

// ── Gross sales ───────────────────────────────────────────────────────────────

/**
 * Risolve il valore gross sales (totale line item pre-sconto) per un ordine GraphQL.
 *
 * L'API GraphQL non espone total_line_items_price come campo diretto.
 * Viene ricostruito tramite la relazione matematica equivalente nel modello Shopify:
 *   subtotal_price = total_line_items_price - total_discounts
 *   → total_line_items_price = subtotal_price + total_discounts
 */
function resolveGrossSales(subtotalPrice, totalDiscounts) {
  return subtotalPrice + totalDiscounts;
}

/**
 * Risolve lo shipping netto: totalShippingPriceSet meno shipping rimborsato.
 * GraphQL espone totalShippingPriceSet direttamente; non è necessario aggregare
 * le shipping_lines come nel fallback REST.
 */
function resolveShipping(order, refunds) {
  const shipping = parseMoneySet(order.totalShippingPriceSet);
  return Math.max(0, shipping - sumRefundedShipping(refunds));
}

// Duties e additional fees non sono disponibili come campi diretti nell'API
// GraphQL Admin standard (2026-01). Restituiscono 0; i KPI che li includono
// (totalSales) rimangono corretti ma privi di questa componente.
function resolveDuties() {
  return 0;
}

function resolveAdditionalFees() {
  return 0;
}

// ── Segmento cliente ──────────────────────────────────────────────────────────

/**
 * Deriva se il customer è ricorrente dal campo numberOfOrders di Shopify GraphQL.
 *
 * numberOfOrders riflette il conteggio totale CORRENTE al momento della chiamata API,
 * non uno snapshot al momento in cui l'ordine è stato effettuato. Implicazione:
 *   - numberOfOrders === 1: il customer ha effettuato esattamente un ordine → new
 *   - numberOfOrders  >  1: il customer ha effettuato più ordini → returning
 *
 * Limitazione nota: un customer che era nuovo quando ha effettuato questo ordine ma ha
 * riordinato in seguito mostrerà numberOfOrders > 1 e sarà classificato come returning
 * per questo ordine storico. È un vincolo intrinseco dell'API Shopify.
 *
 * Restituisce null per guest checkout (nessun customer) o numberOfOrders non valido/zero.
 */
function deriveIsReturningCustomer(ordersCount) {
  if (ordersCount === null || ordersCount === undefined) return null;
  return ordersCount > 1;
}

// ── API pubblica ──────────────────────────────────────────────────────────────

/**
 * Normalizza un array di nodi ordine Shopify GraphQL in una struttura interna stabile.
 *
 * Ingresso: nodi ordine GraphQL (camelCase, MoneyBag per i valori monetari, enum uppercase)
 *           come restituiti da fetchRawShopifyData.
 * Uscita:   array di oggetti NormalizedOrder (camelCase, numeri come number JS).
 *
 * La struttura normalizzata è pensata per essere consumata da:
 *   - shopify.kpi.service.js
 *   - qualsiasi futuro service overview o aggregazione
 *
 * Questa funzione non lancia mai: i campi malformati vengono convertiti in fallback sicuri.
 *
 * Struttura NormalizedOrder:
 * {
 *   id:                   number | null    — ID ordine Shopify (estratto dal GID)
 *   createdAt:            Date | null      — timestamp creazione ordine
 *   processedAt:          Date | null      — timestamp processamento ordine (usato per bucketing)
 *   cancelledAt:          Date | null      — timestamp cancellazione, null se non cancellato
 *   financialStatus:      string | null    — es. 'PAID', 'REFUNDED' (enum GraphQL uppercase)
 *   grossSales:           number           — totale line item pre-sconto (subtotal + discounts)
 *   subtotalPrice:        number           — dopo sconti, prima delle tasse
 *   totalPrice:           number           — importo finale pagato dal customer
 *   totalDiscounts:       number           — sconti totali applicati
 *   totalTax:             number           — tasse totali applicate
 *   shipping:             number           — spedizione netta (dopo rimborsi shipping)
 *   duties:               number           — sempre 0 (non disponibile in GraphQL standard)
 *   additionalFees:       number           — sempre 0 (non disponibile in GraphQL standard)
 *   currency:             string | null    — codice valuta ISO (da currencyCode)
 *   customerId:           number | null    — null per guest checkout
 *   customerOrdersCount:  number | null    — numberOfOrders corrente per questo customer
 *   unitsSold:            number           — somma delle quantità lineItems (max 250 voci)
 *   refundedUnits:        number           — somma delle quantità refundLineItems (max 250 voci)
 *   returnsAmount:        number           — valore line item rimborsato
 *   refundedAmount:       number           — importo transazioni refund SUCCESS
 *   isReturningCustomer:  boolean | null   — derivato da customerOrdersCount; null se sconosciuto
 * }
 *
 * @param {object[]} rawOrders
 * @returns {object[]}
 */
export function normalizeOrders(rawOrders) {
  if (!Array.isArray(rawOrders)) return [];

  return rawOrders.map((order) => {
    const subtotalPrice  = parseMoneySet(order.subtotalPriceSet);
    const totalDiscounts = parseMoneySet(order.totalDiscountsSet);
    const grossSales     = resolveGrossSales(subtotalPrice, totalDiscounts);
    const ordersCount    = parsePositiveInt(order.customer?.numberOfOrders);
    const refunds        = Array.isArray(order.refunds) ? order.refunds : [];

    return {
      id:                  extractNumericId(order.id),
      createdAt:           order.createdAt   ? new Date(order.createdAt)   : null,
      processedAt:         order.processedAt ? new Date(order.processedAt) : null,
      cancelledAt:         order.cancelledAt ? new Date(order.cancelledAt) : null,
      financialStatus:     order.displayFinancialStatus ?? null,
      grossSales,
      subtotalPrice,
      totalPrice:          parseMoneySet(order.totalPriceSet),
      totalDiscounts,
      totalTax:            parseMoneySet(order.totalTaxSet),
      shipping:            resolveShipping(order, refunds),
      duties:              resolveDuties(),
      additionalFees:      resolveAdditionalFees(),
      currency:            order.currencyCode ?? null,
      customerId:          extractNumericId(order.customer?.id),
      customerOrdersCount: ordersCount,
      unitsSold:           sumLineItemQuantities(order.lineItems),
      refundedUnits:       sumRefundedUnits(refunds),
      returnsAmount:       sumRefundedLineItemSubtotal(refunds),
      refundedAmount:      sumRefundTransactions(refunds),
      isReturningCustomer: deriveIsReturningCustomer(ordersCount),
    };
  });
}
