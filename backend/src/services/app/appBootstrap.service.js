import Client from '../../models/Client.js';
import Integration from '../../models/Integration.js';
import DashboardPreference from '../../models/DashboardPreference.js';

const PROVIDERS = ['shopify', 'meta_ads', 'google_ads'];

function defaultIntegration() {
  return { connected: false, status: 'not_connected', lastSyncAt: null };
}

export async function getBootstrapData(userId) {
  // Esegue fetch preferenze e fetch client in parallelo: query indipendenti.
  const [pref, clients] = await Promise.all([
    DashboardPreference.findOne({ userId }).lean(),
    Client.find({ ownerUserId: userId }).sort({ name: 1 }).select('_id name').lean(),
  ]);

  if (clients.length === 0) {
    return { lastSelectedClientId: null, clients: [] };
  }

  const clientIds = clients.map((c) => c._id);

  // Singola query per tutte le integrazioni di tutti i client: evita N+1.
  // Seleziona solo i campi necessari alla struttura di bootstrap.
  const integrations = await Integration.find({ clientId: { $in: clientIds } })
    .select('clientId provider status lastSyncAt')
    .lean();

  // Raggruppa le integrazioni per stringa clientId per lookup O(1) durante il mapping.
  const byClient = {};
  for (const intg of integrations) {
    const key = intg.clientId.toString();
    if (!byClient[key]) byClient[key] = [];
    byClient[key].push(intg);
  }

  const clientSummaries = clients.map((c) => {
    const clientKey = c._id.toString();
    const clientIntegrations = byClient[clientKey] ?? [];

    // Parte dai default per tutti e tre i provider.
    const integrationsMap = Object.fromEntries(PROVIDERS.map((p) => [p, defaultIntegration()]));

    // Sovrascrive con dati reali dove esiste un record integrazione.
    // externalRef, credentials, lastError sono esclusi intenzionalmente.
    for (const intg of clientIntegrations) {
      integrationsMap[intg.provider] = {
        connected: intg.status === 'connected',
        status: intg.status,
        lastSyncAt: intg.lastSyncAt ?? null,
      };
    }

    return {
      id: clientKey,
      name: c.name,
      integrations: integrationsMap,
    };
  });

  // Valida lastSelectedClientId rispetto alla lista client effettiva.
  // Se l'id salvato non appartiene più a questo utente (client eliminato, ecc.) → null.
  const clientIdSet = new Set(clientIds.map((id) => id.toString()));
  const storedLastId = pref?.lastSelectedClientId?.toString() ?? null;
  const lastSelectedClientId =
    storedLastId && clientIdSet.has(storedLastId) ? storedLastId : null;

  return { lastSelectedClientId, clients: clientSummaries };
}
