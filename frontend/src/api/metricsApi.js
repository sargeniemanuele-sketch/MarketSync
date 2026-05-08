import axiosClient from "./axiosClient.js";
import { dedupeWarnings } from "../utils/warnings.js";

const PROVIDER_METRICS_ENDPOINTS = {
  shopify: "/metrics/shopify",
  meta_ads: "/metrics/meta-ads",
  google_ads: "/metrics/google-ads",
};

function toWarningList(value) {
  return Array.isArray(value) ? value : [];
}

function unwrapMetricsResponse(response) {
  const body = response?.data ?? {};

  if (Object.prototype.hasOwnProperty.call(body, "success")) {
    const payload = body.data ?? null;

    return {
      data: payload,
      warnings: dedupeWarnings([
        ...toWarningList(body.warnings),
        ...toWarningList(payload?.warnings),
      ]),
      meta: {
        ...(payload?.meta ?? {}),
        ...(body.meta ?? {}),
      },
    };
  }

  return {
    data: body ?? null,
    warnings: toWarningList(body?.warnings),
    meta: body?.meta ?? {},
  };
}

function buildMetricsParams({ clientId, endDate, range, startDate } = {}) {
  const params = {
    clientId,
    range,
  };

  if (range === "custom") {
    params.startDate = startDate;
    params.endDate = endDate;
  }

  return params;
}

function buildMetricDetailParams({
  clientId,
  endDate,
  granularity = "auto",
  metricKey,
  provider,
  range,
  startDate,
} = {}) {
  return {
    ...buildMetricsParams({ clientId, endDate, range, startDate }),
    granularity,
    metricKey,
    provider,
  };
}

export async function getDashboardMetrics(
  { clientId, endDate, range, startDate } = {},
  { signal } = {},
) {
  const response = await axiosClient.get("/metrics/dashboard", {
    params: buildMetricsParams({ clientId, endDate, range, startDate }),
    signal,
  });

  return unwrapMetricsResponse(response);
}

export async function getProviderMetrics(
  provider,
  { clientId, endDate, range, startDate } = {},
  { signal } = {},
) {
  const endpoint = PROVIDER_METRICS_ENDPOINTS[provider];

  if (!endpoint) {
    throw new Error(`Provider metriche non supportato: ${provider}`);
  }

  const response = await axiosClient.get(endpoint, {
    params: buildMetricsParams({ clientId, endDate, range, startDate }),
    signal,
  });

  return unwrapMetricsResponse(response);
}

export async function getMetricDetail(
  {
    clientId,
    endDate,
    granularity = "auto",
    metricKey,
    provider,
    range,
    startDate,
  } = {},
  { signal } = {},
) {
  const response = await axiosClient.get("/metrics/detail", {
    params: buildMetricDetailParams({
      clientId,
      endDate,
      granularity,
      metricKey,
      provider,
      range,
      startDate,
    }),
    signal,
  });

  return unwrapMetricsResponse(response);
}

export function getShopifyMetrics(params, options) {
  return getProviderMetrics("shopify", params, options);
}

export function getMetaAdsMetrics(params, options) {
  return getProviderMetrics("meta_ads", params, options);
}

export function getGoogleAdsMetrics(params, options) {
  return getProviderMetrics("google_ads", params, options);
}
