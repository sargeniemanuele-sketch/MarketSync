import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { updateClientBusinessSettings } from "../../api/clientsApi.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import ErrorMessage from "../ui/ErrorMessage.jsx";
import Input from "../ui/Input.jsx";
import SaveButton from "../ui/SaveButton.jsx";
import Select from "../ui/Select.jsx";

const COST_TYPE_OPTIONS = [
  { value: "fixed", label: "Fisso (€)" },
  { value: "percentage", label: "Percentuale (%)" },
];

function toSlug(label) {
  return (label ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "c$1") || "costo";
}

function ensureUniqueSlug(slug, existingSlugs) {
  if (!existingSlugs.has(slug)) return slug;
  let i = 2;
  while (existingSlugs.has(`${slug}_${i}`)) i++;
  return `${slug}_${i}`;
}

function clientToSettings(client) {
  const bs = client?.businessSettings ?? {};
  return {
    commissionPercentage: bs.commissionPercentage != null ? String(bs.commissionPercentage) : "",
    fixedCommission: bs.fixedCommission != null ? String(bs.fixedCommission) : "",
    extraCosts: Array.isArray(bs.extraCosts)
      ? bs.extraCosts.map((c) => ({ ...c, value: String(c.value ?? 0) }))
      : [],
  };
}

