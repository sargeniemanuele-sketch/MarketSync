import {
  Building2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BusinessSettingsPanel from "../components/clients/BusinessSettingsPanel.jsx";
import Badge from "../components/ui/Badge.jsx";
import BackButton from "../components/ui/BackButton.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ConfirmModal from "../components/ui/ConfirmModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import Input from "../components/ui/Input.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import SaveButton from "../components/ui/SaveButton.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import useClientDetail from "../hooks/useClientDetail.js";
import { APP_ROUTES } from "../utils/constants.js";
import { formatDateTime } from "../utils/formatters.js";

const initialForm = {
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

function clientToForm(client) {
  return {
    contactEmail: client?.contactEmail ?? "",
    name: client?.name ?? "",
    notes: client?.notes ?? "",
    website: client?.website ?? "",
  };
}

function validateForm(form) {
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

function buildUpdatePayload(form) {
  return {
    contactEmail: optionalText(form.contactEmail),
    name: optionalText(form.name),
    notes: optionalText(form.notes),
    website: normalizeWebsite(form.website),
  };
}

export default function ClientDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const {
    client,
    deleteClient,
    deleteError,
    error,
    isDeleting,
    isLoading,
    isSaving,
    loadClient,
    saveError,
    updateClient,
  } = useClientDetail(clientId);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (client) {
      const nextForm = clientToForm(client);

      setForm(nextForm);
      setFormErrors({});
    }
  }, [client]);

  const pageTitle = client?.name || "Dettaglio cliente";
  const customMetricCount = useMemo(
    () => (Array.isArray(client?.customMetricsConfig) ? client.customMetricsConfig.length : 0),
    [client],
  );

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setFormErrors((current) => ({
      ...current,
      [field]: null,
    }));
    setSuccessMessage(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateForm(form);

    setFormErrors(nextErrors);
    setSuccessMessage(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await updateClient(buildUpdatePayload(form));
      setSuccessMessage("Cliente aggiornato correttamente.");
    } catch {
      setSuccessMessage(null);
    }
  }

  async function handleDelete() {
    try {
      await deleteClient();
      navigate(APP_ROUTES.clients);
    } catch {
      setIsDeleteOpen(false);
    }
  }

  return (
    <div className="ms-page-stack space-y-6">
      <PageHeader
        actions={
          <BackButton fallbackTo={APP_ROUTES.clients} />
        }
        description="Modifica il profilo e le note del cliente."
        eyebrow="Cliente"
        meta={
          client ? (
            <>
              <Badge tone="neutral">Creato: {formatDateTime(client.createdAt)}</Badge>
              <Badge tone="neutral">Aggiornato: {formatDateTime(client.updatedAt)}</Badge>
              <Badge tone="neutral">{customMetricCount} metriche custom configurate</Badge>
            </>
          ) : null
        }
        title={pageTitle}
      />

      {isLoading ? (
        <Card>
          <Spinner label="Caricamento dettaglio cliente" />
        </Card>
      ) : null}

      {!isLoading && error ? (
        <div className="space-y-4">
          <ErrorMessage message={error} title="Cliente non disponibile" />
          <Button onClick={loadClient} variant="secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Riprova
          </Button>
        </div>
      ) : null}

      {!isLoading && !error && !client ? (
        <EmptyState
          action={
            <Button as={Link} to={APP_ROUTES.clients} variant="secondary">
              Vai ai clienti
            </Button>
          }
          icon={Building2}
          title="Cliente non trovato"
          description="Questo cliente non è stato trovato. Potrebbe essere stato eliminato o il link non è più valido."
        />
      ) : null}

      {!isLoading && !error && client ? (
        <>
          <form className="ms-form-stack space-y-6" onSubmit={handleSubmit}>
            <Card>
              <div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Profilo cliente</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Informazioni principali del cliente, visibili nelle dashboard.
                  </p>
                </div>
              </div>

              {saveError ? (
                <ErrorMessage className="mt-5" message={saveError} title="Salvataggio non riuscito" />
              ) : null}

              {successMessage ? (
                <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
                  {successMessage}
                </div>
              ) : null}

              <div className="ms-card-grid mt-6 grid gap-4 md:grid-cols-2">
                <Input
                  autoComplete="organization"
                  disabled={isSaving}
                  error={formErrors.name}
                  id="client-name"
                  label="Nome cliente"
                  onChange={(event) => updateField("name", event.target.value)}
                  required
                  value={form.name}
                />
                <Input
                  autoComplete="email"
                  disabled={isSaving}
                  error={formErrors.contactEmail}
                  id="client-contactEmail"
                  label="Email referente"
                  onChange={(event) => updateField("contactEmail", event.target.value)}
                  type="email"
                  value={form.contactEmail}
                />
                <Input
                  autoComplete="url"
                  disabled={isSaving}
                  error={formErrors.website}
                  helpText="Inserisci l'URL del sito, anche senza https://"
                  id="client-website"
                  label="Sito web"
                  onChange={(event) => updateField("website", event.target.value)}
                  value={form.website}
                />
                <label className="ms-field block md:col-span-2" htmlFor="client-notes">
                  <span className="ms-field-label mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Note</span>
                  <textarea
                    className="ms-textarea block min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-400 dark:focus:ring-brand-500/30 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                    disabled={isSaving}
                    id="client-notes"
                    maxLength={500}
                    onChange={(event) => updateField("notes", event.target.value)}
                    value={form.notes}
                  />
                </label>
              </div>

              <div className="mt-6 flex justify-end">
                <SaveButton
                  className="w-full sm:w-auto"
                  disabled={isSaving}
                  loading={isSaving}
                  type="submit"
                />
              </div>
            </Card>
          </form>

          <BusinessSettingsPanel
            client={client}
            clientId={clientId}
            onSaved={loadClient}
          />

          <Card className="border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/15">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-rose-950 dark:text-rose-100">Elimina cliente</h2>
                <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
                  Questa operazione rimuove il cliente e tutti i dati associati in modo definitivo.
                </p>
              </div>
              <Button
                disabled={isDeleting}
                isLoading={isDeleting}
                onClick={() => setIsDeleteOpen(true)}
                variant="danger"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Elimina cliente
              </Button>
            </div>
            {deleteError ? (
              <ErrorMessage className="mt-5" message={deleteError} title="Eliminazione non riuscita" />
            ) : null}
          </Card>
        </>
      ) : null}

      <ConfirmModal
        confirmLabel="Elimina cliente"
        description={`Confermi l'eliminazione di "${client?.name ?? "questo cliente"}"? Questa azione è definitiva e non può essere annullata.`}
        isOpen={isDeleteOpen}
        isSubmitting={isDeleting}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Eliminare cliente"
        variant="danger"
      />
    </div>
  );
}
