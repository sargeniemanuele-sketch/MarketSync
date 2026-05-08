export default function Spinner({ className = "", label = "Caricamento", size = "md" }) {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div
      className={["inline-flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300", className].join(" ")}
      role="status"
    >
      <span
        className={[
          "inline-block animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-400",
          sizes[size],
        ].join(" ")}
      />
      <span>{label}</span>
    </div>
  );
}