function parseNullableNumber(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function buildPayload(form) {
  return {
    commissionPercentage: parseNullableNumber(form.commissionPercentage),
    fixedCommission: parseNullableNumber(form.fixedCommission),
    extraCosts: form.extraCosts.map((c) => ({
      key: c.key,
      label: c.label,
      value: Number(c.value) || 0,
      type: c.type,
    })),
  };
}

function validateSettings(form) {
  const errors = {};

  const cp = String(form.commissionPercentage ?? "").trim();
  if (cp !== "" && (Number.isNaN(Number(cp)) || Number(cp) < 0)) {
    errors.commissionPercentage = "Inserisci un valore >= 0 oppure lascia vuoto.";
  }

  const fc = String(form.fixedCommission ?? "").trim();
  if (fc !== "" && (Number.isNaN(Number(fc)) || Number(fc) < 0)) {
    errors.fixedCommission = "Inserisci un valore >= 0 oppure lascia vuoto.";
  }

  const costErrors = form.extraCosts.map((c) => {
    const row = {};
    if (!c.label.trim()) row.label = "Nome obbligatorio.";
    const v = String(c.value ?? "").trim();
    if (v !== "" && (Number.isNaN(Number(v)) || Number(v) < 0)) row.value = "Valore >= 0.";
    return row;
  });

  const hasRowErrors = costErrors.some((r) => Object.keys(r).length > 0);
  if (hasRowErrors) errors.extraCosts = costErrors;

  const keys = form.extraCosts.map((c) => c.key);
  const uniqueKeys = new Set(keys);
  if (uniqueKeys.size !== keys.length) {
    errors.duplicateKeys = "Chiavi duplicate nei costi extra. Modifica i nomi.";
  }

  return errors;
}

export default function BusinessSettingsPanel({ client, clientId, onSaved }) {
  const [form, setForm] = useState(() => clientToSettings(client));
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    setForm(clientToSettings(client));
    setFormErrors({});
    setSaveError(null);
    setSuccessMessage(null);
  }, [client]);

  function setTopField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: null }));
    setSuccessMessage(null);
  }

  function addCost() {
    const existingSlugs = new Set(form.extraCosts.map((c) => c.key));
    const key = ensureUniqueSlug("costo", existingSlugs);
    setForm((prev) => ({
      ...prev,
      extraCosts: [...prev.extraCosts, { key, label: "", value: "0", type: "fixed" }],
    }));
    setSuccessMessage(null);
  }

  function removeCost(index) {
    setForm((prev) => ({
      ...prev,
      extraCosts: prev.extraCosts.filter((_, i) => i !== index),
    }));
    setSuccessMessage(null);
  }

  function updateCostField(index, field, value) {
    setForm((prev) => {
      const next = prev.extraCosts.map((c, i) => (i === index ? { ...c, [field]: value } : c));

      if (field === "label") {
        const slug = toSlug(value);
        const otherKeys = new Set(next.filter((_, i) => i !== index).map((c) => c.key));
        next[index] = { ...next[index], key: ensureUniqueSlug(slug, otherKeys) };
      }

      return { ...prev, extraCosts: next };
    });
    setFormErrors((prev) => {
      const costErrors = Array.isArray(prev.extraCosts) ? [...prev.extraCosts] : [];
      if (costErrors[index]) costErrors[index] = { ...costErrors[index], [field]: null };
      return { ...prev, extraCosts: costErrors, duplicateKeys: null };
    });
    setSuccessMessage(null);
  }

  async function handleSave() {
    const errors = validateSettings(form);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setSaveError(null);
    setSuccessMessage(null);

    try {
      await updateClientBusinessSettings(clientId, buildPayload(form));
      setSuccessMessage("Impostazioni business salvate.");
      onSaved?.();
    } catch (err) {
      setSaveError(
        err?.response?.data?.error?.message ??
          err?.message ??
          "Salvataggio non riuscito.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="ms-business-settings">
      <div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Impostazioni business</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Valori usati come sorgente{" "}
            <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800 dark:text-slate-200">client_setting</code> nelle
            metriche custom.
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

      <div className="ms-card-grid mt-6 grid gap-4 sm:grid-cols-2">
        <Input
          disabled={isSaving}
          error={formErrors.commissionPercentage}
          helpText="Percentuale commissione applicata al cliente. Lascia vuoto se non applicabile."
          id="bs-commission-pct"
          label="Commissione percentuale (%)"
          min="0"
          onChange={(e) => setTopField("commissionPercentage", e.target.value)}
          placeholder="es. 15"
          step="0.01"
          type="number"
          value={form.commissionPercentage}
        />
        <Input
          disabled={isSaving}
          error={formErrors.fixedCommission}
          helpText="Commissione fissa in valuta. Lascia vuoto se non applicabile."
          id="bs-fixed-commission"
          label="Commissione fissa (€)"
          min="0"
          onChange={(e) => setTopField("fixedCommission", e.target.value)}
          placeholder="es. 500"
          step="0.01"
          type="number"
          value={form.fixedCommission}
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Costi extra</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Disponibili come{" "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800 dark:text-slate-200">extra_costs_total</code> nelle formule.
            </p>
          </div>
          <Button disabled={isSaving} onClick={addCost} size="sm" type="button" variant="secondary">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Aggiungi costo
          </Button>
        </div>

        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Nota: <code className="rounded bg-amber-50 px-1 dark:bg-amber-500/15 dark:text-amber-200">extra_costs_total</code> include solo i costi fissi. I costi percentuali vengono salvati ma non inclusi nel totale.
        </p>

        {formErrors.duplicateKeys ? (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{formErrors.duplicateKeys}</p>
        ) : null}

        {form.extraCosts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">Nessun costo extra configurato.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {form.extraCosts.map((cost, index) => {
              const rowErrors = Array.isArray(formErrors.extraCosts)
                ? (formErrors.extraCosts[index] ?? {})
                : {};

              return (
                <div
                  className="ms-panel grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                  key={index}
                >
                  <Input
                    disabled={isSaving}
                    error={rowErrors.label}
                    id={`bs-cost-label-${index}`}
                    label="Nome"
                    onChange={(e) => updateCostField(index, "label", e.target.value)}
                    placeholder="es. Costo fisso mensile"
                    value={cost.label}
                  />
                  <Input
                    className="w-28"
                    disabled={isSaving}
                    error={rowErrors.value}
                    id={`bs-cost-value-${index}`}
                    label="Valore"
                    min="0"
                    onChange={(e) => updateCostField(index, "value", e.target.value)}
                    step="0.01"
                    type="number"
                    value={cost.value}
                  />
                  <Select
                    disabled={isSaving}
                    id={`bs-cost-type-${index}`}
                    label="Tipo"
                    onChange={(e) => updateCostField(index, "type", e.target.value)}
                    options={COST_TYPE_OPTIONS}
                    value={cost.type}
                  />
                  <div className="pb-px">
                    <Button
                      aria-label={`Rimuovi costo ${cost.label || index + 1}`}
                      disabled={isSaving}
                      onClick={() => removeCost(index)}
                      type="button"
                      variant="danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {form.extraCosts.length > 0 ? (
          <div className="mt-3 space-y-1">
            {form.extraCosts.map((cost, index) => (
              <p className="text-xs text-slate-400 dark:text-slate-500" key={index}>
                Identificatore: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800 dark:text-slate-300">{cost.key || "—"}</code>
                {" · "}
                {cost.label || <em>nessun nome</em>}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end">
        <SaveButton
          className="w-full sm:w-auto"
          disabled={isSaving}
          loading={isSaving}
          onClick={handleSave}
        />
      </div>
    </Card>
  );
}
