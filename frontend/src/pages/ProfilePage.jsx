import {
  AlertTriangle,
  AtSign,
  CalendarPlus,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserCircle,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/authApi.js";
import * as profileApi from "../api/profileApi.js";
import Badge from "../components/ui/Badge.jsx";
import BackButton from "../components/ui/BackButton.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import Input from "../components/ui/Input.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import SaveButton from "../components/ui/SaveButton.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import useAppData from "../hooks/useAppData.js";
import useAuth from "../hooks/useAuth.js";
import { APP_ROUTES } from "../utils/constants.js";
import { formatDateTime } from "../utils/formatters.js";

const initialForm = {
  name: "",
  nickname: "",
  bio: "",
};

const providerLabels = {
  google: "Google",
  local: "Email e password",
  mixed: "Email + Google",
};

const providerNotes = {
  google:
    "Hai effettuato l'accesso con Google. Email e password sono gestite dal tuo account Google.",
  local: "Email e password non sono modificabili da questa sezione.",
  mixed:
    "Questo account puo accedere sia con email/password sia con Google. Email e password non sono modificabili da questa sezione.",
};

const deletedDataLabels = [
  "Profilo utente",
  "Clienti creati",
  "Integrazioni collegate",
  "Dati temporanei delle metriche",
  "Storico aggiornamenti",
  "Preferenze dashboard",
];

function normalizeText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function buildForm(profile) {
  return {
    name: profile?.name ?? "",
    nickname: profile?.nickname ?? "",
    bio: profile?.bio ?? "",
  };
}

function buildPayload(form) {
  return {
    name: String(form.name ?? "").trim(),
    nickname: normalizeText(form.nickname),
    bio: normalizeText(form.bio),
  };
}

function getInitials(profile) {
  const name = String(profile?.name ?? "").trim();

  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  const email = String(profile?.email ?? "").trim();
  return email ? email[0].toUpperCase() : "U";
}

function validateForm(form) {
  const errors = {};
  const name = String(form.name ?? "").trim();
  const nickname = String(form.nickname ?? "").trim();
  const bio = String(form.bio ?? "");

  if (!name) {
    errors.name = "Il nome visualizzato e obbligatorio.";
  } else if (name.length < 2) {
    errors.name = "Il nome deve avere almeno 2 caratteri.";
  } else if (name.length > 80) {
    errors.name = "Il nome non puo superare 80 caratteri.";
  }

  if (nickname) {
    if (nickname.length < 2) {
      errors.nickname = "Il nickname deve avere almeno 2 caratteri.";
    } else if (nickname.length > 40) {
      errors.nickname = "Il nickname non puo superare 40 caratteri.";
    } else if (/\s/.test(form.nickname)) {
      errors.nickname = "Il nickname non puo contenere spazi.";
    } else if (!/^[A-Za-z0-9_.-]+$/.test(nickname)) {
      errors.nickname =
        "Usa solo lettere, numeri, underscore, punto e trattino.";
    }
  }

  if (bio.length > 500) {
    errors.bio = "La bio non puo superare 500 caratteri.";
  }

  return errors;
}

function validateAvatarFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return 'Formato non supportato. Usa JPG, PNG o WebP.';
  if (file.size > 2 * 1024 * 1024) return 'Il file è troppo grande. La dimensione massima è 2 MB.';
  return null;
}

function hasProfileChanges(form, profile) {
  if (!profile) {
    return false;
  }

  const payload = buildPayload(form);
  return (
    payload.name !== (profile.name ?? "") ||
    payload.nickname !== (profile.nickname ?? null) ||
    payload.bio !== (profile.bio ?? null)
  );
}

function ProfileAvatar({ profile, size = "lg" }) {
  const sizeClass = size === "lg" ? "h-24 w-24 text-2xl" : "h-14 w-14 text-lg";
  const avatarUrl = profile?.avatarUrl ?? null;
  const [hasAvatarError, setHasAvatarError] = useState(false);

  useEffect(() => {
    setHasAvatarError(false);
  }, [avatarUrl]);

  return (
    <div
      className={[
        "relative flex flex-none items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700 ring-4 ring-white dark:bg-brand-500/20 dark:text-brand-100 dark:ring-slate-900",
        sizeClass,
      ].join(" ")}
    >
      <span>{getInitials(profile)}</span>
      {avatarUrl && !hasAvatarError ? (
        <img
          alt={`Foto profilo di ${profile?.name || "utente"}`}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setHasAvatarError(true)}
          src={avatarUrl}
        />
      ) : null}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="grid gap-2 px-4 py-4 sm:grid-cols-3 sm:gap-4">
      <dt className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className="break-words text-sm font-medium text-slate-950 dark:text-slate-50 sm:col-span-2">
        {value || "Non disponibile"}
      </dd>
    </div>
  );
}

