import axiosClient from "./axiosClient.js";
import { normalizeClient } from "../utils/apiAdapters.js";

function unwrapClientsResponse(response) {
  if (response?.status === 204) {
    return {
      data: null,
      meta: {},
      warnings: [],
    };
  }

  const body = response?.data ?? {};

  if (Object.prototype.hasOwnProperty.call(body, "success")) {
    return {
      data: body.data ?? null,
      meta: body.meta ?? {},
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
    };
  }

  return {
    data: body ?? null,
    meta: body?.meta ?? {},
    warnings: Array.isArray(body?.warnings) ? body.warnings : [],
  };
}

function extractClient(payload) {
  return payload?.client ?? payload ?? null;
}

function stripUndefined(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

export async function getClients() {
  const response = await axiosClient.get("/clients");
  const unwrapped = unwrapClientsResponse(response);
  const clients = Array.isArray(unwrapped.data) ? unwrapped.data.map(normalizeClient) : [];

  return {
    clients,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function createClient(payload) {
  const response = await axiosClient.post("/clients", stripUndefined(payload));
  const unwrapped = unwrapClientsResponse(response);
  const client = extractClient(unwrapped.data);

  return {
    client: client ? normalizeClient(client) : null,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function getClientById(clientId) {
  const response = await axiosClient.get(`/clients/${clientId}`);
  const unwrapped = unwrapClientsResponse(response);
  const client = extractClient(unwrapped.data);

  return {
    client: client ? normalizeClient(client) : null,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function updateClient(clientId, payload) {
  const response = await axiosClient.patch(`/clients/${clientId}`, stripUndefined(payload));
  const unwrapped = unwrapClientsResponse(response);
  const client = extractClient(unwrapped.data);

  return {
    client: client ? normalizeClient(client) : null,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function deleteClient(clientId) {
  const response = await axiosClient.delete(`/clients/${clientId}`);
  const unwrapped = unwrapClientsResponse(response);

  return {
    deleted: response.status === 204 || unwrapped.data === null,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function getCustomMetrics(clientId) {
  const response = await axiosClient.get(`/clients/${clientId}/custom-metrics`);
  const unwrapped = unwrapClientsResponse(response);

  return {
    customMetrics: Array.isArray(unwrapped.data?.customMetrics)
      ? unwrapped.data.customMetrics
      : [],
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function createCustomMetric(clientId, payload) {
  const response = await axiosClient.post(
    `/clients/${clientId}/custom-metrics`,
    stripUndefined(payload),
  );
  const unwrapped = unwrapClientsResponse(response);

  return {
    customMetric: unwrapped.data?.customMetric ?? null,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function updateCustomMetric(clientId, metricKey, payload) {
  const response = await axiosClient.patch(
    `/clients/${clientId}/custom-metrics/${metricKey}`,
    stripUndefined(payload),
  );
  const unwrapped = unwrapClientsResponse(response);

  return {
    customMetric: unwrapped.data?.customMetric ?? null,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function deleteCustomMetric(clientId, metricKey) {
  const response = await axiosClient.delete(`/clients/${clientId}/custom-metrics/${metricKey}`);
  const unwrapped = unwrapClientsResponse(response);

  return {
    deleted: response.status === 204 || unwrapped.data === null,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}

export async function updateClientBusinessSettings(clientId, businessSettings) {
  return updateClient(clientId, { businessSettings });
}

export async function previewCustomMetric(clientId, payload, params = {}) {
  const response = await axiosClient.post(
    `/clients/${clientId}/custom-metrics/preview`,
    stripUndefined(payload),
    { params: stripUndefined(params) },
  );
  const unwrapped = unwrapClientsResponse(response);

  return {
    preview: unwrapped.data?.preview ?? null,
    meta: unwrapped.meta,
    warnings: unwrapped.warnings,
  };
}
