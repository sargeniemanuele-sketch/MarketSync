import Client from '../../models/Client.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { parsePaginationQuery, buildPaginationMeta } from '../../utils/pagination.js';
import { invalidateByProvider } from '../cache/metricCache.service.js';

function serializeClient(client) {
  const customMetricsConfig = Array.isArray(client.customMetricsConfig)
    ? client.customMetricsConfig.map((metric) => ({
        ...metric,
        description: metric.description ?? null,
        enabled: metric.enabled !== false,
        unit: metric.unit ?? 'number',
        providerContext: metric.providerContext ?? 'mixed',
        variables: Array.isArray(metric.variables) ? metric.variables : [],
      }))
    : [];

  const bs = client.businessSettings ?? {};
  const businessSettings = {
    commissionPercentage: bs.commissionPercentage ?? null,
    fixedCommission: bs.fixedCommission ?? null,
    extraCosts: Array.isArray(bs.extraCosts)
      ? bs.extraCosts.map((c) => ({
          key: c.key,
          label: c.label,
          value: c.value ?? 0,
          type: c.type,
        }))
      : [],
  };

  return {
    id: client._id.toString(),
    ownerUserId: client.ownerUserId.toString(),
    name: client.name,
    contactEmail: client.contactEmail ?? null,
    notes: client.notes ?? null,
    website: client.website ?? null,
    businessSettings,
    customMetricsConfig,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

// ── Lista ─────────────────────────────────────────────────────────────────────

export async function listClients(ownerUserId, query) {
  const { page, limit, skip } = parsePaginationQuery(query);
  const filter = { ownerUserId };

  const [clients, total] = await Promise.all([
    Client.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Client.countDocuments(filter),
  ]);

  return {
    clients: clients.map(serializeClient),
    pagination: buildPaginationMeta(page, limit, total),
  };
}

// ── Creazione ─────────────────────────────────────────────────────────────────

export async function createClient(ownerUserId, data) {
  // Pre-check esplicito sull'unicità del nome: fornisce un errore specifico del dominio
  // invece di far emergere l'errore grezzo di chiave duplicata MongoDB.
  const existing = await Client.findOne({ ownerUserId, name: data.name }).lean();
  if (existing) {
    throw new ConflictError(`Esiste già un cliente chiamato "${data.name}".`, { scope: 'clients' });
  }

  const client = await Client.create({ ownerUserId, ...data });
  return serializeClient(client.toObject());
}

// ── Recupero per id ───────────────────────────────────────────────────────────

export async function getClientById(ownerUserId, clientId) {
  // ownerUserId nel filtro impone l'ownership: un id errato restituisce 404,
  // senza rivelare mai che la risorsa esiste sotto un altro owner.
  const client = await Client.findOne({ _id: clientId, ownerUserId }).lean();
  if (!client) {
    throw new NotFoundError('Cliente non trovato.', { scope: 'clients' });
  }
  return serializeClient(client);
}

// ── Aggiornamento ─────────────────────────────────────────────────────────────

export async function updateClient(ownerUserId, clientId, data) {
  const shouldInvalidateCustomMetricCache =
    Object.prototype.hasOwnProperty.call(data, 'customMetricsConfig');

  if (data.name) {
    // $ne esclude il client rinominato, così "rinomina con lo stesso nome" non è un errore.
    const nameConflict = await Client.findOne({
      ownerUserId,
      name: data.name,
      _id: { $ne: clientId },
    }).lean();
    if (nameConflict) {
      throw new ConflictError(`Esiste già un cliente chiamato "${data.name}".`, { scope: 'clients' });
    }
  }

  // Ownership applicata atomicamente nella query: non serve una findById separata.
  const client = await Client.findOneAndUpdate(
    { _id: clientId, ownerUserId },
    { $set: data },
    { new: true, runValidators: true }
  ).lean();

  if (!client) {
    throw new NotFoundError('Cliente non trovato.', { scope: 'clients' });
  }

  if (shouldInvalidateCustomMetricCache) {
    await invalidateByProvider(clientId, 'custom_metric');
  }

  return serializeClient(client);
}

// ── Eliminazione ──────────────────────────────────────────────────────────────

export async function deleteClient(ownerUserId, clientId) {
  const deleted = await Client.findOneAndDelete({ _id: clientId, ownerUserId });
  if (!deleted) {
    throw new NotFoundError('Cliente non trovato.', { scope: 'clients' });
  }
}
