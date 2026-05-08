import { DATE_RANGE_OPTIONS } from "../../utils/ranges.js";

export default function RangeSelector({
  disabled = false,
  endDate = "",
  label = "Periodo",
  onChange,
  onEndDateChange,
  onStartDateChange,
  options = DATE_RANGE_OPTIONS,
  periodDescription = "",
  startDate = "",
  value = "last_30_days",
}) {
  function handleSelect(nextValue) {
    if (!disabled && onChange) {
      onChange(nextValue);
    }
  }

  return (
    <div className="ms-range-selector">
      <p className="ms-field-label mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
      <div className="ms-range-options flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {options.map((option) => {
          const isActive = option.key === value;

          return (
            <button
              className={[
                "ms-range-option rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                isActive
                  ? "bg-slate-950 text-white shadow-sm dark:bg-brand-500/20 dark:text-brand-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50",
              ].join(" ")}
              disabled={disabled}
              key={option.key}
              onClick={() => handleSelect(option.key)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {value === "custom" ? (
        <div className="mt-3 space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Data inizio</span>
              <input
                aria-label="Data inizio"
                className="ms-input h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30"
                disabled={disabled}
                onChange={(event) => onStartDateChange?.(event.target.value)}
                type="date"
                value={startDate}
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Data fine</span>
              <input
                aria-label="Data fine"
                className="ms-input h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30"
                disabled={disabled}
                onChange={(event) => onEndDateChange?.(event.target.value)}
                type="date"
                value={endDate}
              />
            </label>
          </div>
          {startDate && endDate ? null : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Seleziona data inizio e data fine.</p>
          )}
        </div>
      ) : null}
      {periodDescription ? (
        <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">{periodDescription}</p>
      ) : null}
    </div>
  );
}
