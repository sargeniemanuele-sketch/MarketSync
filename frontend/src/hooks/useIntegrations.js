import { useCallback, useEffect, useRef, useState } from "react";
import * as integrationsApi from "../api/integrationsApi.js";
import { normalizeIntegrations } from "../utils/apiAdapters.js";
import { PROVIDER_KEYS, PROVIDERS } from "../utils/constants.js";
import useAppData from "./useAppData.js";

const initialState = {
  accounts: {},
  error: null,
  integrations: normalizeIntegrations(),
  meta: {},
  successMessage: null,
  warnings: [],
};

const accountProviders = new Set([PROVIDER_KEYS.meta_ads, PROVIDER_KEYS.google_ads]);

function getProviderLabel(provider) {
  return PROVIDERS[provider]?.label ?? provider;
}

function getActionErrorMessage(error, fallback) {
  return integrationsApi.getIntegrationErrorMessage(error, fallback);
}

function getEmptyAccountsMessage(provider) {
  if (provider === PROVIDER_KEYS.google_ads) {
    return "Nessun account Google Ads trovato. Se gestisci gli account tramite un account manager, verifica che l'account Google usato per il collegamento abbia accesso agli account necessari.";
  }

  return `Nessun account ${getProviderLabel(provider)} disponibile.`;
}

function buildAccountSelectionRef(provider, payload = {}) {
  return [
    provider,
    payload.externalRef,
    payload.managerCustomerId || "direct",
  ].join(":");
}

