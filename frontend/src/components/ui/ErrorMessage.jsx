import { AlertTriangle } from "lucide-react";

export default function ErrorMessage({ className = "", message, title = "Errore" }) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={[
        "rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200",
        className,
      ].join(" ")}
      role="alert"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}
