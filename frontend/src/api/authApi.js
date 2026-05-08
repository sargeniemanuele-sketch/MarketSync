import axiosClient, { API_BASE_URL } from "./axiosClient.js";

export function unwrapApiData(response) {
  return response?.data?.data ?? response?.data ?? null;
}

export function getApiErrorMessage(error, fallback = "Si e verificato un errore imprevisto.") {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export async function getCsrfToken() {
  const response = await axiosClient.get("/auth/csrf");
  return unwrapApiData(response);
}

export async function register(payload) {
  const response = await axiosClient.post("/auth/register", payload);
  return unwrapApiData(response);
}

export async function login(payload) {
  const response = await axiosClient.post("/auth/login", payload);
  return unwrapApiData(response);
}

export async function getMe() {
  const response = await axiosClient.get("/auth/me");
  return unwrapApiData(response);
}

export async function refresh() {
  const response = await axiosClient.post("/auth/refresh", {});
  return unwrapApiData(response);
}

export async function logout() {
  await axiosClient.post("/auth/logout", {});
}

export async function exchangeOAuthCode(code) {
  const response = await axiosClient.post("/auth/exchange-oauth-code", { code });
  return unwrapApiData(response);
}

export function getGoogleAuthUrl() {
  return `${API_BASE_URL}/auth/google`;
}

export async function forgotPassword(email) {
  const response = await axiosClient.post("/auth/forgot-password", { email });
  return unwrapApiData(response);
}

export async function resetPassword({ token, password }) {
  const response = await axiosClient.post("/auth/reset-password", { token, password });
  return unwrapApiData(response);
}
