import { useCallback, useEffect, useRef, useState } from "react";
import { getProviderMetrics } from "../api/metricsApi.js";
import { getIntegrationErrorMessage } from "../api/integrationsApi.js";
import { normalizeProviderMetrics } from "../utils/apiAdapters.js";
import { PROVIDER_KEYS } from "../utils/constants.js";

const emptyState = {
  error: null,
  errorCode: null,
  errorProvider: null,
  errorScope: null,
  isLoading: false,
  meta: {},
  primaryCards: [],
  secondaryCards: [],
  section: null,
  warnings: [],
};

const supportedProviders = new Set([
  PROVIDER_KEYS.shopify,
  PROVIDER_KEYS.meta_ads,
  PROVIDER_KEYS.google_ads,
]);

function isCanceledRequest(error) {
  return error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
}

function getApiErrorDetails(error) {
  const apiError = error?.response?.data?.error ?? {};

  return {
    code: apiError.code ?? null,
    provider: apiError.provider ?? null,
    scope: apiError.scope ?? null,
  };
}

function canLoadProviderMetrics({ clientId, enabled, endDate, provider, range, startDate }) {
  if (!enabled || !clientId || !range || !supportedProviders.has(provider)) {
    return false;
  }

  if (range === "custom" && (!startDate || !endDate)) {
    return false;
  }

  return true;
}

export default function useProviderMetrics({
  clientId,
  cooldownMs = 60_000,
  enabled = true,
  endDate,
  provider,
  range,
  startDate,
} = {}) {
  const [state, setState] = useState(emptyState);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const requestIdRef = useRef(0);
  const lastRefetchAtRef = useRef(null);
  const cooldownTimerRef = useRef(null);

  const refetch = useCallback(() => {
    const now = Date.now();
    const lastAt = lastRefetchAtRef.current;

    if (lastAt !== null && now - lastAt < cooldownMs) {
      return;
    }

    lastRefetchAtRef.current = now;

    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }

    setCooldownSeconds(Math.ceil(cooldownMs / 1000));

    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setRefreshIndex((current) => current + 1);
  }, [cooldownMs]);

  // Cleanup timer su unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const shouldLoad = canLoadProviderMetrics({
      clientId,
      enabled,
      endDate,
      provider,
      range,
      startDate,
    });

    if (!shouldLoad) {
      requestIdRef.current += 1;
      setState(emptyState);
      return undefined;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();

    setState((current) => ({
      ...current,
      error: null,
      errorCode: null,
      errorProvider: null,
      errorScope: null,
      isLoading: true,
    }));

    async function loadProviderMetrics() {
      try {
        const response = await getProviderMetrics(
          provider,
          {
            clientId,
            endDate,
            range,
            startDate,
          },
          { signal: controller.signal },
        );

        if (requestIdRef.current !== requestId) {
          return;
        }

        const providerData = normalizeProviderMetrics({
          data: response.data,
          meta: response.meta,
          provider,
          warnings: response.warnings,
        });

        setState({
          error: null,
          errorCode: null,
          errorProvider: null,
          errorScope: null,
          isLoading: false,
          meta: providerData.meta,
          primaryCards: providerData.primaryCards,
          secondaryCards: providerData.secondaryCards,
          section: providerData.section,
          warnings: providerData.warnings,
        });
      } catch (error) {
        if (isCanceledRequest(error) || requestIdRef.current !== requestId) {
          return;
        }

        const details = getApiErrorDetails(error);

        setState((current) => ({
          ...current,
          error: getIntegrationErrorMessage(error, "Caricamento metriche provider non riuscito."),
          errorCode: details.code,
          errorProvider: details.provider,
          errorScope: details.scope,
          isLoading: false,
        }));
      }
    }

    loadProviderMetrics();

    return () => {
      controller.abort();
    };
  }, [clientId, enabled, endDate, provider, range, refreshIndex, startDate]);

  return {
    ...state,
    cooldownSeconds,
    refetch,
  };
}
