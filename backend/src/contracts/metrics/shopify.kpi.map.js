export const SHOPIFY_ANALYTICS_FIELDS_URL =
  'https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/analytics-fields';

export const SHOPIFY_SALES_REPORTS_URL =
  'https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/sales-report';

export const SHOPIFY_KPI_SOURCE = 'Shopify Analytics / Sales reports';

export const SHOPIFY_KPI_KEYS = Object.freeze({
  grossSales: 'shopify_gross_sales',
  discounts: 'shopify_discounts',
  returns: 'shopify_returns',
  netSales: 'shopify_net_sales',
  shipping: 'shopify_shipping',
  taxes: 'shopify_taxes',
  totalSales: 'shopify_total_sales',
  orders: 'shopify_orders',
  averageOrderValue: 'shopify_average_order_value',
  unitsSold: 'shopify_units_sold',
  newCustomers: 'shopify_new_customers',
  returningCustomers: 'shopify_returning_customers',
  newCustomerOrders: 'shopify_new_customer_orders',
  returningCustomerOrders: 'shopify_returning_customer_orders',
  refundedAmount: 'shopify_refunded_amount',
});

export const SHOPIFY_DASHBOARD_PREVIEW_KEYS = Object.freeze([
  SHOPIFY_KPI_KEYS.totalSales,
  SHOPIFY_KPI_KEYS.orders,
  SHOPIFY_KPI_KEYS.averageOrderValue,
  SHOPIFY_KPI_KEYS.newCustomers,
]);

export const SHOPIFY_PRIMARY_KPI_KEYS = Object.freeze([
  SHOPIFY_KPI_KEYS.totalSales,
  SHOPIFY_KPI_KEYS.orders,
  SHOPIFY_KPI_KEYS.averageOrderValue,
  SHOPIFY_KPI_KEYS.grossSales,
]);

export const SHOPIFY_SECONDARY_KPI_KEYS = Object.freeze([
  SHOPIFY_KPI_KEYS.discounts,
  SHOPIFY_KPI_KEYS.returns,
  SHOPIFY_KPI_KEYS.netSales,
  SHOPIFY_KPI_KEYS.shipping,
  SHOPIFY_KPI_KEYS.taxes,
  SHOPIFY_KPI_KEYS.unitsSold,
  SHOPIFY_KPI_KEYS.newCustomers,
  SHOPIFY_KPI_KEYS.returningCustomers,
  SHOPIFY_KPI_KEYS.newCustomerOrders,
  SHOPIFY_KPI_KEYS.returningCustomerOrders,
  SHOPIFY_KPI_KEYS.refundedAmount,
]);

