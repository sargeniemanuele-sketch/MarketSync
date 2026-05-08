import {
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import Badge from "../components/ui/Badge.jsx";
import BackButton from "../components/ui/BackButton.jsx";
import Card from "../components/ui/Card.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import SaveButton from "../components/ui/SaveButton.jsx";
import Select from "../components/ui/Select.jsx";
import useAppData from "../hooks/useAppData.js";
import { APP_ROUTES } from "../utils/constants.js";
import {
  DASHBOARD_START_PAGES,
  LAST_SELECTED_CLIENT,
  MAX_CUSTOM_METRICS,
  MAX_KPIS_PER_PROVIDER,
  providerKpiConfig,
  providerOrder,
  readDashboardPreferences,
  writeDashboardPreferences,
} from "../utils/dashboardPreferences.js";

const periodOptions = [
  { label: "Oggi", value: "today" },
  { label: "Ieri", value: "yesterday" },
  { label: "Ultimi 7 giorni", value: "last_7_days" },
  { label: "Ultimi 14 giorni", value: "last_14_days" },
  { label: "Ultimi 30 giorni", value: "last_30_days" },
];

const startPageOptions = [
  { label: "Dashboard", value: DASHBOARD_START_PAGES.dashboard },
  { label: "Shopify", value: DASHBOARD_START_PAGES.shopify },
  { label: "Meta Ads", value: DASHBOARD_START_PAGES.meta_ads },
  { label: "Google Ads", value: DASHBOARD_START_PAGES.google_ads },
  { label: "Clienti", value: DASHBOARD_START_PAGES.clients },
];

function Notice({ message }) {
  if (!message) {
    return null;
  }

  const isSuccess = message.type === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={[
        "rounded-md border p-4",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
      ].join(" ")}
      role={isSuccess ? "status" : "alert"}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
        <p className="text-sm font-medium">{message.text}</p>
      </div>
    </div>
  );
}

