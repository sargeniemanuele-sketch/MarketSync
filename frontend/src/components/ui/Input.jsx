export default function Input({ className = "", error, helpText, id, label, ...props }) {
  const hintId = id && (helpText || error) ? `${id}-hint` : undefined;

  return (
    <label className="ms-field block" htmlFor={id}>
      {label ? (
        <span className="ms-field-label mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      ) : null}
      <input
        id={id}
        className={[
          "ms-input block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-400 dark:focus:ring-brand-500/30 dark:disabled:bg-slate-900 dark:disabled:text-slate-500",
          className,
        ].join(" ")}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={hintId}
        {...props}
      />
      {helpText || error ? (
        <span
          className={[
            "ms-field-hint mt-2 block text-xs leading-5",
            error ? "text-rose-600 dark:text-rose-300" : "text-slate-500 dark:text-slate-400",
          ].join(" ")}
          id={hintId}
        >
          {error || helpText}
        </span>
      ) : null}
    </label>
  );
}
