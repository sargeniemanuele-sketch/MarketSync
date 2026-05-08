import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../api/authApi.js";
import * as clientsApi from "../api/clientsApi.js";
import useAppData from "./useAppData.js";

const initialState = {
  clients: [],
  error: null,
  isCreating: false,
  isLoading: false,
  meta: {},
  warnings: [],
};

export default function useClients({ autoLoad = true } = {}) {
  const { refreshBootstrap } = useAppData();
  const [state, setState] = useState(initialState);
  const requestIdRef = useRef(0);

  const fetchClients = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setState((current) => ({
      ...current,
      error: null,
      isLoading: true,
    }));

    try {
      const response = await clientsApi.getClients();

      if (requestIdRef.current !== requestId) {
        return null;
      }

      setState((current) => ({
        ...current,
        clients: response.clients,
        error: null,
        isLoading: false,
        meta: response.meta,
        warnings: response.warnings,
      }));

      return response;
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setState((current) => ({
          ...current,
          error: getApiErrorMessage(error, "Caricamento clienti non riuscito."),
          isLoading: false,
        }));
      }

      return null;
    }
  }, []);

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    fetchClients();
  }, [autoLoad, fetchClients]);

  const refreshClients = useCallback(() => fetchClients(), [fetchClients]);

  const createClient = useCallback(
    async (payload) => {
      setState((current) => ({
        ...current,
        error: null,
        isCreating: true,
      }));

      try {
        const response = await clientsApi.createClient(payload);
        await fetchClients();

        if (response.client?.id) {
          await refreshBootstrap({ preferredClientId: response.client.id });
        } else {
          await refreshBootstrap();
        }

        return response.client;
      } catch (error) {
        const message = getApiErrorMessage(error, "Creazione cliente non riuscita.");

        setState((current) => ({
          ...current,
          error: message,
        }));

        throw new Error(message);
      } finally {
        setState((current) => ({
          ...current,
          isCreating: false,
        }));
      }
    },
    [fetchClients, refreshBootstrap],
  );

  return {
    ...state,
    createClient,
    fetchClients,
    refreshClients,
  };
}