function ToggleField({ checked, label, onChange }) {
  return (
    <label className="ms-panel flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        checked={checked}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600 dark:border-slate-600 dark:bg-slate-900"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function ProviderKpiBlock({ config, onToggle, providerKey, selectedKpis }) {
  const selectedCount = selectedKpis.length;

  return (
    <div className="ms-panel rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">{config.label}</h3>
        <Badge tone={selectedCount === 0 ? "danger" : "neutral"}>
          {selectedCount}/{MAX_KPIS_PER_PROVIDER} selezionate
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {config.kpis.map((kpi) => {
          const isSelected = selectedKpis.includes(kpi.key);

          return (
            <label
              className={[
                "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition",
                isSelected
                  ? "border-brand-200 bg-brand-50 text-slate-950 dark:border-brand-400/40 dark:bg-brand-500/15 dark:text-brand-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:bg-slate-900",
              ].join(" ")}
              key={kpi.key}
            >
              <input
                checked={isSelected}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600 dark:border-slate-600 dark:bg-slate-900"
                onChange={() => onToggle(providerKey, kpi.key)}
                type="checkbox"
              />
              <span className="min-w-0 truncate" title={kpi.label}>
                {kpi.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CustomMetricBlock({ metrics, onToggle, selectedMetricKeys }) {
  const selectedCount = selectedMetricKeys.length;

  return (
    <div className="ms-panel rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
            Metriche custom
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Scegli fino a 4 metriche custom da mostrare nella Dashboard.
          </p>
        </div>
        <Badge tone={selectedCount === 0 ? "danger" : "neutral"}>
          {selectedCount}/{MAX_CUSTOM_METRICS} selezionate
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {metrics.map((metric) => {
          const isSelected = selectedMetricKeys.includes(metric.key);

          return (
            <label
              className={[
                "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition",
                isSelected
                  ? "border-brand-200 bg-brand-50 text-slate-950 dark:border-brand-400/40 dark:bg-brand-500/15 dark:text-brand-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:bg-slate-900",
              ].join(" ")}
              key={metric.key}
            >
              <input
                checked={isSelected}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600 dark:border-slate-600 dark:bg-slate-900"
                onChange={() => onToggle(metric.key)}
                type="checkbox"
              />
              <span className="min-w-0 truncate" title={metric.label}>
                {metric.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function normalizeAvailableCustomMetrics(metrics) {
  const seen = new Set();

  return (Array.isArray(metrics) ? metrics : []).reduce((items, metric) => {
    if (metric?.enabled === false || metric?.key === null || metric?.key === undefined) {
      return items;
    }

    const key = String(metric.key);

    if (!key || seen.has(key)) {
      return items;
    }

    seen.add(key);
    items.push({
      key,
      label: metric.label || key,
    });

    return items;
  }, []);
}

export default function DashboardPreferencesPage() {
  const { clients, selectedClient, selectedClientId } = useAppData();
  const [message, setMessage] = useState(null);
  const [preferences, setPreferences] = useState(() => readDashboardPreferences());

  const clientOptions = useMemo(
    () => [
      { label: "Ultimo cliente selezionato", value: LAST_SELECTED_CLIENT },
      ...clients.map((client) => ({ label: client.name, value: client.id })),
    ],
    [clients],
  );

  const hasEmptyProvider = providerOrder.some(
    (providerKey) => preferences.visibleKpis[providerKey].length === 0,
  );
  const availableCustomMetrics = useMemo(
    () => normalizeAvailableCustomMetrics(selectedClient?.customMetricsConfig),
    [selectedClient?.customMetricsConfig],
  );
  const shouldShowCustomMetricBlock = availableCustomMetrics.length > MAX_CUSTOM_METRICS;
  const customMetricClientId =
    selectedClientId === null || selectedClientId === undefined ? null : String(selectedClientId);
  const availableCustomMetricKeys = useMemo(
    () => availableCustomMetrics.map((metric) => metric.key),
    [availableCustomMetrics],
  );
  const selectedCustomMetricKeys = useMemo(() => {
    if (!customMetricClientId || !shouldShowCustomMetricBlock) {
      return [];
    }

    const visibleCustomMetrics = preferences.visibleCustomMetrics ?? {};
    const hasSavedSelection = Object.prototype.hasOwnProperty.call(
      visibleCustomMetrics,
      customMetricClientId,
    );

    if (!hasSavedSelection) {
      return availableCustomMetricKeys.slice(0, MAX_CUSTOM_METRICS);
    }

    const availableKeySet = new Set(availableCustomMetricKeys);

    return (Array.isArray(visibleCustomMetrics[customMetricClientId])
      ? visibleCustomMetrics[customMetricClientId]
      : [])
      .map(String)
      .filter((key) => availableKeySet.has(key))
      .slice(0, MAX_CUSTOM_METRICS);
  }, [
    availableCustomMetricKeys,
    customMetricClientId,
    preferences.visibleCustomMetrics,
    shouldShowCustomMetricBlock,
  ]);
  const hasEmptyCustomMetrics =
    shouldShowCustomMetricBlock && selectedCustomMetricKeys.length === 0;

  function updatePreference(key, value) {
    setMessage(null);
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleKpi(providerKey, kpiKey) {
    const currentSelection = preferences.visibleKpis[providerKey];
    const isSelected = currentSelection.includes(kpiKey);

    if (!isSelected && currentSelection.length >= MAX_KPIS_PER_PROVIDER) {
      setMessage({
        type: "warning",
        text: "Puoi selezionare massimo 4 KPI per piattaforma.",
      });
      return;
    }

    setMessage(null);
    setPreferences((current) => ({
      ...current,
      visibleKpis: {
        ...current.visibleKpis,
        [providerKey]: isSelected
          ? currentSelection.filter((selectedKey) => selectedKey !== kpiKey)
          : [...currentSelection, kpiKey],
      },
    }));
  }

  function toggleCustomMetric(metricKey) {
    if (!customMetricClientId) {
      return;
    }

    const isSelected = selectedCustomMetricKeys.includes(metricKey);

    if (!isSelected && selectedCustomMetricKeys.length >= MAX_CUSTOM_METRICS) {
      setMessage({
        type: "warning",
        text: "Puoi selezionare massimo 4 metriche custom.",
      });
      return;
    }

    setMessage(null);
    setPreferences((current) => {
      const currentVisibleCustomMetrics = current.visibleCustomMetrics ?? {};

      return {
        ...current,
        visibleCustomMetrics: {
          ...currentVisibleCustomMetrics,
          [customMetricClientId]: isSelected
            ? selectedCustomMetricKeys.filter((selectedKey) => selectedKey !== metricKey)
            : [...selectedCustomMetricKeys, metricKey],
        },
      };
    });
  }

  function handleSave() {
    if (hasEmptyProvider) {
      setMessage({
        type: "warning",
        text: "Seleziona almeno 1 KPI per ogni piattaforma.",
      });
      return;
    }

    if (hasEmptyCustomMetrics) {
      setMessage({
        type: "warning",
        text: "Seleziona almeno 1 metrica custom.",
      });
      return;
    }

    const preferencesToSave =
      shouldShowCustomMetricBlock && customMetricClientId
        ? {
            ...preferences,
            visibleCustomMetrics: {
              ...(preferences.visibleCustomMetrics ?? {}),
              [customMetricClientId]: selectedCustomMetricKeys,
            },
          }
        : preferences;
    const savedPreferences = writeDashboardPreferences(preferencesToSave);

    setPreferences(savedPreferences);
    setMessage({
      type: "success",
      text: "Preferenze salvate sul dispositivo.",
    });
  }

  return (
    <div className="ms-page-stack max-w-6xl space-y-8">
      <PageHeader
        actions={
          <BackButton label="Torna alle impostazioni" to={APP_ROUTES.settings} />
        }
        description="Personalizza l'apertura e la visualizzazione della dashboard."
        title="Preferenze dashboard"
      />

      <Notice message={message} />

      <Card>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
              Apertura dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Imposta la vista iniziale dell'app.
            </p>
          </div>
        </div>

        <div className="ms-card-grid mt-6 grid gap-4 md:grid-cols-2">
          <Select
            id="default-client"
            label="Cliente predefinito"
            onChange={(event) => updatePreference("defaultClient", event.target.value)}
            options={clientOptions}
            value={preferences.defaultClient}
          />
          <Select
            id="default-period"
            label="Periodo predefinito dashboard"
            onChange={(event) => updatePreference("defaultRange", event.target.value)}
            options={periodOptions}
            value={preferences.defaultRange}
          />
          <Select
            id="start-page"
            label="Pagina iniziale"
            onChange={(event) => updatePreference("startPage", event.target.value)}
            options={startPageOptions}
            value={preferences.startPage}
          />
          <ToggleField
            checked={preferences.showDisconnectedProviders}
            label="Mostra sezioni piattaforme non collegate"
            onChange={(value) => updatePreference("showDisconnectedProviders", value)}
          />
        </div>
      </Card>

      <section className="ms-section space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Card KPI visibili</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Scegli fino a 4 KPI per ogni piattaforma.
          </p>
        </div>

        <div className="ms-card-grid grid gap-4 xl:grid-cols-3">
          {providerOrder.map((providerKey) => (
            <ProviderKpiBlock
              config={providerKpiConfig[providerKey]}
              key={providerKey}
              onToggle={toggleKpi}
              providerKey={providerKey}
              selectedKpis={preferences.visibleKpis[providerKey]}
            />
          ))}
          {shouldShowCustomMetricBlock ? (
            <CustomMetricBlock
              metrics={availableCustomMetrics}
              onToggle={toggleCustomMetric}
              selectedMetricKeys={selectedCustomMetricKeys}
            />
          ) : null}
        </div>
      </section>

      <div className="flex justify-end">
        <SaveButton className="w-full sm:w-auto" label="Salva preferenze" onClick={handleSave} />
      </div>
    </div>
  );
}
