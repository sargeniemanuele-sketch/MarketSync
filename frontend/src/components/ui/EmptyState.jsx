import { Inbox } from "lucide-react";

export default function EmptyState({
  action,
  className = "",
  description = "Non ci sono ancora informazioni da mostrare.",
  icon: Icon = Inbox,
  title = "Nessun contenuto",
}) {
  return (
    <div
      className={[
        "rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900",
        className,
      ].join(" ")}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
