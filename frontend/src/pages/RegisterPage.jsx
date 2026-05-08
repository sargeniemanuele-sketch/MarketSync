import { Camera, Chrome, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getApiErrorMessage, getGoogleAuthUrl } from "../api/authApi.js";
import * as profileApi from "../api/profileApi.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import Input from "../components/ui/Input.jsx";
import useAuth from "../hooks/useAuth.js";
import { APP_ROUTES } from "../utils/constants.js";

function validateAvatarFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return 'Formato non supportato. Usa JPG, PNG o WebP.';
  if (file.size > 2 * 1024 * 1024) return 'Il file è troppo grande. La dimensione massima è 2 MB.';
  return null;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { authError, clearAuthError, isAuthenticated, isLoading, register, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarFileError, setAvatarFileError] = useState(null);
  const avatarFileRef = useRef(null);

  useEffect(() => {
    clearAuthError();
  }, [clearAuthError]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleAvatarFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const error = validateAvatarFile(file);
    setAvatarFileError(error);
    setAvatarFile(error ? null : file);
  }

  function validateForm() {
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.confirmPassword) {
      return "Compila tutti i campi obbligatori.";
    }

    if (form.password !== form.confirmPassword) {
      return "Password e conferma password devono coincidere.";
    }

    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateForm();
    setFormError(validationError);

    if (validationError) {
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      if (avatarFile) {
        try {
          const updatedProfile = await profileApi.uploadProfileAvatar(avatarFile);
          updateUser({ avatarUrl: updatedProfile?.avatarUrl ?? null });
        } catch {
          // Avatar upload failed — account already created, continue to dashboard
        }
      }

      navigate(APP_ROUTES.dashboard, { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Registrazione non riuscita."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to={APP_ROUTES.dashboard} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <Card className="w-full max-w-md p-8">
        <img src="/brand/marketsync-logo.png" alt="MarketSync" className="h-9 object-contain" />
        <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">Crea account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Registra un account marketer per accedere alla dashboard in sola lettura.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <ErrorMessage message={formError || authError} title="Registrazione non riuscita" />

          <Input
            autoComplete="name"
            disabled={isSubmitting || isLoading}
            id="register-name"
            label="Nome"
            name="name"
            onChange={updateField}
            placeholder="Nome e cognome"
            type="text"
            value={form.name}
          />

          <Input
            autoComplete="email"
            disabled={isSubmitting || isLoading}
            id="register-email"
            label="Email"
            name="email"
            onChange={updateField}
            placeholder="nome@azienda.it"
            type="email"
            value={form.email}
          />

          <Input
            autoComplete="new-password"
            disabled={isSubmitting || isLoading}
            id="register-password"
            label="Password"
            name="password"
            onChange={updateField}
            placeholder="Almeno 8 caratteri"
            type="password"
            value={form.password}
          />

          <Input
            autoComplete="new-password"
            disabled={isSubmitting || isLoading}
            id="register-confirm-password"
            label="Conferma password"
            name="confirmPassword"
            onChange={updateField}
            placeholder="Ripeti la password"
            type="password"
            value={form.confirmPassword}
          />

          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            La password deve avere almeno 8 caratteri, una lettera e un numero.
          </p>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Foto profilo{" "}
              <span className="font-normal text-slate-500 dark:text-slate-400">(opzionale)</span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={isSubmitting || isLoading}
                onClick={() => avatarFileRef.current?.click()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                {avatarFile ? "Cambia foto" : "Scegli foto"}
              </Button>
              {avatarFile ? (
                <span className="max-w-48 truncate text-sm text-slate-600 dark:text-slate-300">
                  {avatarFile.name}
                </span>
              ) : null}
            </div>
            {avatarFileError ? (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400" role="alert">
                {avatarFileError}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPG, PNG o WebP. Massimo 2 MB.</p>
            <input
              ref={avatarFileRef}
              accept="image/jpeg,image/png,image/webp"
              aria-label="Seleziona foto profilo"
              className="hidden"
              disabled={isSubmitting || isLoading}
              onChange={handleAvatarFileChange}
              type="file"
            />
          </div>

          <Button className="w-full" disabled={isSubmitting || isLoading} type="submit">
            <User className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "Creazione account" : "Registrati"}
          </Button>
        </form>

        <div className="mt-4">
          <Button as="a" className="w-full" href={getGoogleAuthUrl()} variant="secondary">
            <Chrome className="h-4 w-4" aria-hidden="true" />
            Continua con Google
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-5 text-sm dark:border-slate-800">
          <span className="text-slate-600 dark:text-slate-300">Hai gia un account?</span>
          <Link className="font-medium text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200" to={APP_ROUTES.login}>
            Accedi
          </Link>
        </div>
      </Card>
    </div>
  );
}
