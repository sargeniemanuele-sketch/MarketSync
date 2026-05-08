import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../api/authApi.js";
import * as clientsApi from "../api/clientsApi.js";
import useAppData from "./useAppData.js";

export default function useClientDetail(clientId, { autoLoad = true } = {}) {
  const { refreshBootstrap } = useAppData();
  const [client, setClient] = useState(null);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [meta, setMeta] = useState({});
  const requestIdRef = useRef(0);

  const loadClient = useCallback(async () => {
    if (!clientId) {
      setClient(null);
      setError("Cliente non specificato.");
      return null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoading(true);
    setError(null);

    try {
      const response = await clientsApi.getClientById(clientId);

      if (requestIdRef.current !== requestId) {
        return null;
      }

      setClient(response.client);
      setWarnings(response.warnings);
      setMeta(response.meta);
      return response.client;
    } catch (loadError) {
      if (requestIdRef.current === requestId) {
        setClient(null);
        setError(getApiErrorMessage(loadError, "Caricamento cliente non riuscito."));
        setWarnings([]);
        setMeta({});
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

    loadClient();
  }, [autoLoad, loadClient]);

  const updateClient = useCallback(
    async (payload) => {
      setIsSaving(true);
      setSaveError(null);

      try {
        const response = await clientsApi.updateClient(clientId, payload);
        setClient(response.client);
        setWarnings(response.warnings);
        setMeta(response.meta);
        await refreshBootstrap({ preferredClientId: response.client?.id ?? clientId });
        return response.client;
      } catch (updateError) {
        const message = getApiErrorMessage(updateError, "Aggiornamento cliente non riuscito.");
        setSaveError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [clientId, refreshBootstrap],
  );

  const deleteClient = useCallback(async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await clientsApi.deleteClient(clientId);
      setClient(null);
      await refreshBootstrap();
      return response;
    } catch (deleteClientError) {
      const message = getApiErrorMessage(deleteClientError, "Eliminazione cliente non riuscita.");
      setDeleteError(message);
      throw new Error(message);
    } finally {
      setIsDeleting(false);
    }
  }, [clientId, refreshBootstrap]);

  return {
    client,
    deleteClient,
    deleteError,
    error,
    isDeleting,
    isLoading,
    isSaving,
    loadClient,
    meta,
    saveError,
    updateClient,
    warnings,
  };
}
