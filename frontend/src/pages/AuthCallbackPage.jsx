import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import useAuth from "../hooks/useAuth.js";
import { APP_ROUTES } from "../utils/constants.js";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loginWithOAuthCode } = useAuth();
  const [error, setError] = useState(null);
  const hasHandledCallbackRef = useRef(false);

  useEffect(() => {
    if (hasHandledCallbackRef.current) {
      return;
    }

    hasHandledCallbackRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    window.history.replaceState(null, "", APP_ROUTES.authCallback);

    if (!code) {
      setError("Non è stato possibile completare l'accesso con Google. Riprova dalla pagina di login.");
      return;
    }

    loginWithOAuthCode(code)
      .then(() => {
        navigate(APP_ROUTES.dashboard, { replace: true });
      })
      .catch(() => {
        setError("Accesso Google non riuscito. Riprova dal login.");
      });
  }, [loginWithOAuthCode, navigate]);

  if (isAuthenticated) {
    return <Navigate to={APP_ROUTES.dashboard} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <img src="/brand/marketsync-logo.png" alt="MarketSync" className="h-9 object-contain" />
        <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">Accesso Google</h1>
        <div className="mt-6">
          {error ? <ErrorMessage message={error} /> : <Spinner label="Completo l'accesso" />}
        </div>
      </div>
    </div>
  );
}
