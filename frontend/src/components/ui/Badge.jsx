const tones = {
  danger:
    "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30",
  neutral:
    "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
};

const statusStyles = {
  available: tones.success,
  cache: tones.warning,
  connected: tones.success,
  disconnected: tones.neutral,
  error: tones.danger,
  expired: tones.warning,
  failed: tones.danger,
  incomplete: tones.warning,
  live:
    "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:ring-cyan-500/30",
  mixed:
    "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-500/30",
  needs_reauth: tones.warning,
  needs_account_selection: tones.warning,
  not_available: tones.neutral,
  not_connected: tones.neutral,
};

const statusLabels = {
  available: "Disponibile",
  cache: "Dati salvati",
  connected: "Connesso",
  disconnected: "Disconnesso",
  error: "Errore",
  expired: "Scaduto",
  failed: "Non caricato",
  incomplete: "Incompleto",
  live: "Live",
  mixed: "Misto",
  needs_reauth: "Ricollega",
  needs_account_selection: "Seleziona account",
  not_available: "Non disponibile",
  not_connected: "Non connesso",
};

export default function Badge({ children, className = "", status, tone = "neutral" }) {
  const normalizedStatus =
    status && typeof status === "object" ? status.status || status.value : status;
  const style = normalizedStatus ? statusStyles[normalizedStatus] : tones[tone];
  const label = children ?? statusLabels[normalizedStatus] ?? normalizedStatus ?? "";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        style || tones.neutral,
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
