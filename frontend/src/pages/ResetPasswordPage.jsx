import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getApiErrorMessage, resetPassword } from "../api/authApi.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import Input from "../components/ui/Input.jsx";
import { APP_ROUTES } from "../utils/constants.js";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get("token"));
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [token]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validateForm() {
    if (!form.password) return "La password è obbligatoria.";
    if (form.password.length < 8) return "La password deve contenere almeno 8 caratteri.";
    if (!/[a-zA-Z]/.test(form.password)) return "La password deve contenere almeno una lettera.";
    if (!/[0-9]/.test(form.password)) return "La password deve contenere almeno un numero.";
    if (form.password !== form.confirmPassword) return "Password e conferma password devono coincidere.";
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await resetPassword({ token, password: form.password });
      setSuccess(true);
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Link non valido o scaduto."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <Card className="w-full max-w-md p-8">
        <img src="/brand/marketsync-logo.png" alt="MarketSync" className="h-9 object-contain" />

        {!token ? (
          <>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">
              Link non valido
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Link non valido o scaduto. Richiedi un nuovo link dalla pagina "Password dimenticata".
            </p>
            <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
              <Link
                className="text-sm font-medium text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
                to={APP_ROUTES.forgotPassword}
              >
                Richiedi nuovo link
              </Link>
            </div>
          </>
        ) : success ? (
          <>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">
              Password aggiornata
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Password aggiornata correttamente. Puoi accedere con la tua nuova password.
            </p>
            <div className="mt-6">
              <Button
                className="w-full"
                onClick={() => navigate(APP_ROUTES.login, { replace: true })}
                type="button"
              >
                Vai al login
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">
              Reimposta la password
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Scegli una nuova password per il tuo account MarketSync.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <ErrorMessage message={formError} title="Errore" />

              <Input
                autoComplete="new-password"
                disabled={isSubmitting}
                id="reset-password"
                label="Nuova password"
                name="password"
                onChange={updateField}
                placeholder="Almeno 8 caratteri"
                type="password"
                value={form.password}
              />

              <Input
                autoComplete="new-password"
                disabled={isSubmitting}
                id="reset-confirm-password"
                label="Conferma nuova password"
                name="confirmPassword"
                onChange={updateField}
                placeholder="Ripeti la password"
                type="password"
                value={form.confirmPassword}
              />

              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                La password deve avere almeno 8 caratteri, una lettera e un numero.
              </p>

              <Button className="w-full" disabled={isSubmitting} type="submit">
                <Lock className="h-4 w-4" aria-hidden="true" />
                {isSubmitting ? "Aggiornamento" : "Reimposta password"}
              </Button>
            </form>

            <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
              <Link
                className="text-sm font-medium text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
                to={APP_ROUTES.login}
              >
                Torna al login
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
