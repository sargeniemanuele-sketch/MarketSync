import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";

let accessToken = null;
let csrfToken = null;

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

export function setAuthToken(token) {
  accessToken = token || null;
}

export function getAuthToken() {
  return accessToken;
}

export function clearAuthToken() {
  accessToken = null;
}

export function setCsrfToken(token) {
  csrfToken = token || null;
}

export function getCsrfToken() {
  return csrfToken;
}

export function clearCsrfToken() {
  csrfToken = null;
}

axiosClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else if (config.headers.Authorization) {
    delete config.headers.Authorization;
  }

  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }

  return config;
});

// Mutable callbacks injected by AuthContext — avoid circular imports by not importing authApi here.
const _auth = {
  refreshSession: null,
  onSessionExpired: null,
};

// Shared refresh promise: all concurrent 401s wait on the same refresh call.
let _refreshPromise = null;

// These URLs must never trigger a refresh retry (to avoid loops or redundant calls).
const SKIP_REFRESH_URLS = ["/auth/refresh", "/auth/login", "/auth/register", "/auth/google", "/auth/exchange-oauth-code", "/auth/csrf"];

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    if (
      error?.response?.status !== 401 ||
      config?._retry ||
      !accessToken ||
      !_auth.refreshSession ||
      SKIP_REFRESH_URLS.some((url) => config?.url?.includes(url))
    ) {
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      if (!_refreshPromise) {
        _refreshPromise = _auth.refreshSession().finally(() => {
          _refreshPromise = null;
        });
      }

      const newToken = await _refreshPromise;

      if (newToken) {
        // Request interceptor will pick up the updated accessToken automatically.
        return axiosClient(config);
      }

      _auth.onSessionExpired?.();
      return Promise.reject(error);
    } catch {
      _auth.onSessionExpired?.();
      return Promise.reject(error);
    }
  },
);

/**
 * Wire the global 401 → token-refresh flow. Call once from AuthContext after mount.
 *
 * refreshSession must call setAuthToken(newToken) and return the new token string,
 * or return null when refresh is not possible.
 * onSessionExpired must clear local auth state so ProtectedRoute redirects to login.
 */
export function setupAuthInterceptors({ refreshSession, onSessionExpired }) {
  _auth.refreshSession = refreshSession;
  _auth.onSessionExpired = onSessionExpired;
}

export default axiosClient;
