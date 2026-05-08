import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBootstrap } from "../api/appApi.js";
import { getApiErrorMessage } from "../api/authApi.js";
import useAuth from "../hooks/useAuth.js";
import { APP_STORAGE_KEYS } from "../utils/constants.js";
import { normalizeBootstrap } from "../utils/apiAdapters.js";

export const AppDataContext = createContext(null);

function getStorageKey(user) {
  const userKey = user?.id || user?.email || "default";
  return `${APP_STORAGE_KEYS.selectedClientId}:${userKey}`;
}

function readStoredClientId(user) {
  try {
    return window.localStorage.getItem(getStorageKey(user));
  } catch {
    return null;
  }
}

function saveStoredClientId(user, clientId) {
  try {
    const key = getStorageKey(user);

    if (clientId) {
      window.localStorage.setItem(key, clientId);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // localStorage e solo un fallback UX: l'app resta funzionante anche se non disponibile.
  }
}

function chooseInitialClientId({ backendClientId, clients, preferredClientId, storedClientId }) {
  const clientIds = new Set(clients.map((client) => client.id));
  const normalizedPreferredClientId =
    preferredClientId === null || preferredClientId === undefined
      ? null
      : String(preferredClientId);
  const hasPreferredClient =
    normalizedPreferredClientId && clientIds.has(normalizedPreferredClientId);
  const hasBackendClient = backendClientId && clientIds.has(backendClientId);
  const hasStoredClient = storedClientId && clientIds.has(storedClientId);

  if (hasPreferredClient) {
    return { notice: null, selectedClientId: normalizedPreferredClientId };
  }

  if (hasBackendClient) {
    return { notice: null, selectedClientId: backendClientId };
  }

  if (hasStoredClient) {
    return {
      notice: backendClientId
        ? "Il cliente selezionato in precedenza non è più disponibile. Ho ripristinato l'ultimo cliente ancora valido."
        : null,
      selectedClientId: storedClientId,
    };
  }

  if (clients[0]?.id) {
    return {
      notice:
        backendClientId || storedClientId
          ? "Il cliente selezionato in precedenza non e piu disponibile. Ho selezionato il primo cliente disponibile."
          : null,
      selectedClientId: clients[0].id,
    };
  }

  return { notice: null, selectedClientId: null };
}

export function AppDataProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [bootstrap, setBootstrap] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [meta, setMeta] = useState({});
  const [selectionNotice, setSelectionNotice] = useState(null);
  const requestIdRef = useRef(0);

  const resetAppData = useCallback(() => {
    requestIdRef.current += 1;
    setBootstrap(null);
    setClients([]);
    setSelectedClientId(null);
    setIsBootstrapLoading(false);
    setBootstrapError(null);
    setWarnings([]);
    setMeta({});
    setSelectionNotice(null);
  }, []);

  const refreshBootstrap = useCallback(async ({ preferredClientId } = {}) => {
    if (!isAuthenticated || !user) {
      resetAppData();
      return null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsBootstrapLoading(true);
    setBootstrapError(null);

    try {
      const response = await getBootstrap();

      if (requestIdRef.current !== requestId) {
        return null;
      }

      const nextBootstrap = normalizeBootstrap(response.data);
      const nextClients = nextBootstrap.clients;
      const storedClientId = readStoredClientId(user);
      const choice = chooseInitialClientId({
        backendClientId: nextBootstrap.lastSelectedClientId,
        clients: nextClients,
        preferredClientId,
        storedClientId,
      });

      setBootstrap(nextBootstrap);
      setClients(nextClients);
      setSelectedClientId(choice.selectedClientId);
      setSelectionNotice(choice.notice);
      setWarnings(response.warnings ?? []);
      setMeta(response.meta ?? {});
      saveStoredClientId(user, choice.selectedClientId);

      return nextBootstrap;
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setBootstrapError(
          getApiErrorMessage(error, "Inizializzazione dell'app non riuscita."),
        );
        setBootstrap(null);
        setClients([]);
        setSelectedClientId(null);
        setWarnings([]);
        setMeta({});
      }

      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        setIsBootstrapLoading(false);
      }
    }
  }, [isAuthenticated, resetAppData, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      resetAppData();
      return;
    }

    refreshBootstrap();
  }, [isAuthenticated, refreshBootstrap, resetAppData, user]);

  const selectClient = useCallback(
    (clientId) => {
      const nextClientId = clientId ? String(clientId) : null;

      if (!nextClientId) {
        setSelectedClientId(null);
        setSelectionNotice(null);
        saveStoredClientId(user, null);
        return null;
      }

      const nextClient = clients.find((client) => client.id === nextClientId);

      if (!nextClient) {
        setSelectionNotice("Il cliente selezionato non e piu disponibile.");
        return null;
      }

      setSelectedClientId(nextClientId);
      setSelectionNotice(null);
      saveStoredClientId(user, nextClientId);
      return nextClient;
    },
    [clients, user],
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const integrationsByClient = useMemo(
    () =>
      Object.fromEntries(
        clients.map((client) => [client.id, client.integrations]),
      ),
    [clients],
  );

  const value = useMemo(
    () => ({
      bootstrap,
      bootstrapError,
      clients,
      hasClients: clients.length > 0,
      integrationsByClient,
      isBootstrapLoading,
      meta,
      refreshBootstrap,
      resetAppData,
      selectClient,
      selectedClient,
      selectedClientId,
      selectedClientIntegrations: selectedClient?.integrations ?? null,
      selectionNotice,
      warnings,
    }),
    [
      bootstrap,
      bootstrapError,
      clients,
      integrationsByClient,
      isBootstrapLoading,
      meta,
      refreshBootstrap,
      resetAppData,
      selectClient,
      selectedClient,
      selectedClientId,
      selectionNotice,
      warnings,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
