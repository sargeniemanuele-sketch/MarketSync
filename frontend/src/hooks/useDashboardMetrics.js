import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../api/authApi.js";
import { getDashboardMetrics } from "../api/metricsApi.js";
import { normalizeDashboardMetrics } from "../utils/apiAdapters.js";

const REFETCH_COOLDOWN_MS = 60_000;

const emptyState = {
  dashboardData: null,
  error: null,
  isLoading: false,
  meta: {},
  overview: null,
  sections: {},
  warnings: [],
};

function isCanceledRequest(error) {
  return error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
}

function canLoadDashboard({ clientId, enabled, endDate, range, startDate }) {
  if (!enabled || !clientId || !range) {
    return false;
  }

  if (range === "custom" && (!startDate || !endDate)) {
    return false;
  }

  return true;
}

export default function useDashboardMetrics({
  clientId,
  enabled = true,
  endDate,
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

    if (lastAt !== null && now - lastAt < REFETCH_COOLDOWN_MS) {
      return;
    }

    lastRefetchAtRef.current = now;

    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }

    setCooldownSeconds(Math.ceil(REFETCH_COOLDOWN_MS / 1000));

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
  }, []);

  // Cleanup timer su unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const shouldLoad = canLoadDashboard({
      clientId,
      enabled,
      endDate,
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
      isLoading: true,
    }));

    async function loadDashboardMetrics() {
      try {
        const response = await getDashboardMetrics(
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

        const dashboardData = normalizeDashboardMetrics({
          ...(response.data ?? {}),
          meta: response.meta,
          warnings: response.warnings,
        });

        setState({
          dashboardData,
          error: null,
          isLoading: false,
          meta: dashboardData.meta,
          overview: dashboardData.overview,
          sections: dashboardData.sections,
          warnings: dashboardData.warnings,
        });
      } catch (error) {
        if (isCanceledRequest(error) || requestIdRef.current !== requestId) {
          return;
        }

        setState((current) => ({
          ...current,
          error: getApiErrorMessage(error, "Caricamento dashboard non riuscito."),
          isLoading: false,
        }));
      }
    }

    loadDashboardMetrics();

    return () => {
      controller.abort();
    };
  }, [clientId, enabled, endDate, range, refreshIndex, startDate]);

  return {
    ...state,
    cooldownSeconds,
    refetch,
  };
}
