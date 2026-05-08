import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../api/authApi.js";
import { getMetricDetail } from "../api/metricsApi.js";

const emptyState = {
  chart: null,
  detail: null,
  error: null,
  errorCode: null,
  isLoading: false,
  meta: {},
  metric: null,
  table: null,
  warnings: [],
};

function isCanceledRequest(error) {
  return error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
}

function getApiErrorCode(error) {
  return error?.response?.data?.error?.code ?? null;
}

function canLoadMetricDetail({
  clientId,
  enabled,
  endDate,
  metricKey,
  provider,
  range,
  startDate,
}) {
  if (!enabled || !clientId || !provider || !metricKey || !range) {
    return false;
  }

  if (range === "custom" && (!startDate || !endDate)) {
    return false;
  }

  return true;
}

export default function useMetricDetail({
  clientId,
  enabled = true,
  endDate,
  granularity = "auto",
  metricKey,
  provider,
  range,
  startDate,
} = {}) {
  const [state, setState] = useState(emptyState);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const requestIdRef = useRef(0);

  const refetch = useCallback(() => {
    setRefreshIndex((current) => current + 1);
  }, []);

  useEffect(() => {
    const shouldLoad = canLoadMetricDetail({
      clientId,
      enabled,
      endDate,
      metricKey,
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
      isLoading: true,
    }));

    async function loadMetricDetail() {
      try {
        const response = await getMetricDetail(
          {
            clientId,
            endDate,
            granularity,
            metricKey,
            provider,
            range,
            startDate,
          },
          { signal: controller.signal },
        );

        if (requestIdRef.current !== requestId) {
          return;
        }

        const detail = response.data ?? null;

        setState({
          chart: detail?.chart ?? null,
          detail,
          error: null,
          errorCode: null,
          isLoading: false,
          meta: response.meta ?? detail?.meta ?? {},
          metric: detail?.metric ?? null,
          table: detail?.table ?? null,
          warnings: response.warnings ?? detail?.warnings ?? [],
        });
      } catch (error) {
        if (isCanceledRequest(error) || requestIdRef.current !== requestId) {
          return;
        }

        setState((current) => ({
          ...current,
          error:
            getApiErrorCode(error) === "INVALID_GRANULARITY_FOR_RANGE"
              ? "La visualizzazione oraria è disponibile solo per periodi fino a 7 giorni."
              : getApiErrorMessage(error, "Dettaglio metrica non caricato."),
          errorCode: getApiErrorCode(error),
          isLoading: false,
        }));
      }
    }

    loadMetricDetail();

    return () => {
      controller.abort();
    };
  }, [
    clientId,
    enabled,
    endDate,
    granularity,
    metricKey,
    provider,
    range,
    refreshIndex,
    startDate,
  ]);

  return {
    ...state,
    refetch,
  };
}
