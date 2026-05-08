import { Chrome, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getApiErrorMessage, getGoogleAuthUrl } from "../api/authApi.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import Input from "../components/ui/Input.jsx";
import useAuth from "../hooks/useAuth.js";
import { APP_ROUTES } from "../utils/constants.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { authError, clearAuthError, isAuthenticated, isLoading, login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    const from = location.state?.from?.pathname;
    return from && from !== APP_ROUTES.login ? from : APP_ROUTES.dashboard;
  }, [location.state]);

  useEffect(() => {
    clearAuthError();

    if (searchParams.get("error") === "google_auth_failed") {
      setFormError("Accesso Google non riuscito. Riprova o usa email e password.");
    }
  }, [clearAuthError, searchParams]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    if (!form.email.trim() || !form.password) {
      setFormError("Inserisci email e password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        email: form.email.trim(),
        password: form.password,
      });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Email o password non validi."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <Card className="w-full max-w-md p-8">
        <img src="/brand/marketsync-logo.png" alt="MarketSync" className="h-9 object-contain" />
        <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">Accedi al tuo account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Usa email e password MarketSync per entrare nella dashboard.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <ErrorMessage message={formError || authError} title="Accesso non riuscito" />

          <Input
            autoComplete="email"
            disabled={isSubmitting || isLoading}
            id="login-email"
            label="Email"
            name="email"
            onChange={updateField}
            placeholder="nome@azienda.it"
            type="email"
            value={form.email}
          />

          <Input
            autoComplete="current-password"
            disabled={isSubmitting || isLoading}
            id="login-password"
            label="Password"
            name="password"
            onChange={updateField}
            placeholder="La tua password"
            type="password"
            value={form.password}
          />

          <div className="flex justify-end">
            <Link
              className="text-sm text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
              to={APP_ROUTES.forgotPassword}
            >
              Password dimenticata?
            </Link>
          </div>

          <Button className="w-full" disabled={isSubmitting || isLoading} type="submit">
            <Mail className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "Accesso in corso" : "Accedi"}
          </Button>
        </form>

        <div className="mt-4">
          <Button as="a" className="w-full" href={getGoogleAuthUrl()} variant="secondary">
            <Chrome className="h-4 w-4" aria-hidden="true" />
            Continua con Google
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-5 text-sm dark:border-slate-800">
          <span className="text-slate-600 dark:text-slate-300">Non hai un account?</span>
          <Link className="font-medium text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200" to={APP_ROUTES.register}>
            Registrati
          </Link>
        </div>
      </Card>
    </div>
  );
}
