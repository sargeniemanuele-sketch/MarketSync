import {
  ArrowUpAZ,
  Building2,
  ExternalLink,
  FileText,
  Globe2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/ui/Badge.jsx";
import BackButton from "../components/ui/BackButton.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import Input from "../components/ui/Input.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import useAppData from "../hooks/useAppData.js";
import useClients from "../hooks/useClients.js";
import { APP_ROUTES, PROVIDER_KEYS, PROVIDERS } from "../utils/constants.js";

const providerKeys = [PROVIDER_KEYS.shopify, PROVIDER_KEYS.meta_ads, PROVIDER_KEYS.google_ads];

const integrationStatusLabels = {
  connected: "Connesso",
  disconnected: "Disconnesso",
  error: "Errore",
  expired: "Scaduto",
  incomplete: "Incompleto",
  needs_account_selection: "Seleziona account",
  needs_reauth: "Ricollega",
  not_connected: "Non connesso",
};

const initialCreateForm = {
  contactEmail: "",
  name: "",
  notes: "",
  website: "",
};

function optionalText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeWebsite(value) {
  const trimmed = optionalText(value);

  if (!trimmed) {
    return null;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getWebsiteLink(value) {
  const trimmed = optionalText(value);

  if (!trimmed) {
    return null;
  }

  return {
    href: normalizeWebsite(trimmed),
    label: trimmed.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
  };
}

function validateCreateForm(form) {
  const errors = {};
  const name = optionalText(form.name);
  const email = optionalText(form.contactEmail);
  const website = normalizeWebsite(form.website);

  if (!name) {
    errors.name = "Il nome cliente e obbligatorio.";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.contactEmail = "Inserisci un indirizzo email valido.";
  }

  if (website) {
    try {
      const url = new URL(website);

      if (!["http:", "https:"].includes(url.protocol)) {
        errors.website = "Usa un URL con http:// o https://.";
      }
    } catch {
      errors.website = "Inserisci un URL valido.";
    }
  }

  return errors;
}

function buildCreatePayload(form) {
  return {
    contactEmail: optionalText(form.contactEmail),
    name: optionalText(form.name),
    notes: optionalText(form.notes),
    website: normalizeWebsite(form.website),
  };
}

function getSearchText(client) {
  return [client.name, client.contactEmail, client.website]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function ProviderBadges({ integrations = {} }) {
  return (
    <div className="flex flex-wrap gap-2">
      {providerKeys.map((providerKey) => {
        const integration = integrations?.[providerKey];
        const status = integration?.status || "not_connected";

        return (
          <Badge key={providerKey} status={status}>
            {PROVIDERS[providerKey].label}: {integrationStatusLabels[status] ?? status}
          </Badge>
        );
      })}
    </div>
  );
}

function CreateClientPanel({
  createError,
  form,
  formErrors,
  isCreating,
  onCancel,
  onChange,
  onSubmit,
}) {
  return (
    <Card>
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Nuovo cliente</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Crea l'anagrafica cliente per centralizzare dashboard e impostazioni.
            </p>
          </div>
          <Button disabled={isCreating} onClick={onCancel} type="button" variant="ghost">
            <X className="h-4 w-4" aria-hidden="true" />
            Chiudi
          </Button>
        </div>

        {createError ? <ErrorMessage message={createError} title="Creazione non riuscita" /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            autoComplete="organization"
            disabled={isCreating}
            error={formErrors.name}
            id="client-create-name"
            label="Nome cliente"
            onChange={onChange}
            placeholder="Es. Rossi Store"
            required
            value={form.name}
          />
          <Input
            autoComplete="email"
            disabled={isCreating}
            error={formErrors.contactEmail}
            id="client-create-contactEmail"
            label="Email referente"
            onChange={onChange}
            placeholder="referente@azienda.it"
            type="email"
            value={form.contactEmail}
          />
          <Input
            autoComplete="url"
            disabled={isCreating}
            error={formErrors.website}
            helpText="Se manca il protocollo verra usato https://."
            id="client-create-website"
            label="Sito web"
            onChange={onChange}
            placeholder="https://azienda.it"
            value={form.website}
          />
          <label className="block md:col-span-2" htmlFor="client-create-notes">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Note</span>
            <textarea
              className="ms-textarea block min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-400 dark:focus:ring-brand-500/30 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
              disabled={isCreating}
              id="client-create-notes"
              maxLength={500}
              onChange={onChange}
              placeholder="Contesto operativo, referente, note interne"
              value={form.notes}
            />
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={isCreating} onClick={onCancel} type="button" variant="secondary">
            Annulla
          </Button>
          <Button disabled={isCreating} isLoading={isCreating} type="submit">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Crea cliente
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function ClientsPage() {
  const {
    clients,
    createClient,
    error,
    isCreating,
    isLoading,
    meta,
    refreshClients,
  } = useClients();
  const {
    clients: bootstrapClients,
  } = useAppData();
  const [createError, setCreateError] = useState(null);
  const [form, setForm] = useState(initialCreateForm);
  const [formErrors, setFormErrors] = useState({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const bootstrapById = useMemo(
    () => new Map(bootstrapClients.map((client) => [client.id, client])),
    [bootstrapClients],
  );

  const displayedClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clients
      .map((client) => ({
        ...client,
        integrations: bootstrapById.get(client.id)?.integrations ?? client.integrations,
      }))
      .filter((client) => !query || getSearchText(client).includes(query))
      .sort((first, second) =>
        String(first.name ?? "").localeCompare(String(second.name ?? ""), "it", {
          sensitivity: "base",
        }),
      );
  }, [bootstrapById, clients, search]);

  const totalClients = meta?.pagination?.total ?? clients.length;

  function handleCreateChange(event) {
    const { id, value } = event.target;
    const field = id.replace("client-create-", "");

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setFormErrors((current) => ({
      ...current,
      [field]: null,
    }));
  }

  function closeCreatePanel() {
    setIsCreateOpen(false);
    setCreateError(null);
    setFormErrors({});
    setForm(initialCreateForm);
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();
    const nextErrors = validateCreateForm(form);

    setFormErrors(nextErrors);
    setCreateError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await createClient(buildCreatePayload(form));
      closeCreatePanel();
    } catch (createClientError) {
      setCreateError(createClientError.message || "Creazione cliente non riuscita.");
    }
  }

  return (
    <div className="ms-page-stack space-y-6">
      <PageHeader
        actions={
          <>
            <BackButton fallbackTo={APP_ROUTES.dashboard} />
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuovo cliente
            </Button>
          </>
        }
        description="Anagrafiche clienti sincronizzate con dashboard, integrazioni e selezione globale."
        eyebrow="Workspace"
        meta={
          <>
            <Badge tone="neutral">{totalClients} clienti</Badge>
            <Badge tone="neutral">
              <ArrowUpAZ className="mr-1 h-3 w-3" aria-hidden="true" />
              A-Z
            </Badge>
          </>
        }
        title="Clienti"
      />

      {isCreateOpen ? (
        <CreateClientPanel
          createError={createError}
          form={form}
          formErrors={formErrors}
          isCreating={isCreating}
          onCancel={closeCreatePanel}
          onChange={handleCreateChange}
          onSubmit={handleCreateSubmit}
        />
      ) : null}

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <Input
            id="clients-search"
            label="Cerca cliente"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, email o sito"
            value={search}
          />
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>{displayedClients.length} risultati visibili</span>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Card>
          <Spinner label="Caricamento clienti" />
        </Card>
      ) : null}

      {!isLoading && error ? (
        <div className="space-y-4">
          <ErrorMessage message={error} title="Clienti non disponibili" />
          <Button onClick={refreshClients} variant="secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Riprova
          </Button>
        </div>
      ) : null}

      {!isLoading && !error && clients.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Crea il primo cliente
            </Button>
          }
          description="Aggiungi un cliente per iniziare a vedere dashboard e integrazioni."
          icon={Users}
          title="Nessun cliente"
        />
      ) : null}

      {!isLoading && !error && clients.length > 0 && displayedClients.length === 0 ? (
        <EmptyState
          description="La ricerca corrente non corrisponde ad alcun cliente."
          icon={Search}
          title="Nessun risultato"
        />
      ) : null}

      {!isLoading && !error && displayedClients.length > 0 ? (
        <div className="ms-card-grid grid gap-4">
          {displayedClients.map((client) => {
            const connectedCount = providerKeys.filter(
              (providerKey) => client.integrations?.[providerKey]?.connected,
            ).length;
            const contactEmail = optionalText(client.contactEmail);
            const websiteLink = getWebsiteLink(client.website);
            const notes = optionalText(client.notes);
            const hasOptionalDetails = contactEmail || websiteLink || notes;

            return (
              <Card className="p-4" key={client.id}>
                <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                        <Building2 className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-slate-950 dark:text-slate-50">{client.name}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {connectedCount} di {providerKeys.length} provider connessi
                        </p>
                      </div>
                    </div>

                    {hasOptionalDetails ? (
                      <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {contactEmail ? (
                            <div className="flex min-w-0 max-w-full items-center gap-2">
                              <Mail className="h-4 w-4 flex-none text-slate-400 dark:text-slate-500" aria-hidden="true" />
                              <span className="truncate">{contactEmail}</span>
                            </div>
                          ) : null}

                          {websiteLink ? (
                            <a
                              className="flex min-w-0 max-w-full items-center gap-2 text-brand-700 transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 dark:text-brand-300 dark:hover:text-brand-200 dark:focus-visible:ring-brand-500/40"
                              href={websiteLink.href}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <Globe2 className="h-4 w-4 flex-none text-slate-400 dark:text-slate-500" aria-hidden="true" />
                              <span className="truncate">{websiteLink.label}</span>
                              <ExternalLink className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>

                        {notes ? (
                          <div className="flex min-w-0 items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 flex-none text-slate-400 dark:text-slate-500" aria-hidden="true" />
                            <p className="line-clamp-2 min-w-0">{notes}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <ProviderBadges integrations={client.integrations} />
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Button
                      as={Link}
                      to={APP_ROUTES.integrations}
                      variant="secondary"
                    >
                      <Settings2 className="h-4 w-4" aria-hidden="true" />
                      Integrazioni
                    </Button>
                    <Button
                      as={Link}
                      to={`${APP_ROUTES.clients}/${client.id}`}
                      variant="primary"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Dettaglio
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
