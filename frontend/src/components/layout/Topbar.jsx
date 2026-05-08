import { AlertTriangle, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { generatePath, useLocation, useNavigate } from "react-router-dom";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import useAuth from "../../hooks/useAuth.js";
import useAppData from "../../hooks/useAppData.js";
import { APP_NAME, APP_ROUTE_LABELS, APP_ROUTES } from "../../utils/constants.js";

function getPageTitle(pathname) {
  if (pathname.startsWith(`${APP_ROUTES.clients}/`)) {
    return "Dettaglio cliente";
  }

  return APP_ROUTE_LABELS[pathname] || APP_NAME;
}

function getInitials(user) {
  const name = String(user?.name ?? "").trim();

  if (name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  const email = String(user?.email ?? "").trim();
  return email ? email[0].toUpperCase() : "U";
}

function AccountAvatar({ user }) {
  const avatarUrl = user?.avatarUrl ?? null;
  const [hasAvatarError, setHasAvatarError] = useState(false);

  useEffect(() => {
    setHasAvatarError(false);
  }, [avatarUrl]);

  return (
    <div className="relative flex h-6 w-6 flex-none items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-100">
      <span>{getInitials(user)}</span>
      {avatarUrl && !hasAvatarError ? (
        <img
          alt={`Foto profilo di ${user?.name || "utente"}`}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setHasAvatarError(true)}
          src={avatarUrl}
        />
      ) : null}
    </div>
  );
}

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoading, logout, user } = useAuth();
  const {
    bootstrapError,
    isBootstrapLoading,
    selectedClient,
    selectionNotice,
  } = useAppData();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);
  const selectedClientName = selectedClient?.name || "Nessun cliente";
  const selectedClientPath = selectedClient?.id
    ? generatePath(APP_ROUTES.clientDetail, { clientId: selectedClient.id })
    : APP_ROUTES.clients;

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      navigate(APP_ROUTES.login, { replace: true });
    }
  }

  function handleClientClick() {
    if (!selectedClient) {
      return;
    }

    navigate(selectedClientPath);
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-brand-700 dark:text-brand-300">{APP_NAME}</p>
          <h1 className="truncate text-lg font-semibold text-slate-950 dark:text-slate-50">{pageTitle}</h1>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="hidden min-w-0 flex-col lg:flex">
            <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
              Cliente
            </span>
            {selectedClient ? (
              <button
                className="max-w-40 truncate rounded-md text-left text-sm font-medium text-slate-900 outline-none transition hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-200 dark:text-slate-100 dark:hover:text-brand-300 dark:focus-visible:ring-brand-500/40"
                onClick={handleClientClick}
                title={selectedClientName}
                type="button"
              >
                {isBootstrapLoading ? "Caricamento" : selectedClientName}
              </button>
            ) : (
              <span className="max-w-40 truncate text-sm font-medium text-slate-500 dark:text-slate-400">
                {isBootstrapLoading ? "Caricamento" : "Nessun cliente"}
              </span>
            )}
          </div>
          {bootstrapError ? (
            <Badge tone="danger">
              <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
              Dati non caricati
            </Badge>
          ) : null}
          {!bootstrapError && isBootstrapLoading ? <Badge tone="neutral">Aggiornamento</Badge> : null}
          {!bootstrapError && selectionNotice ? (
            <Badge className="hidden max-w-52 truncate sm:inline-flex" tone="warning">
              {selectionNotice}
            </Badge>
          ) : null}
          <button
            className="flex min-w-0 items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-600 outline-none transition hover:border-brand-200 hover:bg-brand-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-brand-200 sm:px-3 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus-visible:ring-brand-500/40"
            onClick={() => navigate(APP_ROUTES.profile)}
            title="Apri profilo"
            type="button"
          >
            <AccountAvatar user={user} />
            <span className="hidden truncate sm:inline">{user?.name || user?.email || "Account"}</span>
          </button>
          <Button
            aria-label="Esci"
            disabled={isLoading || isLoggingOut}
            onClick={handleLogout}
            size="sm"
            variant="ghost"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{isLoggingOut ? "Uscita" : "Esci"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