export const SHOPIFY_KPI_DEFINITIONS = Object.freeze([
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.grossSales,
    legacyKey: 'gross_sales',
    officialLabel: 'Gross sales',
    apiSource: 'calculated_from_orders',
    sourceType: 'calculated_from_orders',
    formula: 'Gross sales = sum(product price x quantity before taxes, shipping, discounts, and returns)',
    unit: 'currency',
    descriptionIt: 'Ricavi da prodotti prima di sconti, resi, spedizione e tasse nel periodo selezionato.',
    formulaIt: 'Gross sales = somma di prezzo prodotto x quantita prima di tasse, spedizione, sconti e resi.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_SALES_REPORTS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.discounts,
    legacyKey: 'discounts',
    officialLabel: 'Discounts',
    apiSource: 'calculated_from_orders',
    sourceType: 'calculated_from_orders',
    formula: 'Discounts = line item discounts + allocated order-level discounts',
    unit: 'currency',
    descriptionIt: 'Valore totale degli sconti applicati alle vendite nel periodo selezionato.',
    formulaIt: 'Discounts = sconti line item + quota sconti a livello ordine.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_SALES_REPORTS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.returns,
    legacyKey: 'returns',
    officialLabel: 'Returns',
    apiSource: 'calculated_from_refunds',
    sourceType: 'calculated_from_refunds',
    formula: 'Returns = sum(refunded line item subtotal amounts)',
    unit: 'currency',
    descriptionIt: 'Valore dei prodotti restituiti o rimborsati nel periodo selezionato, espresso come importo positivo da sottrarre.',
    formulaIt: 'Returns = somma dei subtotali dei line item rimborsati.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_ANALYTICS_FIELDS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.netSales,
    legacyKey: 'net_sales',
    officialLabel: 'Net sales',
    apiSource: 'calculated_from_orders',
    sourceType: 'calculated_from_orders',
    formula: 'Net sales = Gross sales - Discounts - Returns',
    unit: 'currency',
    descriptionIt: 'Ricavi dopo sconti e resi, secondo la logica Shopify.',
    formulaIt: 'Net sales = Gross sales - Discounts - Returns.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_ANALYTICS_FIELDS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.shipping,
    legacyKey: 'shipping',
    officialLabel: 'Shipping',
    apiSource: 'calculated_from_orders',
    sourceType: 'calculated_from_orders',
    formula: 'Shipping = shipping charges - shipping discounts - refunded shipping amounts',
    unit: 'currency',
    descriptionIt: 'Importo netto della spedizione addebitata ai clienti nel periodo selezionato.',
    formulaIt: 'Shipping = addebiti spedizione - sconti spedizione - spedizione rimborsata.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_SALES_REPORTS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.taxes,
    legacyKey: 'taxes',
    officialLabel: 'Taxes',
    apiSource: 'calculated_from_orders',
    sourceType: 'calculated_from_orders',
    formula: 'Taxes = sum(order tax amounts)',
    unit: 'currency',
    descriptionIt: 'Totale delle tasse associate agli ordini nel periodo selezionato.',
    formulaIt: 'Taxes = somma degli importi tassa degli ordini.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_SALES_REPORTS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.totalSales,
    legacyKey: 'total_sales',
    officialLabel: 'Total sales',
    apiSource: 'calculated_from_orders',
    sourceType: 'calculated_from_orders',
    formula: 'Total sales = Net sales + Shipping + Taxes, con Duties e Additional fees inclusi solo se disponibili nei dati Shopify recuperati',
    unit: 'currency',
    descriptionIt: 'Vendite totali secondo la logica Shopify nel periodo selezionato.',
    formulaIt: 'Total sales = Net sales + Shipping + Taxes, con Duties e Additional fees inclusi solo se disponibili nei dati Shopify recuperati.',
    dashboardPreview: true,
    sourceDocUrl: SHOPIFY_ANALYTICS_FIELDS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.orders,
    legacyKey: 'orders',
    officialLabel: 'Orders',
    apiSource: 'Orders API',
    sourceType: 'official_field',
    formula: 'Orders = count(orders placed in the selected period)',
    unit: 'number',
    descriptionIt: 'Numero di ordini effettuati nel periodo selezionato.',
    formulaIt: 'Orders = conteggio degli ordini nel periodo selezionato.',
    dashboardPreview: true,
    sourceDocUrl: SHOPIFY_ANALYTICS_FIELDS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.averageOrderValue,
    legacyKey: 'average_order_value',
    officialLabel: 'Average order value',
    apiSource: 'calculated_from_orders',
    sourceType: 'calculated_from_orders',
    formula: 'Average order value = (Gross sales - Discounts) / Orders',
    unit: 'currency',
    descriptionIt: 'Valore medio degli ordini Shopify, escludendo aggiustamenti post-ordine come resi, edit o cambi.',
    formulaIt: 'Average order value = (Gross sales - Discounts) / Orders.',
    dashboardPreview: true,
    sourceDocUrl: SHOPIFY_SALES_REPORTS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.unitsSold,
    legacyKey: 'units_sold',
    officialLabel: 'Units sold',
    apiSource: 'line_items',
    sourceType: 'calculated_from_orders',
    formula: 'Units sold = sum(line item quantities)',
    unit: 'number',
    descriptionIt: 'Numero totale di unita vendute nei line item degli ordini.',
    formulaIt: 'Units sold = somma delle quantita dei line item.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_ANALYTICS_FIELDS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.newCustomers,
    legacyKey: 'new_customers',
    officialLabel: 'New customers',
    apiSource: 'customer/order history',
    sourceType: 'calculated_from_customer_history',
    formula: 'New customers = count(distinct customers whose order is classified as first-time)',
    unit: 'number',
    descriptionIt: 'Clienti distinti classificati come first-time purchasers nel periodo selezionato.',
    formulaIt: 'New customers = conteggio clienti distinti classificati come nuovi.',
    dashboardPreview: true,
    sourceDocUrl: SHOPIFY_ANALYTICS_FIELDS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.returningCustomers,
    legacyKey: 'returning_customers',
    officialLabel: 'Returning customers',
    apiSource: 'customer/order history',
    sourceType: 'calculated_from_customer_history',
    formula: 'Returning customers = count(distinct customers classified as returning)',
    unit: 'number',
    descriptionIt: 'Clienti distinti classificati come ricorrenti nel periodo selezionato.',
    formulaIt: 'Returning customers = conteggio clienti distinti classificati come ricorrenti.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_ANALYTICS_FIELDS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.newCustomerOrders,
    legacyKey: 'new_customer_orders',
    officialLabel: 'New customer orders',
    apiSource: 'customer/order history',
    sourceType: 'calculated_from_customer_history',
    formula: 'New customer orders = count(orders from first-time customers)',
    unit: 'number',
    descriptionIt: 'Numero di ordini attribuiti a clienti first-time nel periodo selezionato.',
    formulaIt: 'New customer orders = conteggio ordini da clienti nuovi.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_ANALYTICS_FIELDS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.returningCustomerOrders,
    legacyKey: 'returning_customer_orders',
    officialLabel: 'Returning customer orders',
    apiSource: 'customer/order history',
    sourceType: 'calculated_from_customer_history',
    formula: 'Returning customer orders = count(orders from returning customers)',
    unit: 'number',
    descriptionIt: 'Numero di ordini attribuiti a clienti ricorrenti nel periodo selezionato.',
    formulaIt: 'Returning customer orders = conteggio ordini da clienti ricorrenti.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_ANALYTICS_FIELDS_URL,
  }),
  Object.freeze({
    provider: 'shopify',
    internalKey: SHOPIFY_KPI_KEYS.refundedAmount,
    legacyKey: 'refunded_amount',
    officialLabel: 'Refunded amount',
    apiSource: 'refunds',
    sourceType: 'calculated_from_refunds',
    formula: 'Refunded amount = sum(successful refund transaction amounts)',
    unit: 'currency',
    descriptionIt: 'Importo monetario rimborsato ai clienti nel periodo selezionato.',
    formulaIt: 'Refunded amount = somma degli importi delle transazioni di rimborso riuscite.',
    dashboardPreview: false,
    sourceDocUrl: SHOPIFY_ANALYTICS_FIELDS_URL,
  }),
]);

