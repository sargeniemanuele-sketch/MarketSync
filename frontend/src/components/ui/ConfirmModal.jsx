import Button from "./Button.jsx";

export default function ConfirmModal({
  cancelLabel = "Annulla",
  confirmLabel = "Conferma",
  description,
  isOpen,
  isSubmitting = false,
  onCancel,
  onConfirm,
  title = "Conferma azione",
  variant = "danger",
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-labelledby="confirm-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50" id="confirm-modal-title">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button disabled={isSubmitting} onClick={onCancel} variant="secondary">
            {cancelLabel}
          </Button>
          <Button disabled={isSubmitting} isLoading={isSubmitting} onClick={onConfirm} variant={variant}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
