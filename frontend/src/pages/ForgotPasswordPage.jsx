import { Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/authApi.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import Input from "../components/ui/Input.jsx";
import { APP_ROUTES } from "../utils/constants.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    if (!email.trim()) {
      setFormError("Inserisci il tuo indirizzo email.");
      return;
    }

    setIsSubmitting(true);

    try {
      await forgotPassword(email.trim().toLowerCase());
    } catch {
      // Mostra sempre il messaggio generico, anche in caso di errore di rete.
      // Non rivelare se l'email esiste o se l'account è Google-only.
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <Card className="w-full max-w-md p-8">
        <img src="/brand/marketsync-logo.png" alt="MarketSync" className="h-9 object-contain" />
        <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">
          Password dimenticata?
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Inserisci l'email del tuo account. Se è registrata, riceverai un link per reimpostare la password.
        </p>

        {submitted ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/15">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Se l'email è registrata, riceverai le istruzioni per reimpostare la password.
            </p>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <ErrorMessage message={formError} title="Errore" />

            <Input
              autoComplete="email"
              disabled={isSubmitting}
              id="forgot-email"
              label="Email"
              name="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@azienda.it"
              type="email"
              value={email}
            />

            <Button className="w-full" disabled={isSubmitting} type="submit">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? "Invio in corso" : "Invia istruzioni"}
            </Button>
          </form>
        )}

        <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <Link
            className="text-sm font-medium text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
            to={APP_ROUTES.login}
          >
            Torna al login
          </Link>
        </div>
      </Card>
    </div>
  );
}
