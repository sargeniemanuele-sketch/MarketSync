// Trasformazione sincrona pura: nessuna chiamata DB, nessun async, nessun side effect.
// Converte payload insight Meta Ads grezzi in una struttura interna stabile per il calcolo KPI.

// ── Priorità mapping action ──────────────────────────────────────────────────
// La priorità è da sinistra a destra. La prima chiave presente in una riga è usata
// per evitare doppi conteggi tra tipi action sovrapposti.

const ACTION_KEY_PRIORITY = Object.freeze({
  purchases: Object.freeze([
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
    'offsite_conversion.purchase',
    'onsite_web_purchase',
  ]),
  purchaseValue: Object.freeze([
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.purchase',
    'offsite_conversion.purchase',
    'onsite_web_purchase',
  ]),
  linkClicks: Object.freeze([
    'link_click',
  ]),
  outboundClicks: Object.freeze([
    'outbound_click',
  ]),
});

// ── Parser ───────────────────────────────────────────────────────────────────

function parseNumber(value) {
  if (value == null || value === '') return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseOptionalNumber(value) {
  if (value == null || value === '') return null;
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseCount(value) {
  if (value == null || value === '') return 0;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function parseDateOnly(value) {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildActionMap(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return new Map();

  const map = new Map();

  for (const entry of actions) {
    const key = entry?.action_type;
    if (!key || typeof key !== 'string') continue;

    const amount = parseNumber(entry?.value);
    // Mantiene il valore massimo visto per la stessa action key per evitare
    // inflazione accidentale da chiavi ripetute in payload malformati.
    if (!map.has(key) || amount > map.get(key)) {
      map.set(key, amount);
    }
  }

  return map;
}

function pickActionValue(actionMap, orderedKeys) {
  for (const key of orderedKeys) {
    if (!key) continue;
    if (actionMap.has(key)) {
      return { value: actionMap.get(key), keyUsed: key };
    }
  }

  return { value: null, keyUsed: null };
}

function pickPurchaseRelatedValue(actionMap, purchaseKeyUsed) {
  return pickActionValue(actionMap, [
    purchaseKeyUsed,
    ...ACTION_KEY_PRIORITY.purchaseValue,
  ]);
}

function normalizeInsightRow(rawInsight) {
  const actionsMap = buildActionMap(rawInsight?.actions);
  const actionValuesMap = buildActionMap(rawInsight?.action_values);
  const purchaseRoasMap = buildActionMap(rawInsight?.purchase_roas);
  const outboundClicksMap = buildActionMap(rawInsight?.outbound_clicks);
  const costPerActionTypeMap = buildActionMap(rawInsight?.cost_per_action_type);
  const costPerOutboundClickMap = buildActionMap(rawInsight?.cost_per_outbound_click);

  const purchasesPick = pickActionValue(actionsMap, ACTION_KEY_PRIORITY.purchases);
  const purchaseValuePick = pickPurchaseRelatedValue(actionValuesMap, purchasesPick.keyUsed);
  const purchaseRoasPick = pickActionValue(purchaseRoasMap, [purchasesPick.keyUsed]);
  const costPerPurchasePick = pickActionValue(costPerActionTypeMap, [purchasesPick.keyUsed]);
  const linkClicksPick = pickActionValue(actionsMap, ACTION_KEY_PRIORITY.linkClicks);
  const outboundClicksPick = pickActionValue(
    outboundClicksMap,
    ACTION_KEY_PRIORITY.outboundClicks
  );
  const costPerOutboundClickPick = pickActionValue(
    costPerOutboundClickMap,
    ACTION_KEY_PRIORITY.outboundClicks
  );

  return {
    row: {
      accountId: rawInsight?.account_id ?? null,
      accountName: rawInsight?.account_name ?? null,
      dateStart: parseDateOnly(rawInsight?.date_start),
      dateStop: parseDateOnly(rawInsight?.date_stop),
      spend: parseNumber(rawInsight?.spend),
      impressions: parseCount(rawInsight?.impressions),
      reach: parseCount(rawInsight?.reach),
      frequency: parseOptionalNumber(rawInsight?.frequency),
      clicks: parseCount(rawInsight?.clicks),
      ctr: parseOptionalNumber(rawInsight?.ctr),
      cpc: parseOptionalNumber(rawInsight?.cpc),
      cpm: parseOptionalNumber(rawInsight?.cpm),
      purchases: parseCount(purchasesPick.value),
      purchaseValue: purchaseValuePick.value ?? 0,
      purchaseRoas: purchaseRoasPick.value,
      costPerPurchase: costPerPurchasePick.value,
      linkClicks: parseCount(linkClicksPick.value),
      outboundClicks: parseCount(outboundClicksPick.value),
      costPerOutboundClick: costPerOutboundClickPick.value,
    },
    mapping: {
      purchasesKeyUsed: purchasesPick.keyUsed,
      purchaseValueKeyUsed: purchaseValuePick.keyUsed,
      purchaseRoasKeyUsed: purchaseRoasPick.keyUsed,
      costPerPurchaseKeyUsed: costPerPurchasePick.keyUsed,
      linkClicksKeyUsed: linkClicksPick.keyUsed,
      outboundClicksKeyUsed: outboundClicksPick.keyUsed,
      costPerOutboundClickKeyUsed: costPerOutboundClickPick.keyUsed,
    },
  };
}

function initMappingStats() {
  return {
    purchases: { usedKeys: new Set(), missingRows: 0 },
    purchase_value: { usedKeys: new Set(), missingRows: 0 },
    purchase_roas: { usedKeys: new Set(), missingRows: 0 },
    cost_per_purchase: { usedKeys: new Set(), missingRows: 0 },
    link_clicks: { usedKeys: new Set(), missingRows: 0 },
    outbound_clicks: { usedKeys: new Set(), missingRows: 0 },
    cost_per_outbound_click: { usedKeys: new Set(), missingRows: 0 },
  };
}

function updateMappingStats(stats, mapping) {
  if (mapping.purchasesKeyUsed) {
    stats.purchases.usedKeys.add(mapping.purchasesKeyUsed);
  } else {
    stats.purchases.missingRows += 1;
  }

  if (mapping.purchaseValueKeyUsed) {
    stats.purchase_value.usedKeys.add(mapping.purchaseValueKeyUsed);
  } else {
    stats.purchase_value.missingRows += 1;
  }

  if (mapping.purchaseRoasKeyUsed) {
    stats.purchase_roas.usedKeys.add(mapping.purchaseRoasKeyUsed);
  } else {
    stats.purchase_roas.missingRows += 1;
  }

  if (mapping.costPerPurchaseKeyUsed) {
    stats.cost_per_purchase.usedKeys.add(mapping.costPerPurchaseKeyUsed);
  } else {
    stats.cost_per_purchase.missingRows += 1;
  }

  if (mapping.linkClicksKeyUsed) {
    stats.link_clicks.usedKeys.add(mapping.linkClicksKeyUsed);
  } else {
    stats.link_clicks.missingRows += 1;
  }

  if (mapping.outboundClicksKeyUsed) {
    stats.outbound_clicks.usedKeys.add(mapping.outboundClicksKeyUsed);
  } else {
    stats.outbound_clicks.missingRows += 1;
  }

  if (mapping.costPerOutboundClickKeyUsed) {
    stats.cost_per_outbound_click.usedKeys.add(mapping.costPerOutboundClickKeyUsed);
  } else {
    stats.cost_per_outbound_click.missingRows += 1;
  }
}

function finalizeMappingMeta(stats, rowCount) {
  const purchasesUsed = [...stats.purchases.usedKeys];
  const purchaseValueUsed = [...stats.purchase_value.usedKeys];
  const purchaseRoasUsed = [...stats.purchase_roas.usedKeys];
  const costPerPurchaseUsed = [...stats.cost_per_purchase.usedKeys];
  const linkClicksUsed = [...stats.link_clicks.usedKeys];
  const outboundClicksUsed = [...stats.outbound_clicks.usedKeys];
  const costPerOutboundClickUsed = [...stats.cost_per_outbound_click.usedKeys];

  return {
    usedActionMapping: {
      purchases: purchasesUsed,
      purchase_value: purchaseValueUsed,
      purchase_roas: purchaseRoasUsed,
      cost_per_purchase: costPerPurchaseUsed,
      link_clicks: linkClicksUsed,
      outbound_clicks: outboundClicksUsed,
      cost_per_outbound_click: costPerOutboundClickUsed,
    },
    missingActionKeys: {
      purchases: ACTION_KEY_PRIORITY.purchases.filter((k) => !stats.purchases.usedKeys.has(k)),
      purchase_value: ACTION_KEY_PRIORITY.purchaseValue.filter((k) => !stats.purchase_value.usedKeys.has(k)),
      link_clicks: ACTION_KEY_PRIORITY.linkClicks.filter((k) => !stats.link_clicks.usedKeys.has(k)),
      outbound_clicks: ACTION_KEY_PRIORITY.outboundClicks.filter((k) => !stats.outbound_clicks.usedKeys.has(k)),
    },
    missingActionRows: {
      purchases: stats.purchases.missingRows,
      purchase_value: stats.purchase_value.missingRows,
      purchase_roas: stats.purchase_roas.missingRows,
      cost_per_purchase: stats.cost_per_purchase.missingRows,
      link_clicks: stats.link_clicks.missingRows,
      outbound_clicks: stats.outbound_clicks.missingRows,
      cost_per_outbound_click: stats.cost_per_outbound_click.missingRows,
    },
    hasPartialAttributionData:
      stats.purchases.missingRows > 0 ||
      stats.purchase_value.missingRows > 0 ||
      stats.link_clicks.missingRows > 0 ||
      purchasesUsed.length === 0 ||
      purchaseValueUsed.length === 0 ||
      linkClicksUsed.length === 0 ||
      rowCount === 0,
  };
}

/**
 * Normalizza l'output fetch grezzo Meta Ads per uso KPI interno.
 *
 * Ingresso (atteso):
 * {
 *   insights: [...righe Meta grezze...],
 *   meta: { fetchedAt, range, startDate, endDate, ... }
 * }
 *
 * Uscita:
 * {
 *   rows: [
 *     {
 *       accountId,
 *       accountName,
 *       dateStart,
 *       dateStop,
 *       spend,
 *       impressions,
 *       reach,
 *       frequency,
 *       clicks,
 *       ctr,
 *       cpc,
 *       cpm,
 *       purchases,
 *       purchaseValue,
 *       purchaseRoas,
 *       costPerPurchase,
 *       linkClicks,
 *       outboundClicks,
 *       costPerOutboundClick,
 *     }
 *   ],
 *   meta: {
 *     rowCount,
 *     fetchedAt,
 *     range,
 *     startDate,
 *     endDate,
 *     usedActionMapping,
 *     missingActionKeys,
 *     missingActionRows,
 *     hasPartialAttributionData,
 *   }
 * }
 *
 * @param {object} rawFetchResult
 */
export function normalizeMetaAdsInsights(rawFetchResult) {
  const rawInsights = Array.isArray(rawFetchResult?.insights)
    ? rawFetchResult.insights
    : [];

  const rawMeta = rawFetchResult?.meta ?? {};
  const mappingStats = initMappingStats();

  const rows = rawInsights.map((rawInsight) => {
    const { row, mapping } = normalizeInsightRow(rawInsight);
    updateMappingStats(mappingStats, mapping);
    return row;
  });

  return {
    rows,
    meta: {
      rowCount: rows.length,
      range: rawMeta.range ?? null,
      startDate: rawMeta.startDate ?? null,
      endDate: rawMeta.endDate ?? null,
      fetchedAt: rawMeta.fetchedAt ?? null,
      ...finalizeMappingMeta(mappingStats, rows.length),
    },
  };
}
