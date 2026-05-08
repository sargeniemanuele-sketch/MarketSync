import { AlertTriangle, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CustomMetricBuilder from "../components/customMetrics/CustomMetricBuilder.jsx";
import CustomMetricList from "../components/customMetrics/CustomMetricList.jsx";
import Badge from "../components/ui/Badge.jsx";
import BackButton from "../components/ui/BackButton.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ConfirmModal from "../components/ui/ConfirmModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import SaveButton from "../components/ui/SaveButton.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import useAppData from "../hooks/useAppData.js";
import useClientDetail from "../hooks/useClientDetail.js";
import { getApiErrorMessage } from "../api/authApi.js";
import * as clientsApi from "../api/clientsApi.js";
import {
  APP_ROUTES,
  CUSTOM_METRIC_SOURCE_PROVIDERS,
  PROVIDER_KEYS,
  PROVIDERS,
} from "../utils/constants.js";
import { isSourceMetricAllowed } from "../utils/customMetricSourceCatalog.js";

const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SAFE_FORMULA_CHARS = /^[a-zA-Z0-9_.+\-*/() \t\n]+$/;
const FUNCTION_CALL_PATTERN = /[a-zA-Z_]\w*\s*\(/;
const CUSTOM_METRIC_UNITS = ["currency", "number", "percentage", "ratio"];

const directProviderKeys = [
  PROVIDER_KEYS.shopify,
  PROVIDER_KEYS.meta_ads,
  PROVIDER_KEYS.google_ads,
];

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

let variableUiIdCounter = 0;

function createVariableUiId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  variableUiIdCounter += 1;
  return `variable-${Date.now()}-${variableUiIdCounter}`;
}

function createEmptyMetric() {
  return {
    enabled: true,
    formula: "",
    key: "",
    label: "",
    description: "",
    unit: "number",
    providerContext: "mixed",
    variables: [],
  };
}

function optionalText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function toIdentifier(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (!normalized) {
    return "";
  }

  return /^[a-z_]/.test(normalized) ? normalized : `m_${normalized}`;
}

function cloneMetric(metric) {
  return {
    enabled: metric?.enabled !== false,
    formula: metric?.formula ?? "",
    key: metric?.key ?? "",
    label: metric?.label ?? "",
    description: metric?.description ?? "",
    unit: metric?.unit ?? "number",
    providerContext: metric?.providerContext ?? "mixed",
    variables: Array.isArray(metric?.variables)
      ? metric.variables.map((variable) => ({
          _uiId: variable?._uiId ?? createVariableUiId(),
          metricKey: variable?.metricKey ?? "",
          sourceProvider: variable?.sourceProvider ?? PROVIDER_KEYS.shopify,
          variableKey: variable?.variableKey ?? "",
        }))
      : [],
  };
}

function sanitizeMetric(metric) {
  return {
    key: optionalText(metric.key),
    label: optionalText(metric.label),
    description: optionalText(metric.description),
    enabled: metric.enabled !== false,
    unit: metric.unit,
    formula: optionalText(metric.formula),
    providerContext: metric.providerContext,
    variables: (Array.isArray(metric.variables) ? metric.variables : []).map((variable) => ({
      variableKey: optionalText(variable.variableKey),
      sourceProvider: variable.sourceProvider,
      metricKey: optionalText(variable.metricKey),
    })),
  };
}

function validateMetric(metric, metrics, metricIndex) {
  const errors = {};
  const key = optionalText(metric.key);
  const label = optionalText(metric.label);
  const formula = optionalText(metric.formula);
  const description = optionalText(metric.description);
  const variables = Array.isArray(metric.variables) ? metric.variables : [];

  if (!label) {
    errors.label = "Etichetta obbligatoria.";
  }

  if (!key) {
    errors.key = "Identificatore obbligatorio.";
  } else if (!IDENTIFIER_PATTERN.test(key)) {
    errors.key = "Usa solo lettere, numeri e trattini bassi ( _ ). Non iniziare con un numero.";
  } else {
    const duplicateIndex = metrics.findIndex(
      (item, index) => index !== metricIndex && optionalText(item.key) === key,
    );

    if (duplicateIndex >= 0) {
      errors.key = "Esiste già una metrica con questo identificatore.";
    }
  }

  if (!formula) {
    errors.formula = "Formula obbligatoria.";
  } else if (!SAFE_FORMULA_CHARS.test(formula)) {
    errors.formula = "La formula contiene caratteri non supportati.";
  } else if (FUNCTION_CALL_PATTERN.test(formula)) {
    errors.formula = "La formula può usare solo operatori matematici (+, -, *, /) e le variabili definite.";
  }

  if (description && description.length > 500) {
    errors.description = "La descrizione non può superare 500 caratteri.";
  }

  if (metric.enabled !== true && metric.enabled !== false) {
    errors.enabled = "Seleziona se la metrica è attiva o disattiva.";
  }

  if (!CUSTOM_METRIC_UNITS.includes(metric.unit)) {
    errors.unit = "Seleziona un'unità di misura valida.";
  }

  if (variables.length === 0) {
    errors.variables = "Configura almeno una variabile.";
  }

  const seenVariableKeys = new Set();

  variables.forEach((variable, index) => {
    const variableKey = optionalText(variable.variableKey);
    const sourceProvider = variable.sourceProvider;
    const metricKey = optionalText(variable.metricKey);

    if (!variableKey) {
      errors[`variables.${index}.variableKey`] = "Nome variabile obbligatorio.";
    } else if (!IDENTIFIER_PATTERN.test(variableKey)) {
      errors[`variables.${index}.variableKey`] =
        "Usa solo lettere, numeri e trattini bassi ( _ ). Non iniziare con un numero.";
    } else if (seenVariableKeys.has(variableKey)) {
      errors[`variables.${index}.variableKey`] = "Nome variabile duplicato.";
    }

    if (variableKey) {
      seenVariableKeys.add(variableKey);
    }

    if (!CUSTOM_METRIC_SOURCE_PROVIDERS.includes(sourceProvider)) {
      errors[`variables.${index}.sourceProvider`] = "Seleziona una sorgente dati valida.";
    }

    if (!metricKey) {
      errors[`variables.${index}.metricKey`] = "Seleziona la metrica da usare per questa variabile.";
    } else if (!isSourceMetricAllowed(sourceProvider, metricKey)) {
      errors[`variables.${index}.metricKey`] =
        "Seleziona una metrica sorgente valida per questa fonte.";
    }
  });

  return errors;
}

function getProviderStatusTone(status) {
  if (status === "connected") {
    return "success";
  }

  if (["error", "expired", "needs_reauth"].includes(status)) {
    return "warning";
  }

  return "neutral";
}

function ProviderAvailability({ integrations }) {
  const missingProviders = directProviderKeys.filter((providerKey) => {
    const status = integrations?.[providerKey]?.status ?? "not_connected";
    return status !== "connected";
  });

  return (
    <Card className="bg-slate-50 dark:bg-slate-900/80">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Sorgenti dati</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Puoi salvare la configurazione anche se una piattaforma non è collegata. I dati saranno calcolati quando disponibili.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {directProviderKeys.map((providerKey) => {
            const status = integrations?.[providerKey]?.status ?? "not_connected";

            return (
              <Badge key={providerKey} tone={getProviderStatusTone(status)}>
                {PROVIDERS[providerKey].label}: {integrationStatusLabels[status] ?? status}
              </Badge>
            );
          })}
        </div>
      </div>
      {missingProviders.length > 0 ? (
        <div className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          <p>
            Alcune variabili potrebbero non avere dati disponibili se la piattaforma corrispondente non è collegata.
          </p>
        </div>
      ) : null}
    </Card>
  );
}

export default function CustomMetricsPage() {
  const {
    hasClients,
    isBootstrapLoading,
    selectedClient,
    selectedClientId,
    selectedClientIntegrations,
  } = useAppData();
  const {
    client,
    error,
    isLoading,
    isSaving,
    loadClient,
    saveError,
    updateClient,
  } = useClientDetail(selectedClientId, { autoLoad: Boolean(selectedClientId) });
  const [customMetrics, setCustomMetrics] = useState([]);
  const [builderMode, setBuilderMode] = useState(null);
  const [draftErrors, setDraftErrors] = useState({});
  const [draftMetric, setDraftMetric] = useState(createEmptyMetric);
  const [editingIndex, setEditingIndex] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [metricDeleteIndex, setMetricDeleteIndex] = useState(null);
  const [isMutatingMetric, setIsMutatingMetric] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (!client) {
      return;
    }

    setBuilderMode(null);
    setCustomMetrics(
      (Array.isArray(client.customMetricsConfig) ? client.customMetricsConfig : []).map(cloneMetric),
    );
    setDraftErrors({});
    setDraftMetric(createEmptyMetric());
    setEditingIndex(null);
    setLocalError(null);
    setMetricDeleteIndex(null);
    setPreview(null);
    setPreviewError(null);
    setSuccessMessage(null);
  }, [client]);

  const selectedClientName = client?.name ?? selectedClient?.name ?? "Cliente selezionato";
  const activeMetricCount = useMemo(
    () => customMetrics.filter((metric) => metric.enabled !== false).length,
    [customMetrics],
  );

  function openCreateBuilder() {
    setBuilderMode("create");
    setDraftErrors({});
    setDraftMetric(createEmptyMetric());
    setEditingIndex(null);
    setLocalError(null);
    setPreview(null);
    setPreviewError(null);
    setSuccessMessage(null);
  }

  function openEditBuilder(index) {
    setBuilderMode("edit");
    setDraftErrors({});
    setDraftMetric(cloneMetric(customMetrics[index]));
    setEditingIndex(index);
    setLocalError(null);
    setPreview(null);
    setPreviewError(null);
    setSuccessMessage(null);
  }

  function closeBuilder() {
    setBuilderMode(null);
    setDraftErrors({});
    setDraftMetric(createEmptyMetric());
    setEditingIndex(null);
    setPreview(null);
    setPreviewError(null);
  }

  function handleDraftChange(nextMetric) {
    setDraftMetric(nextMetric);
    setDraftErrors({});
    setLocalError(null);
    setPreview(null);
    setPreviewError(null);
    setSuccessMessage(null);
  }

  async function handlePreviewMetric() {
    const preparedMetric = {
      ...draftMetric,
      key: optionalText(draftMetric.key) || toIdentifier(draftMetric.label),
    };
    const errors = validateMetric(
      preparedMetric,
      customMetrics,
      editingIndex ?? customMetrics.length,
    );

    setDraftErrors(errors);
    setPreview(null);
    setPreviewError(null);

    if (Object.keys(errors).length > 0) {
      setPreviewError("Correggi i campi prima di testare la formula.");
      return;
    }

    setPreviewLoading(true);

    try {
      const response = await clientsApi.previewCustomMetric(
        selectedClientId,
        sanitizeMetric(preparedMetric),
        { range: "last_30_days" },
      );
      setPreview(response.preview);
      const warningMessage = response.warnings?.[0]?.message;
      setPreviewError(
        response.preview?.status === "ok"
          ? null
          : warningMessage || "Impossibile calcolare la formula con i dati disponibili per il periodo di test.",
      );
    } catch (error) {
      setPreviewError(getApiErrorMessage(error, "Preview formula non riuscita."));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleBuilderSubmit(event) {
    event.preventDefault();

    const preparedMetric = {
      ...draftMetric,
      key: optionalText(draftMetric.key) || toIdentifier(draftMetric.label),
    };
    const nextMetrics =
      builderMode === "edit" && editingIndex !== null
        ? customMetrics.map((metric, index) => (index === editingIndex ? preparedMetric : metric))
        : [...customMetrics, preparedMetric];
    const nextErrors = validateMetric(
      preparedMetric,
      nextMetrics,
      builderMode === "edit" && editingIndex !== null ? editingIndex : nextMetrics.length - 1,
    );

    setDraftErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setLocalError("Correggi i campi della metrica custom prima di aggiungerla.");
      return;
    }

    setIsMutatingMetric(true);
    try {
      const payload = sanitizeMetric(preparedMetric);
      if (builderMode === "edit" && editingIndex !== null) {
        const previousKey = customMetrics[editingIndex]?.key;
        await clientsApi.updateCustomMetric(selectedClientId, previousKey, payload);
        setSuccessMessage("Metrica custom aggiornata.");
      } else {
        await clientsApi.createCustomMetric(selectedClientId, payload);
        setSuccessMessage("Metrica custom creata.");
      }

      setCustomMetrics(nextMetrics);
      setLocalError(null);
      closeBuilder();
      await loadClient();
    } catch (submitError) {
      setSuccessMessage(null);
      setLocalError(getApiErrorMessage(submitError, "Salvataggio metrica custom non riuscito."));
    } finally {
      setIsMutatingMetric(false);
    }
  }

  async function confirmMetricDelete() {
    if (metricDeleteIndex === null) {
      return;
    }

    const metricKey = customMetrics[metricDeleteIndex]?.key;
    setIsMutatingMetric(true);
    try {
      await clientsApi.deleteCustomMetric(selectedClientId, metricKey);
      setCustomMetrics((current) =>
        current.filter((_, index) => index !== metricDeleteIndex),
      );
      setMetricDeleteIndex(null);
      setLocalError(null);
      setSuccessMessage("Metrica custom eliminata.");
      await loadClient();
    } catch (deleteError) {
      setSuccessMessage(null);
      setLocalError(getApiErrorMessage(deleteError, "Eliminazione metrica custom non riuscita."));
    } finally {
      setIsMutatingMetric(false);
    }
  }

  function validateAllMetrics() {
    for (let index = 0; index < customMetrics.length; index += 1) {
      const metric = {
        ...customMetrics[index],
        key: optionalText(customMetrics[index].key) || toIdentifier(customMetrics[index].label),
      };
      const errors = validateMetric(metric, customMetrics, index);

      if (Object.keys(errors).length > 0) {
        setBuilderMode("edit");
        setDraftErrors(errors);
        setDraftMetric(metric);
        setEditingIndex(index);
        return false;
      }
    }

    return true;
  }

  async function handleSave() {
    setLocalError(null);
    setSuccessMessage(null);

    if (!validateAllMetrics()) {
      setLocalError("Correggi gli errori nella metrica evidenziata prima di salvare.");
      return;
    }

    try {
      await updateClient({
        customMetricsConfig: customMetrics.map((metric) => sanitizeMetric({
          ...metric,
          key: optionalText(metric.key) || toIdentifier(metric.label),
        })),
      });
      setSuccessMessage("Configurazione metriche custom salvata correttamente.");
    } catch {
      setSuccessMessage(null);
    }
  }

  if (isBootstrapLoading && !selectedClientId) {
    return (
      <Card>
        <Spinner label="Caricamento dati applicazione" />
      </Card>
    );
  }

  if (!selectedClientId) {
    return (
        <div className="ms-page-stack space-y-6">
        <PageHeader
          actions={<BackButton fallbackTo={APP_ROUTES.dashboard} />}
          description="Seleziona o crea un cliente per configurare metriche custom."
          eyebrow="Metriche personalizzate"
          title="Metriche Custom"
        />
        <EmptyState
          action={
            <Button as={Link} to={APP_ROUTES.clients}>
              {hasClients ? "Vai ai clienti" : "Crea cliente"}
            </Button>
          }
          icon={SlidersHorizontal}
          title={hasClients ? "Nessun cliente selezionato" : "Nessun cliente disponibile"}
          description={
            hasClients
              ? "La configurazione è specifica per ogni cliente."
              : "Aggiungi un cliente prima di creare metriche custom."
          }
        />
      </div>
    );
  }

  return (
    <div className="ms-page-stack space-y-6">
      <PageHeader
        actions={
          <>
            <BackButton fallbackTo={APP_ROUTES.dashboard} />
            <Button disabled={isLoading || isSaving || isMutatingMetric} onClick={loadClient} variant="secondary">
              <RefreshCw
                className={["h-4 w-4", isLoading ? "animate-spin" : ""].join(" ")}
                aria-hidden="true"
              />
              Aggiorna
            </Button>
          </>
        }
        description="Configura formule, variabili e informazioni delle metriche del cliente selezionato."
        eyebrow="Metriche personalizzate"
        meta={
          <>
            <Badge tone="neutral">{selectedClientName}</Badge>
            <Badge tone="success">{activeMetricCount} metriche attive</Badge>
            <Badge tone="neutral">{customMetrics.length} totali</Badge>
          </>
        }
        title="Metriche Custom"
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

      {!isLoading && !error && client ? (
        <>
          <Card className="bg-cyan-50 dark:border-cyan-500/30 dark:bg-cyan-500/15">
            <div className="flex gap-3 text-sm text-cyan-900 dark:text-cyan-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <p>
                La configurazione viene salvata. I calcoli avvengono automaticamente all'apertura della dashboard.
              </p>
            </div>
          </Card>

          <ProviderAvailability integrations={selectedClientIntegrations} />

          {localError ? <ErrorMessage message={localError} title="Validazione non riuscita" /> : null}
          {saveError ? <ErrorMessage message={saveError} title="Salvataggio non riuscito" /> : null}
          {successMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
              {successMessage}
            </div>
          ) : null}

          {builderMode ? (
            <Card>
              <CustomMetricBuilder
                disabled={isSaving || isMutatingMetric}
                errors={draftErrors}
                mode={builderMode}
                onCancel={closeBuilder}
                onChange={handleDraftChange}
                onPreview={handlePreviewMetric}
                onSubmit={handleBuilderSubmit}
                preview={preview}
                previewError={previewError}
                previewLoading={previewLoading}
                value={draftMetric}
              />
            </Card>
          ) : null}

          <Card>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Metriche configurate</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Tutte le metriche custom del cliente, incluse quelle abilitate e disabilitate.
                </p>
              </div>
              <Button disabled={isSaving || isMutatingMetric || Boolean(builderMode)} onClick={openCreateBuilder}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nuova metrica
              </Button>
            </div>

            <CustomMetricList
              isDisabled={isSaving || isMutatingMetric}
              metrics={customMetrics}
              onAdd={openCreateBuilder}
              onDelete={setMetricDeleteIndex}
              onEdit={openEditBuilder}
            />
          </Card>

          <div className="flex justify-end">
            <SaveButton
              className="w-full sm:w-auto"
              disabled={isLoading || isSaving || !client}
              label="Salva configurazione"
              loading={isSaving}
              onClick={handleSave}
            />
          </div>
        </>
      ) : null}

      <ConfirmModal
        confirmLabel="Elimina metrica"
        description="La metrica verra eliminata dalle metriche custom del cliente."
        isOpen={metricDeleteIndex !== null}
        isSubmitting={isSaving || isMutatingMetric}
        onCancel={() => setMetricDeleteIndex(null)}
        onConfirm={confirmMetricDelete}
        title="Eliminare metrica custom"
        variant="danger"
      />
    </div>
  );
}
