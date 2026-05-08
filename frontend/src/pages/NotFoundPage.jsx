import BackButton from "../components/ui/BackButton.jsx";
import Card from "../components/ui/Card.jsx";
import { APP_ROUTES } from "../utils/constants.js";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-lg space-y-4">
        <BackButton fallbackTo={APP_ROUTES.dashboard} />
        <Card className="w-full max-w-lg p-8 text-center">
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">404</p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">Pagina non trovata</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            La pagina richiesta non esiste o il link non è più valido.
          </p>
        </Card>
      </div>
    </div>
  );
}