export const SHOPIFY_KPI_DEFINITION_BY_KEY = Object.freeze(
  Object.fromEntries(SHOPIFY_KPI_DEFINITIONS.map((definition) => [definition.internalKey, definition]))
);

export function getShopifyKpiDefinition(key) {
  return SHOPIFY_KPI_DEFINITION_BY_KEY[key] ?? null;
}

export function buildShopifyCardDefinition(key) {
  const definition = getShopifyKpiDefinition(key);
  if (!definition) return null;
  const isTotalSales = definition.internalKey === SHOPIFY_KPI_KEYS.totalSales;
  const isCustomerHistory = definition.sourceType === 'calculated_from_customer_history';

  let note = null;
  if (isTotalSales) {
    note =
      'Total sales = Net sales + Shipping + Taxes, con Duties e Additional fees inclusi solo se disponibili nei dati Shopify recuperati.';
  } else if (isCustomerHistory) {
    note =
      'Classificazione calcolata in base a customer.orders_count disponibile negli ordini recuperati. Puo dipendere dalla disponibilita dello storico cliente Shopify.';
  } else if (definition.sourceType !== 'official_field') {
    note = 'Calcolato dai dati ordini Shopify se il report Analytics non e disponibile via API.';
  }

  return {
    key: definition.internalKey,
    label: definition.officialLabel,
    unit: definition.unit,
    help: {
      title: definition.officialLabel,
      description: definition.descriptionIt,
      formula: definition.formula,
      formulaIt: definition.formulaIt,
      source: SHOPIFY_KPI_SOURCE,
      sourceUrl: definition.sourceDocUrl,
      note,
    },
    dashboardPreview: definition.dashboardPreview,
    sourceType: definition.sourceType,
    apiSource: definition.apiSource,
  };
}
