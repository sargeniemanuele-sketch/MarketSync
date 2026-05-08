export default function Select({
  className = "",
  disabled = false,
  id,
  label,
  onChange,
  options = [],
  optionClassName = "",
  placeholder,
  value = "",
  variant = "default",
  ...props
}) {
  const variants = {
    default: {
      label: "text-slate-700 dark:text-slate-200",
      option: "bg-white text-slate-950 dark:bg-slate-900 dark:text-slate-100",
      select:
        "h-11 border-slate-300 bg-white text-slate-950 shadow-sm focus:border-brand-600 focus:ring-brand-100 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30 dark:disabled:bg-slate-900 dark:disabled:text-slate-500",
    },
    sidebar: {
      label: "text-slate-300",
      option: "bg-white text-slate-950 dark:bg-slate-900 dark:text-slate-100",
      select:
        "h-10 border-slate-700 bg-slate-900/80 text-slate-100 shadow-none hover:border-slate-500 focus:border-brand-400 focus:ring-brand-500/30 disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-400",
    },
  };
  const styles = variants[variant] || variants.default;

  return (
    <label className="ms-field block" htmlFor={id}>
      {label ? (
        <span className={["ms-field-label mb-2 block text-sm font-medium", styles.label].join(" ")}>
          {label}
        </span>
      ) : null}
      <select
        className={[
          "ms-select block w-full rounded-md border px-3 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed",
          styles.select,
          className,
        ].join(" ")}
        disabled={disabled}
        id={id}
        onChange={onChange}
        value={value}
        {...props}
      >
        {placeholder ? (
          <option
            className={[styles.option, optionClassName].join(" ")}
            disabled
            value=""
          >
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => {
          const optionValue = option.value ?? option.key ?? option.id;

          return (
            <option
              className={[styles.option, optionClassName].join(" ")}
              disabled={option.disabled}
              key={optionValue}
              title={option.title}
              value={optionValue}
            >
              {option.label ?? option.name ?? optionValue}
            </option>
          );
        })}
      </select>
    </label>
  );
}
