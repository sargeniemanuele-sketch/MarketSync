import { Info } from "lucide-react";
import { CUSTOM_METRIC_SOURCE_LABELS } from "../../utils/constants.js";

export default function FormulaPreview({ description = "", formula = "", variables = [] }) {
  const trimmedDescription = String(description ?? "").trim();
  const trimmedFormula = String(formula ?? "").trim();
  const configuredVariables = variables
    .map((variable) => ({
      metricKey: String(variable?.metricKey ?? "").trim(),
      sourceProvider: variable?.sourceProvider,
      variableKey: String(variable?.variableKey ?? "").trim(),
    }))
    .filter((variable) => variable.variableKey || variable.metricKey);

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 flex-none text-brand-600 dark:text-brand-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-950 dark:text-slate-50">Anteprima info card</p>
          {trimmedDescription ? (
            <div className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                Descrizione
              </p>
              <p className="mt-1 leading-6">{trimmedDescription}</p>
            </div>
          ) : null}
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
            Formula
          </p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
            {trimmedFormula || "Nessuna formula inserita"}
          </pre>
          <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
            Il risultato viene calcolato automaticamente usando i dati collegati.
          </p>
          {configuredVariables.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                Variabili configurate
              </p>
              <div className="flex flex-wrap gap-2">
                {configuredVariables.map((variable, index) => (
                  <span
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
                    key={`${variable.variableKey || "variable"}-${index}`}
                  >
                    {variable.variableKey || "variabile"} -{" "}
                    {CUSTOM_METRIC_SOURCE_LABELS[variable.sourceProvider] || variable.sourceProvider || "Fonte"}{" "}
                    / {variable.metricKey || "metrica non scelta"}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
