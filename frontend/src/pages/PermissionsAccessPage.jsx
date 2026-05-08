import { ArrowRight, KeyRound, LockKeyhole, Plug, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import ClientSelector from "../components/dashboard/ClientSelector.jsx";
import ProviderIcon from "../components/providers/ProviderIcon.jsx";
import Badge from "../components/ui/Badge.jsx";
import BackButton from "../components/ui/BackButton.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import useAppData from "../hooks/useAppData.js";
import { APP_ROUTES, PROVIDER_KEYS } from "../utils/constants.js";

const providerItems = [
  {
    dataRead: "Ordini, vendite, clienti, prodotti e metriche e-commerce disponibili.",
    key: PROVIDER_KEYS.shopify,
    name: "Shopify",
    notModified: "Prodotti, prezzi, ordini, temi, configurazioni store.",
  },
  {
    dataRead: "Spesa, ROAS, acquisti, conversion value, CPC, CPM, CTR e metriche campagne.",
    key: PROVIDER_KEYS.meta_ads,
    name: "Meta Ads",
    notModified: "Campagne, gruppi inserzioni, annunci, budget o creativita.",
  },
  {
    dataRead: "Costo, conversioni, ROAS, click, impression, CTR, CPA e metriche pubblicitarie.",
    key: PROVIDER_KEYS.google_ads,
    name: "Google Ads",
    notModified: "Campagne, gruppi annunci, annunci, keyword, budget o impostazioni account.",
  },
];

const statusConfig = {
  connected: { label: "Collegato", tone: "success" },
  disconnected: { label: "Non collegato", tone: "neutral" },
  error: { label: "Errore", tone: "danger" },
  expired: { label: "Da ricollegare", tone: "warning" },
  incomplete: { label: "Da ricollegare", tone: "warning" },
  needs_account_selection: { label: "Da ricollegare", tone: "warning" },
  needs_reauth: { label: "Da ricollegare", tone: "warning" },
  not_connected: { label: "Non collegato", tone: "neutral" },
};

function InfoBlock({ children, description, icon: Icon, title }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? <div className="ms-setting-body mt-6">{children}</div> : null}
    </Card>
  );
}

function ProviderAccessCard({ provider }) {
  return (
    <div className="ms-panel rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-3">
        <ProviderIcon providerLogoKey={provider.key} size="lg" />
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-950 dark:text-slate-50">{provider.name}</h3>
          <Badge className="mt-2" tone="success">
            Solo lettura
          </Badge>
        </div>
      </div>
      <dl className="mt-4 space-y-4 text-sm">
        <div>
          <dt className="font-medium text-slate-950 dark:text-slate-100">Dati letti</dt>
          <dd className="mt-1 leading-6 text-slate-600 dark:text-slate-300">{provider.dataRead}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-950 dark:text-slate-100">Non modifica</dt>
          <dd className="mt-1 leading-6 text-slate-600 dark:text-slate-300">{provider.notModified}</dd>
        </div>
      </dl>
    </div>
  );
}

function getAccessStatus(integration) {
  const status = integration?.status ?? "not_connected";

  if (integration?.connected || status === "connected") {
    return statusConfig.connected;
  }

  return statusConfig[status] ?? statusConfig.not_connected;
}

function ProviderStatusRow({ integration, provider }) {
  const status = getAccessStatus(integration);

  return (
    <div className="ms-panel flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex min-w-0 items-center gap-3">
        <ProviderIcon providerLogoKey={provider.key} size="md" />
        <span className="font-medium text-slate-900 dark:text-slate-100">{provider.name}</span>
      </div>
      <Badge tone={status.tone}>{status.label}</Badge>
    </div>
  );
}

export default function PermissionsAccessPage() {
  const {
    bootstrapError,
    isBootstrapLoading,
    selectedClient,
    selectedClientIntegrations,
  } = useAppData();

  return (
    <div className="ms-page-stack max-w-6xl space-y-8">
      <PageHeader
        actions={
          <BackButton label="Torna alle impostazioni" to={APP_ROUTES.settings} />
        }
        description="Controlla come MarketSync usa i collegamenti alle piattaforme."
        meta={selectedClient ? <Badge tone="neutral">{selectedClient.name}</Badge> : null}
        title="Permessi e accessi"
      />

      <InfoBlock
        description="MarketSync usa accessi in sola lettura per recuperare KPI e metriche. Non modifica campagne, budget, annunci, prodotti, configurazioni o asset delle piattaforme collegate."
        icon={ShieldCheck}
        title="Accesso in sola lettura"
      />

      <InfoBlock
        description="Ogni piattaforma viene usata solo per leggere i dati necessari alla dashboard."
        icon={KeyRound}
        title="Piattaforme collegate"
      >
        <div className="ms-card-grid grid gap-4 lg:grid-cols-3">
          {providerItems.map((provider) => (
            <ProviderAccessCard key={provider.key} provider={provider} />
          ))}
        </div>
      </InfoBlock>

      <InfoBlock
        description="Stato del cliente selezionato, basato sui dati gia disponibili nell'app."
        icon={Plug}
        title="Stato collegamenti"
      >
        <div className="ms-section space-y-4">
          <ClientSelector id="permissions-access-client-selector" />

          {isBootstrapLoading ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Caricamento stato collegamenti.
            </p>
          ) : null}

          {!isBootstrapLoading && bootstrapError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200">
              Impossibile caricare lo stato dei collegamenti.
            </p>
          ) : null}

          {!isBootstrapLoading && !bootstrapError && selectedClient ? (
            <div className="ms-card-grid grid gap-3 md:grid-cols-3">
              {providerItems.map((provider) => (
                <ProviderStatusRow
                  integration={selectedClientIntegrations?.[provider.key]}
                  key={provider.key}
                  provider={provider}
                />
              ))}
            </div>
          ) : null}

          {!isBootstrapLoading && !bootstrapError && !selectedClient ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Seleziona un cliente per vedere lo stato dei collegamenti.
            </p>
          ) : null}
        </div>
      </InfoBlock>

      <InfoBlock
        description="Per collegare o scollegare una piattaforma, usa la sezione dedicata del cliente selezionato."
        icon={LockKeyhole}
        title="Gestione accessi"
      >
        <Button as={Link} to={APP_ROUTES.integrations} variant="secondary">
          Apri integrazioni
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </InfoBlock>
    </div>
  );
}