export default function useIntegrations({ autoLoad = true, clientId: explicitClientId } = {}) {
  const { refreshBootstrap, selectedClientId } = useAppData();
  const clientId = explicitClientId ?? selectedClientId;
  const [state, setState] = useState(initialState);
  const [connectingProvider, setConnectingProvider] = useState(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState(null);
  const [loadingAccountsProvider, setLoadingAccountsProvider] = useState(null);
  const [selectingAccountRef, setSelectingAccountRef] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const fetchIntegrations = useCallback(async () => {
    if (!clientId) {
      requestIdRef.current += 1;
      setState(initialState);
      setIsLoading(false);
      return null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setState((current) => ({
      ...current,
      error: null,
    }));

    try {
      const response = await integrationsApi.getIntegrations(clientId);

      if (requestIdRef.current !== requestId) {
        return null;
      }

      setState((current) => ({
        ...current,
        error: null,
        integrations: response.integrations,
        meta: response.meta,
        warnings: response.warnings,
      }));

      return response;
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setState((current) => ({
          ...current,
          error: getActionErrorMessage(error, "Caricamento integrazioni non riuscito."),
        }));
      }

      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    fetchIntegrations();
  }, [autoLoad, fetchIntegrations]);

  const refreshAfterMutation = useCallback(async () => {
    await fetchIntegrations();
    await refreshBootstrap({ preferredClientId: clientId });
  }, [clientId, fetchIntegrations, refreshBootstrap]);

  const connectProvider = useCallback(
    async (provider, extraParams = {}) => {
      if (!clientId) {
        const message = "Seleziona un cliente prima di collegare una piattaforma.";
        setState((current) => ({ ...current, error: message, successMessage: null }));
        throw new Error(message);
      }

      setConnectingProvider(provider);
      setState((current) => ({ ...current, error: null, successMessage: null }));

      try {
        const response = await integrationsApi.connectIntegration(provider, {
          clientId,
          ...extraParams,
        });

        if (response.connectUrl) {
          window.location.href = response.connectUrl;
          return response;
        }

        await refreshAfterMutation();
        setState((current) => ({
          ...current,
          successMessage: `${getProviderLabel(provider)} collegato.`,
        }));

        return response;
      } catch (error) {
        const message = getActionErrorMessage(
          error,
          `Connessione ${getProviderLabel(provider)} non riuscita.`,
        );
        setState((current) => ({ ...current, error: message, successMessage: null }));
        throw new Error(message);
      } finally {
        setConnectingProvider(null);
      }
    },
    [clientId, refreshAfterMutation],
  );

  const loadProviderAccounts = useCallback(
    async (provider, extraParams = {}) => {
      if (!clientId) {
        const message = "Seleziona un cliente prima di caricare gli account.";
        setState((current) => ({ ...current, error: message, successMessage: null }));
        throw new Error(message);
      }

      if (!accountProviders.has(provider)) {
        const message = `La scelta dell'account non è prevista per ${getProviderLabel(provider)}.`;
        setState((current) => ({ ...current, error: message, successMessage: null }));
        throw new Error(message);
      }

      setLoadingAccountsProvider(provider);
      setState((current) => ({ ...current, error: null, successMessage: null }));

      try {
        const response = await integrationsApi.getProviderAccounts(provider, {
          clientId,
          ...extraParams,
        });

        setState((current) => ({
          ...current,
          accounts: {
            ...current.accounts,
            [provider]: response.accounts,
          },
          successMessage:
            response.accounts.length > 0
              ? `Account ${getProviderLabel(provider)} caricati.`
              : response.message || getEmptyAccountsMessage(provider),
        }));

        return response.accounts;
      } catch (error) {
        const message = getActionErrorMessage(
          error,
          `Caricamento account ${getProviderLabel(provider)} non riuscito.`,
        );
        setState((current) => ({ ...current, error: message, successMessage: null }));
        throw new Error(message);
      } finally {
        setLoadingAccountsProvider(null);
      }
    },
    [clientId],
  );

  const selectAccount = useCallback(
    async (provider, payload = {}) => {
      if (!clientId) {
        const message = "Seleziona un cliente prima di scegliere un account.";
        setState((current) => ({ ...current, error: message, successMessage: null }));
        throw new Error(message);
      }

      if (!payload.externalRef) {
        const message = "Impossibile selezionare l'account. Ricarica la lista e riprova.";
        setState((current) => ({ ...current, error: message, successMessage: null }));
        throw new Error(message);
      }

      setSelectingAccountRef(buildAccountSelectionRef(provider, payload));
      setState((current) => ({ ...current, error: null, successMessage: null }));

      try {
        const response = await integrationsApi.selectProviderAccount(provider, {
          clientId,
          ...payload,
        });

        await refreshAfterMutation();
        setState((current) => ({
          ...current,
          successMessage: `Account ${getProviderLabel(provider)} selezionato.`,
        }));

        return response;
      } catch (error) {
        const message = getActionErrorMessage(
          error,
          `Selezione account ${getProviderLabel(provider)} non riuscita.`,
        );
        setState((current) => ({ ...current, error: message, successMessage: null }));
        throw new Error(message);
      } finally {
        setSelectingAccountRef(null);
      }
    },
    [clientId, refreshAfterMutation],
  );

  const disconnectProvider = useCallback(
    async (provider) => {
      if (!clientId) {
        const message = "Seleziona un cliente prima di scollegare una piattaforma.";
        setState((current) => ({ ...current, error: message, successMessage: null }));
        throw new Error(message);
      }

      setDisconnectingProvider(provider);
      setState((current) => ({ ...current, error: null, successMessage: null }));

      try {
        const response = await integrationsApi.disconnectIntegration(provider, clientId);

        await refreshAfterMutation();
        setState((current) => ({
          ...current,
          accounts: {
            ...current.accounts,
            [provider]: [],
          },
          successMessage: `${getProviderLabel(provider)} disconnesso.`,
        }));

        return response;
      } catch (error) {
        const message = getActionErrorMessage(
          error,
          `Disconnessione ${getProviderLabel(provider)} non riuscita.`,
        );
        setState((current) => ({ ...current, error: message, successMessage: null }));
        throw new Error(message);
      } finally {
        setDisconnectingProvider(null);
      }
    },
    [clientId, refreshAfterMutation],
  );

  const clearMessages = useCallback(() => {
    setState((current) => ({ ...current, error: null, successMessage: null }));
  }, []);

  return {
    ...state,
    clearMessages,
    connectProvider,
    connectingProvider,
    disconnectingProvider,
    disconnectProvider,
    fetchIntegrations,
    isConnecting: Boolean(connectingProvider),
    isDisconnecting: Boolean(disconnectingProvider),
    isLoading,
    isLoadingAccounts: Boolean(loadingAccountsProvider),
    isSelectingAccount: Boolean(selectingAccountRef),
    loadProviderAccounts,
    loadingAccountsProvider,
    selectAccount,
    selectingAccountRef,
  };
}