function DeleteAccountModal({
  confirmation,
  deleteError,
  isDeleting,
  isOpen,
  onCancel,
  onChange,
  onConfirm,
}) {
  if (!isOpen) {
    return null;
  }

  const canDelete = confirmation === "ELIMINA" && !isDeleting;

  return (
    <div
      aria-labelledby="delete-account-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6"
      role="dialog"
    >
      <div className="w-full max-w-xl rounded-lg border border-rose-200 bg-white p-6 shadow-soft dark:border-rose-500/30 dark:bg-slate-900 dark:shadow-none">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50" id="delete-account-title">
              Elimina definitivamente l'account
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Questa azione e irreversibile. Il tuo account MarketSync e tutti i dati
              collegati verranno eliminati definitivamente.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-rose-100 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/15">
          <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">Verranno eliminati:</p>
          <ul className="mt-3 grid gap-2 text-sm text-rose-800 dark:text-rose-200 sm:grid-cols-2">
            {deletedDataLabels.map((label) => (
              <li className="flex items-center gap-2" key={label}>
                <AlertTriangle className="h-4 w-4 flex-none" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          <Input
            autoComplete="off"
            disabled={isDeleting}
            helpText='Digita esattamente "ELIMINA" per confermare.'
            id="delete-confirmation"
            label="Conferma eliminazione"
            onChange={onChange}
            value={confirmation}
          />
        </div>

        {deleteError ? (
          <div className="mt-4">
            <ErrorMessage message={deleteError} title="Eliminazione non riuscita" />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={isDeleting} onClick={onCancel} variant="secondary">
            Annulla
          </Button>
          <Button
            disabled={!canDelete}
            isLoading={isDeleting}
            onClick={onConfirm}
            variant="danger"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Si, elimina definitivamente
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { clearSession, updateUser, user } = useAuth();
  const { resetAppData } = useAppData();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoadingProfile(true);
      setLoadError(null);

      try {
        const nextProfile = await profileApi.getProfile();

        if (!isMounted) {
          return;
        }

        setProfile(nextProfile);
        setForm(buildForm(nextProfile));
      } catch (error) {
        if (isMounted) {
          setLoadError(getApiErrorMessage(error, "Profilo non disponibile."));
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const formErrors = useMemo(() => validateForm(form), [form]);
  const isFormValid = Object.keys(formErrors).length === 0;
  const hasChanges = useMemo(() => hasProfileChanges(form, profile), [form, profile]);
  const providerLabel =
    providerLabels[profile?.loginProvider] ?? providerLabels[user?.loginProvider] ?? "Non disponibile";
  const providerNote =
    providerNotes[profile?.loginProvider] ??
    providerNotes[user?.loginProvider] ??
    "Email e password non sono modificabili da questa sezione.";

  function handleFormChange(event) {
    const { id, value } = event.target;
    const field = id.replace("profile-", "");

    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setSaveError(null);
    setSuccessMessage(null);
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setAvatarUploadError(validationError);
      return;
    }

    setAvatarUploadError(null);
    setIsUploadingAvatar(true);

    try {
      const updatedProfile = await profileApi.uploadProfileAvatar(file);
      setProfile(updatedProfile);
      updateUser({ avatarUrl: updatedProfile?.avatarUrl ?? null });
    } catch (error) {
      setAvatarUploadError(
        getApiErrorMessage(error, "Upload foto non riuscito. Riprova.")
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleDeleteAvatar() {
    if (isUploadingAvatar) return;
    setAvatarUploadError(null);
    setIsUploadingAvatar(true);

    try {
      const updatedProfile = await profileApi.deleteProfileAvatar();
      setProfile(updatedProfile);
      updateUser({ avatarUrl: null });
    } catch (error) {
      setAvatarUploadError(
        getApiErrorMessage(error, "Rimozione foto non riuscita. Riprova.")
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!isFormValid || !hasChanges || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSuccessMessage(null);

    try {
      const updatedProfile = await profileApi.updateProfile(buildPayload(form));
      setProfile(updatedProfile);
      setForm(buildForm(updatedProfile));
      updateUser({
        avatarUrl: updatedProfile?.avatarUrl ?? null,
        bio: updatedProfile?.bio ?? null,
        loginProvider: updatedProfile?.loginProvider ?? null,
        name: updatedProfile?.name ?? "",
        nickname: updatedProfile?.nickname ?? null,
      });
      setSuccessMessage("Profilo aggiornato correttamente.");
    } catch (error) {
      setSaveError(getApiErrorMessage(error, "Salvataggio non riuscito."));
    } finally {
      setIsSaving(false);
    }
  }

  function openDeleteModal() {
    setDeleteConfirmation("");
    setDeleteError(null);
    setIsDeleteOpen(true);
  }

  function closeDeleteModal() {
    if (isDeleting) {
      return;
    }

    setIsDeleteOpen(false);
    setDeleteConfirmation("");
    setDeleteError(null);
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation !== "ELIMINA" || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await profileApi.deleteProfile();
      resetAppData();
      clearSession();
      navigate(APP_ROUTES.login, { replace: true });
    } catch (error) {
      setDeleteError(getApiErrorMessage(error, "Eliminazione account non riuscita."));
      setIsDeleting(false);
    }
  }

  if (isLoadingProfile) {
    return (
      <div className="max-w-5xl space-y-6">
        <PageHeader
          actions={<BackButton label="Torna alle impostazioni" to={APP_ROUTES.settings} />}
          description="Gestisci identita, preferenze visibili e sicurezza del tuo account."
          eyebrow="Account"
          title="Profilo"
        />
        <Card>
          <Spinner label="Caricamento profilo" />
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-5xl space-y-6">
        <PageHeader
          actions={<BackButton label="Torna alle impostazioni" to={APP_ROUTES.settings} />}
          description="Gestisci identita, preferenze visibili e sicurezza del tuo account."
          eyebrow="Account"
          title="Profilo"
        />
        <ErrorMessage message={loadError} title="Profilo non disponibile" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-5xl space-y-6">
        <PageHeader
          actions={<BackButton label="Torna alle impostazioni" to={APP_ROUTES.settings} />}
          description="Gestisci identita, preferenze visibili e sicurezza del tuo account."
          eyebrow="Account"
          title="Profilo"
        />
        <Card>
          <div className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
            <UserCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <p className="text-sm">Nessun profilo trovato per questa sessione.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        actions={<BackButton label="Torna alle impostazioni" to={APP_ROUTES.settings} />}
        description="Gestisci identita, preferenze visibili e sicurezza del tuo account."
        eyebrow="Account"
        meta={<Badge tone="success">Profilo attivo</Badge>}
        title="Profilo"
      />

      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-brand-800 px-5 py-8 text-white sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            {/* Avatar: con overlay upload solo per utenti email/password */}
            <div className="relative flex-none">
              {profile.loginProvider !== "google" ? (
                <div className="group relative">
                  <ProfileAvatar profile={profile} />
                  <button
                    aria-label={isUploadingAvatar ? "Caricamento in corso" : "Carica foto profilo"}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100 disabled:cursor-not-allowed"
                    disabled={isUploadingAvatar}
                    onClick={() => avatarInputRef.current?.click()}
                    type="button"
                  >
                    {isUploadingAvatar ? (
                      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <Camera className="h-5 w-5 text-white" aria-hidden="true" />
                    )}
                  </button>
                </div>
              ) : (
                <ProfileAvatar profile={profile} />
              )}
              {profile.loginProvider !== "google" ? (
                <input
                  ref={avatarInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Seleziona foto profilo"
                  className="hidden"
                  disabled={isUploadingAvatar}
                  onChange={handleAvatarChange}
                  type="file"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-2xl font-semibold tracking-normal">
                  {profile.name}
                </h2>
                <Badge className="bg-white/10 text-white ring-white/20">{providerLabel}</Badge>
              </div>
              {profile.nickname ? (
                <p className="mt-2 text-sm font-medium text-brand-100">@{profile.nickname}</p>
              ) : null}
              <p className="mt-2 break-all text-sm text-slate-200">{profile.email}</p>

              {/* Controlli avatar — visibili solo per utenti email/password */}
              {profile.loginProvider !== "google" ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    className="text-xs text-slate-300 underline-offset-2 hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isUploadingAvatar}
                    onClick={() => avatarInputRef.current?.click()}
                    type="button"
                  >
                    Foto profilo opzionale
                  </button>
                  {profile.avatarSource === "upload" ? (
                    <button
                      className="flex items-center gap-1 text-xs text-rose-300 underline-offset-2 hover:text-rose-200 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isUploadingAvatar}
                      onClick={handleDeleteAvatar}
                      type="button"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      Rimuovi foto
                    </button>
                  ) : null}
                  {avatarUploadError ? (
                    <p className="text-xs text-rose-300" role="alert">
                      {avatarUploadError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-400">
                  La foto profilo è gestita dal tuo account Google.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Informazioni profilo</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Dati principali associati al tuo account MarketSync.
            </p>
          </div>
          <Badge tone="neutral">{providerLabel}</Badge>
        </div>

        <dl className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <DetailRow icon={User} label="Nome" value={profile.name} />
          <DetailRow
            icon={AtSign}
            label="Nickname"
            value={profile.nickname ? `@${profile.nickname}` : "Non disponibile"}
          />
          <DetailRow icon={Mail} label="Email" value={profile.email} />
          <DetailRow
            icon={FileText}
            label="Bio"
            value={profile.bio || "Nessuna bio inserita."}
          />
          <DetailRow icon={ShieldCheck} label="Metodo di accesso" value={providerLabel} />
          <DetailRow
            icon={CalendarPlus}
            label="Creato il"
            value={profile.createdAt ? formatDateTime(profile.createdAt) : null}
          />
          <DetailRow
            icon={Clock}
            label="Ultimo accesso"
            value={profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : null}
          />
        </dl>
      </Card>

      <Card>
        <form className="space-y-5" onSubmit={handleSave}>
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Modifica profilo</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Aggiorna solo le informazioni modificabili del profilo.
            </p>
          </div>

          {saveError ? <ErrorMessage message={saveError} title="Salvataggio non riuscito" /> : null}
          {successMessage ? (
            <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
              <p className="text-sm font-medium">{successMessage}</p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              autoComplete="name"
              disabled={isSaving}
              error={formErrors.name}
              id="profile-name"
              label="Nome visualizzato"
              maxLength={80}
              onChange={handleFormChange}
              required
              value={form.name}
            />
            <Input
              autoComplete="nickname"
              disabled={isSaving}
              error={formErrors.nickname}
              helpText="Lettere, numeri, underscore, punto e trattino. Nessuno spazio."
              id="profile-nickname"
              label="Nickname"
              maxLength={40}
              onChange={handleFormChange}
              placeholder="nome-brand"
              value={form.nickname}
            />
            <div className="md:col-span-2">
              <label className="block" htmlFor="profile-bio">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Bio</span>
                <textarea
                  className="block min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-400 dark:focus:ring-brand-500/30 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                  disabled={isSaving}
                  id="profile-bio"
                  maxLength={500}
                  onChange={handleFormChange}
                  placeholder="Una breve descrizione del tuo ruolo o del tuo lavoro."
                  value={form.bio}
                />
              </label>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                <span className={formErrors.bio ? "text-rose-600 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}>
                  {formErrors.bio || "Massimo 500 caratteri."}
                </span>
                <span className="font-medium text-slate-500 dark:text-slate-400">{form.bio.length}/500</span>
              </div>
            </div>
          </div>

          {profile.loginProvider !== "google" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Foto profilo</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={isUploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {isUploadingAvatar ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-slate-700 dark:border-slate-600 dark:border-t-slate-200" aria-hidden="true" />
                  ) : (
                    <Camera className="h-4 w-4" aria-hidden="true" />
                  )}
                  {profile.avatarSource === "upload" ? "Cambia foto" : "Carica foto"}
                </Button>
                {profile.avatarSource === "upload" ? (
                  <Button
                    disabled={isUploadingAvatar}
                    onClick={handleDeleteAvatar}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Rimuovi foto
                  </Button>
                ) : null}
              </div>
              {avatarUploadError ? (
                <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
                  {avatarUploadError}
                </p>
              ) : null}
              <p className="text-xs text-slate-500 dark:text-slate-400">JPG, PNG o WebP. Massimo 2 MB.</p>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <p className="font-medium text-slate-800 dark:text-slate-100">Email non modificabile</p>
            <p className="mt-1">{providerNote}</p>
          </div>

          <div className="flex justify-end">
            <SaveButton
              className="w-full sm:w-auto"
              disabled={!isFormValid || !hasChanges || isSaving}
              label="Salva modifiche"
              loading={isSaving}
              type="submit"
            />
          </div>
        </form>
      </Card>

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
            Zona pericolosa
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Elimina account</h2>
        </div>
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/15">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h3 className="text-base font-semibold text-rose-950 dark:text-rose-100">
                Elimina definitivamente l'account
              </h3>
              <p className="mt-2 text-sm leading-6 text-rose-900 dark:text-rose-200">
                Questa azione eliminera definitivamente il tuo account MarketSync e tutti i
                dati collegati. Non potrai annullarla.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-rose-900 dark:text-rose-200 sm:grid-cols-2">
                {deletedDataLabels.map((label) => (
                  <li className="flex items-center gap-2" key={label}>
                    <AlertTriangle className="h-4 w-4 flex-none" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <Button className="flex-none" onClick={openDeleteModal} variant="danger">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Elimina definitivamente l'account
            </Button>
          </div>
        </Card>
      </section>

      <DeleteAccountModal
        confirmation={deleteConfirmation}
        deleteError={deleteError}
        isDeleting={isDeleting}
        isOpen={isDeleteOpen}
        onCancel={closeDeleteModal}
        onChange={(event) => setDeleteConfirmation(event.target.value)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
