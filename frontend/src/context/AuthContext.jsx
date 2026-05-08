import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/authApi.js";
import { clearAuthToken, clearCsrfToken, getAuthToken, getCsrfToken, setAuthToken, setCsrfToken, setupAuthInterceptors } from "../api/axiosClient.js";

export const AuthContext = createContext(null);

let sessionCheckPromise = null;

function readUser(payload) {
  return payload?.user ?? payload ?? null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const fetchCurrentUser = useCallback(async () => {
    const payload = await authApi.getMe();
    return readUser(payload);
  }, []);

  const loadSession = useCallback(async () => {
    try {
      if (!getAuthToken()) {
        if (!getCsrfToken()) {
          const csrfData = await authApi.getCsrfToken();
          if (csrfData?.csrfToken) setCsrfToken(csrfData.csrfToken);
        }
        const refreshed = await authApi.refresh();
        if (refreshed?.accessToken) setAuthToken(refreshed.accessToken);
        if (refreshed?.csrfToken) setCsrfToken(refreshed.csrfToken);
      }

      return await fetchCurrentUser();
    } catch (error) {
      if (error?.response?.status === 401 && getAuthToken()) {
        try {
          if (!getCsrfToken()) {
            const csrfData = await authApi.getCsrfToken();
            if (csrfData?.csrfToken) setCsrfToken(csrfData.csrfToken);
          }
          const refreshed = await authApi.refresh();
          if (refreshed?.accessToken) {
            setAuthToken(refreshed.accessToken);
            if (refreshed?.csrfToken) setCsrfToken(refreshed.csrfToken);
            return await fetchCurrentUser();
          }
        } catch {
          // La sessione non e piu valida: lo stato viene pulito da checkMe.
        }
      }

      throw error;
    }
  }, [fetchCurrentUser]);

  const checkMe = useCallback(async () => {
    setIsLoading(true);

    if (!sessionCheckPromise) {
      sessionCheckPromise = loadSession().finally(() => {
        sessionCheckPromise = null;
      });
    }

    try {
      const currentUser = await sessionCheckPromise;
      setUser(currentUser);
      return currentUser;
    } catch {
      clearAuthToken();
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [loadSession]);

  useEffect(() => {
    checkMe();
  }, [checkMe]);

  // Register the global 401 handler once. Uses stable references:
  // - authApi.refresh is a module-level function (never changes)
  // - setAuthToken / clearAuthToken are module-level utilities (never change)
  // - setUser is a stable React state setter
  useEffect(() => {
    setupAuthInterceptors({
      refreshSession: async () => {
        if (!getCsrfToken()) {
          const csrfData = await authApi.getCsrfToken();
          if (csrfData?.csrfToken) setCsrfToken(csrfData.csrfToken);
        }
        const refreshed = await authApi.refresh();
        if (refreshed?.accessToken) {
          setAuthToken(refreshed.accessToken);
        }
        if (refreshed?.csrfToken) {
          setCsrfToken(refreshed.csrfToken);
        }
        return refreshed?.accessToken ?? null;
      },
      onSessionExpired: () => {
        clearAuthToken();
        clearCsrfToken();
        setUser(null);
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (credentials) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const payload = await authApi.login(credentials);
      setAuthToken(payload?.accessToken);
      if (payload?.csrfToken) setCsrfToken(payload.csrfToken);
      const nextUser = readUser(payload);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      clearAuthToken();
      clearCsrfToken();
      setUser(null);
      setAuthError(authApi.getApiErrorMessage(error, "Credenziali non valide."));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const responsePayload = await authApi.register(payload);
      setAuthToken(responsePayload?.accessToken);
      if (responsePayload?.csrfToken) setCsrfToken(responsePayload.csrfToken);
      const nextUser = readUser(responsePayload);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      clearAuthToken();
      clearCsrfToken();
      setUser(null);
      setAuthError(authApi.getApiErrorMessage(error, "Registrazione non riuscita."));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithAccessToken = useCallback(async (token) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      setAuthToken(token);
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      clearAuthToken();
      setUser(null);
      setAuthError(authApi.getApiErrorMessage(error, "Accesso Google non riuscito."));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchCurrentUser]);

  const loginWithOAuthCode = useCallback(async (code) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const payload = await authApi.exchangeOAuthCode(code);
      setAuthToken(payload?.accessToken);
      if (payload?.csrfToken) setCsrfToken(payload.csrfToken);
      const nextUser = readUser(payload);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      clearAuthToken();
      clearCsrfToken();
      setUser(null);
      setAuthError(authApi.getApiErrorMessage(error, "Accesso Google non riuscito."));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      await authApi.logout();
    } finally {
      clearAuthToken();
      clearCsrfToken();
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const nextUpdates =
        typeof updates === "function" ? updates(currentUser) : updates;
      return {
        ...currentUser,
        ...nextUpdates,
      };
    });
  }, []);

  const clearSession = useCallback(() => {
    clearAuthToken();
    clearCsrfToken();
    setUser(null);
    setAuthError(null);
    setIsLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      authError,
      login,
      register,
      logout,
      checkMe,
      loginWithAccessToken,
      loginWithOAuthCode,
      clearAuthError,
      updateUser,
      clearSession,
    }),
    [
      user,
      isLoading,
      authError,
      login,
      register,
      logout,
      checkMe,
      loginWithAccessToken,
      loginWithOAuthCode,
      clearAuthError,
      updateUser,
      clearSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
