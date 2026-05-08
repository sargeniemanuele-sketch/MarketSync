import { Edit3, Trash2 } from "lucide-react";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import InfoTooltip from "../ui/InfoTooltip.jsx";
import { CUSTOM_METRIC_SOURCE_LABELS } from "../../utils/constants.js";

function getProviderLabels(metric) {
  const providers = new Set(
    (Array.isArray(metric?.variables) ? metric.variables : [])
      .map((variable) => variable?.sourceProvider)
      .filter(Boolean),
  );

  return Array.from(providers).map(
    (providerKey) => CUSTOM_METRIC_SOURCE_LABELS[providerKey] ?? providerKey,
  );
}

function CustomMetricInfo({ metric }) {
  const title = metric?.label || "Metrica custom";
  const description = String(metric?.description ?? "").trim();
  const formula = String(metric?.formula ?? "").trim() || "Formula non impostata";

  return (
    <InfoTooltip ariaLabel={`Informazioni su ${title}`} buttonClassName="h-7 w-7" widthClassName="w-80">
      <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{title}</p>
      {description ? (
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Descrizione:</span>{" "}
          {description}
        </p>
      ) : null}
      <p className="mt-2 break-words text-xs leading-5 text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-slate-700 dark:text-slate-200">Formula:</span> {formula}
      </p>
    </InfoTooltip>
  );
}

export default function CustomMetricList({
  isDisabled = false,
  metrics = [],
  onAdd,
  onDelete,
  onEdit,
}) {
  if (metrics.length === 0) {
    return (
      <EmptyState
        action={
          <Button disabled={isDisabled} onClick={onAdd}>
            Aggiungi metrica
          </Button>
        }
        title="Nessuna metrica custom configurata"
        description="Crea una metrica con formula testuale e variabili collegate alle sorgenti dati."
      />
    );
  }

  return (
    <div className="ms-list-stack space-y-3">
      {metrics.map((metric, index) => {
        const providers = getProviderLabels(metric);
        const variableCount = Array.isArray(metric.variables) ? metric.variables.length : 0;

        return (
          <article
            className="ms-list-card rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
            key={`${metric.key || "custom-metric"}-${index}`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                    {metric.label || "Metrica senza etichetta"}
                  </h3>
                  <CustomMetricInfo metric={metric} />
                  <Badge tone={metric.enabled === false ? "neutral" : "success"}>
                    {metric.enabled === false ? "Disabilitata" : "Abilitata"}
                  </Badge>
                  <Badge tone="neutral">{metric.unit || "number"}</Badge>
                  <Badge tone="neutral">{metric.key || "Identificatore non impostato"}</Badge>
                </div>

                <p className="break-words rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800">
                  {metric.formula || "Formula non impostata"}
                </p>

                <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                    {variableCount} variabili
                  </span>
                  {providers.length > 0 ? (
                    providers.map((providerLabel) => (
                      <span
                        className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800"
                        key={providerLabel}
                      >
                        {providerLabel}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                      Nessuna piattaforma
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:flex-none">
                <Button
                  disabled={isDisabled}
                  onClick={() => onEdit(index)}
                  size="sm"
                  variant="secondary"
                >
                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                  Modifica
                </Button>
                <Button
                  disabled={isDisabled}
                  onClick={() => onDelete(index)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Elimina
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
