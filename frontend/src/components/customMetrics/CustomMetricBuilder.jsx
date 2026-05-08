import { FlaskConical, Plus, X } from "lucide-react";
import Button from "../ui/Button.jsx";
import Input from "../ui/Input.jsx";
import SaveButton from "../ui/SaveButton.jsx";
import Select from "../ui/Select.jsx";
import FormulaPreview from "./FormulaPreview.jsx";
import {
  CUSTOM_METRIC_SOURCE_OPTIONS,
  PROVIDER_KEYS,
} from "../../utils/constants.js";
import {
  getSourceMetricDefinition,
  getSourceMetricOptions,
  isSourceMetricAllowed,
} from "../../utils/customMetricSourceCatalog.js";

const operatorButtons = ["+", "-", "*", "/", "(", ")"];
const unitOptions = [
  { label: "Valuta", value: "currency" },
  { label: "Numero", value: "number" },
  { label: "Percentuale", value: "percentage" },
  { label: "Ratio", value: "ratio" },
];
let variableUiIdCounter = 0;

function createVariableUiId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  variableUiIdCounter += 1;
  return `variable-${Date.now()}-${variableUiIdCounter}`;
}

function emptyVariable() {
  return {
    _uiId: createVariableUiId(),
    variableKey: "",
    sourceProvider: PROVIDER_KEYS.shopify,
    metricKey: "",
  };
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

function FieldError({ children }) {
  if (!children) {
    return null;
  }

  return <p className="mt-2 text-xs leading-5 text-rose-600 dark:text-rose-300">{children}</p>;
}

export default function CustomMetricBuilder({
  disabled = false,
  errors = {},
  mode = "create",
  onCancel,
  onChange,
  onPreview,
  onSubmit,
  preview = null,
  previewError = null,
  previewLoading = false,
  value,
}) {
  const metric = value ?? {};
  const variables = Array.isArray(metric.variables) ? metric.variables : [];

  function getVariableMetricOptions(variable) {
    const options = getSourceMetricOptions(variable.sourceProvider);
    const metricKey = variable.metricKey ?? "";

    if (!metricKey || options.some((option) => option.value === metricKey)) {
      return options;
    }

    const definition = getSourceMetricDefinition(variable.sourceProvider, metricKey);

    if (!definition) {
      return options;
    }

    return [
      ...options,
      {
        label: `${definition.label} (compatibilita)`,
        title: metricKey,
        value: metricKey,
      },
    ];
  }

  function updateMetric(field, nextValue) {
    onChange({
      ...metric,
      [field]: nextValue,
    });
  }

  function updateLabel(nextLabel) {
    const previousAutoKey = toIdentifier(metric.label);
    const currentKey = String(metric.key ?? "").trim();
    const shouldAutoGenerateKey = !currentKey || currentKey === previousAutoKey;

    onChange({
      ...metric,
      key: shouldAutoGenerateKey ? toIdentifier(nextLabel) : metric.key,
      label: nextLabel,
    });
  }

  function appendFormulaToken(token) {
    const currentFormula = String(metric.formula ?? "");
    const separator =
      currentFormula === "" || currentFormula.endsWith(" ") || token === ")" ? "" : " ";

    updateMetric("formula", `${currentFormula}${separator}${token}`);
  }

  function addVariable() {
    onChange({
      ...metric,
      variables: [...variables, emptyVariable()],
    });
  }

  function updateVariable(index, field, nextValue) {
    onChange({
      ...metric,
      variables: variables.map((variable, variableIndex) => {
        if (variableIndex !== index) {
          return variable;
        }

        const nextVariable = { ...variable, [field]: nextValue };

        if (
          field === "sourceProvider" &&
          !isSourceMetricAllowed(nextValue, nextVariable.metricKey)
        ) {
          nextVariable.metricKey = "";
        }

        return nextVariable;
      }),
    });
  }

  function removeVariable(index) {
    onChange({
      ...metric,
      variables: variables.filter((_, variableIndex) => variableIndex !== index),
    });
  }

  return (
    <form className="ms-form-stack space-y-6" onSubmit={onSubmit}>
      <div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
            {mode === "edit" ? "Modifica metrica custom" : "Nuova metrica custom"}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Configura formula e variabili. Il risultato viene calcolato automaticamente usando i dati collegati.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_180px_auto]">
        <Input
          disabled={disabled}
          error={errors.label}
          id="custom-metric-label"
          label="Etichetta"
          onChange={(event) => updateLabel(event.target.value)}
          placeholder="Es. Margine netto"
          value={metric.label ?? ""}
        />
        <Input
          disabled={disabled}
          error={errors.key}
          helpText="Identificatore generato automaticamente. Modificalo solo se necessario."
          id="custom-metric-key"
          label="Identificatore"
          onChange={(event) => updateMetric("key", event.target.value)}
          placeholder="net_margin"
          value={metric.key ?? ""}
        />
        <Select
          disabled={disabled}
          id="custom-metric-unit"
          label="Formato"
          onChange={(event) => updateMetric("unit", event.target.value)}
          options={unitOptions}
          value={metric.unit ?? "number"}
        />
        <FieldError>{errors.unit}</FieldError>
        <label className="flex items-end gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <input
            checked={metric.enabled !== false}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600 dark:border-slate-600 dark:bg-slate-900"
            disabled={disabled}
            onChange={(event) => updateMetric("enabled", event.target.checked)}
            type="checkbox"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Abilitata</span>
        </label>
      </div>

      <div>
        <label className="block" htmlFor="custom-metric-description">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Descrizione info card
          </span>
          <textarea
            className="ms-textarea block min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-400 dark:focus:ring-brand-500/30 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
            disabled={disabled}
            id="custom-metric-description"
            maxLength={500}
            onChange={(event) => updateMetric("description", event.target.value)}
            placeholder="Spiega in modo semplice cosa rappresenta questa metrica."
            value={metric.description ?? ""}
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <FieldError>{errors.description}</FieldError>
          <span className="ml-auto text-slate-500 dark:text-slate-400">
            {String(metric.description ?? "").length}/500
          </span>
        </div>
      </div>

      <div>
        <label className="block" htmlFor="custom-metric-formula">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Formula</span>
          <textarea
            className="ms-textarea block min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-3 font-mono text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-400 dark:focus:ring-brand-500/30 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
            disabled={disabled}
            id="custom-metric-formula"
            onChange={(event) => updateMetric("formula", event.target.value)}
            placeholder="revenue - spend - commission"
            value={metric.formula ?? ""}
          />
        </label>
        <FieldError>{errors.formula}</FieldError>
        <div className="mt-3 flex flex-wrap gap-2">
          {operatorButtons.map((operator) => (
            <Button
              disabled={disabled}
              key={operator}
              onClick={() => appendFormulaToken(operator)}
              size="sm"
              type="button"
              variant="secondary"
            >
              {operator}
            </Button>
          ))}
        </div>
        {variables.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {variables
              .map((variable) => String(variable?.variableKey ?? "").trim())
              .filter(Boolean)
              .map((variableKey) => (
                <Button
                  disabled={disabled}
                  key={variableKey}
                  onClick={() => appendFormulaToken(variableKey)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {variableKey}
                </Button>
              ))}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            disabled={disabled || previewLoading}
            isLoading={previewLoading}
            onClick={onPreview}
            type="button"
            variant="secondary"
          >
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            Test formula
          </Button>
          {preview?.formattedValue || preview?.value !== undefined ? (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
              Risultato: {preview.formattedValue ?? preview.value ?? "Non disponibile"}
            </span>
          ) : null}
          {previewError ? (
            <span className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200">
              {previewError}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">Variabili</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Ogni variabile collega un nome formula a una metrica sorgente.
            </p>
          </div>
          <Button disabled={disabled} onClick={addVariable} type="button" variant="secondary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Variabile
          </Button>
        </div>

        <FieldError>{errors.variables}</FieldError>

          <div className="ms-panel rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <p className="mb-2 font-medium text-slate-700 dark:text-slate-200">Esempio: <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800 dark:text-slate-200">revenue - ad_spend - fixed_costs</code></p>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <code className="font-mono text-brand-700 dark:text-brand-300">revenue</code>
            <span>Shopify → Total sales</span>
            <code className="font-mono text-brand-700 dark:text-brand-300">ad_spend</code>
            <span>Meta Ads → Amount spent</span>
            <code className="font-mono text-brand-700 dark:text-brand-300">fixed_costs</code>
            <span>Impostazioni cliente → Costi extra fissi totali</span>
          </div>
        </div>

        {variables.length === 0 ? (
          <div className="ms-panel rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            Nessuna variabile configurata.
          </div>
        ) : null}

        {variables.map((variable, index) => {
          const sourceMetricOptions = getVariableMetricOptions(variable);

          return (
            <div
              className="ms-panel grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-[1fr_190px_1.2fr_auto]"
              key={variable._uiId}
            >
              <div>
                <Input
                  disabled={disabled}
                  helpText="Nome da usare nella formula, es. revenue"
                  id={`custom-variable-key-${index}`}
                  label="Nome variabile"
                  onChange={(event) => updateVariable(index, "variableKey", event.target.value)}
                  placeholder="revenue"
                  value={variable.variableKey ?? ""}
                />
                <FieldError>{errors[`variables.${index}.variableKey`]}</FieldError>
              </div>

              <div>
                <Select
                  disabled={disabled}
                  id={`custom-variable-provider-${index}`}
                  label="Fonte"
                  onChange={(event) =>
                    updateVariable(index, "sourceProvider", event.target.value)
                  }
                  options={CUSTOM_METRIC_SOURCE_OPTIONS}
                  value={variable.sourceProvider ?? PROVIDER_KEYS.shopify}
                />
                <FieldError>{errors[`variables.${index}.sourceProvider`]}</FieldError>
              </div>

              <div>
                <Select
                  disabled={disabled}
                  id={`custom-variable-metric-key-${index}`}
                  label="Metrica sorgente"
                  onChange={(event) => updateVariable(index, "metricKey", event.target.value)}
                  options={sourceMetricOptions}
                  placeholder="Seleziona metrica"
                  value={variable.metricKey ?? ""}
                />
                {variable.metricKey ? (
                  <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                    Metrica scelta: <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800 dark:text-slate-300">{variable.metricKey}</code>
                  </p>
                ) : null}
                <FieldError>{errors[`variables.${index}.metricKey`]}</FieldError>
              </div>

              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={disabled}
                  onClick={() => removeVariable(index)}
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Rimuovi
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <FormulaPreview
        description={metric.description}
        formula={metric.formula}
        variables={variables}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button disabled={disabled} onClick={onCancel} type="button" variant="secondary">
          <X className="h-4 w-4" aria-hidden="true" />
          Annulla
        </Button>
        <SaveButton
          className="w-full sm:w-auto"
          disabled={disabled}
          label={mode === "edit" ? "Aggiorna metrica" : "Aggiungi metrica"}
          type="submit"
        />
      </div>
    </form>
  );
}
