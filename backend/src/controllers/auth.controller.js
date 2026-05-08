import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../contracts/responseBuilders/success.js';
import {
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  clearRefreshCookie,
  generateCsrfToken,
  setCsrfCookie,
  clearCsrfCookie,
} from '../services/auth/token.service.js';
import * as authService from '../services/auth/auth.service.js';
import { env } from '../config/env.js';

// ── CSRF token ────────────────────────────────────────────────────────────────
// Endpoint pubblico: genera CSRF token, lo setta in cookie httpOnly e lo
// restituisce nel body. Il frontend lo salva in memoria e lo invia come
// header X-CSRF-Token sulle chiamate refresh/logout (double-submit pattern).

export const getCsrfToken = asyncHandler(async (_req, res) => {
  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  return sendSuccess(res, { csrfToken });
});

// ── Registrazione ─────────────────────────────────────────────────────────────

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.validated.body;

  const { accessToken, refreshToken, user } = await authService.registerUser({
    name,
    email,
    password,
  });

  const csrfToken = generateCsrfToken();
  setRefreshCookie(res, refreshToken);
  setCsrfCookie(res, csrfToken);
  return sendCreated(res, { accessToken, user, csrfToken });
});

// ── Login ─────────────────────────────────────────────────────────────────────

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;

  const { accessToken, refreshToken, user } = await authService.loginUser({ email, password });

  const csrfToken = generateCsrfToken();
  setRefreshCookie(res, refreshToken);
  setCsrfCookie(res, csrfToken);
  return sendSuccess(res, { accessToken, user, csrfToken });
});

// ── Refresh ───────────────────────────────────────────────────────────────────

export const refresh = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies[REFRESH_COOKIE_NAME];

  const { accessToken, refreshToken } = await authService.refreshTokens(incomingToken);

  const csrfToken = generateCsrfToken();
  setRefreshCookie(res, refreshToken);
  setCsrfCookie(res, csrfToken);
  return sendSuccess(res, { accessToken, csrfToken });
});

// ── Logout ────────────────────────────────────────────────────────────────────
// Non richiede un access token valido: il refresh token nel cookie è
// sufficiente per identificare e revocare la sessione. Pulisce sempre i cookie.

export const logout = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies[REFRESH_COOKIE_NAME];

  if (incomingToken) {
    await authService.revokeRefreshToken(incomingToken);
  }

  clearRefreshCookie(res);
  clearCsrfCookie(res);
  return sendNoContent(res);
});

// ── Me ────────────────────────────────────────────────────────────────────────

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  return sendSuccess(res, { user });
});

// ── Forgot password ───────────────────────────────────────────────────────────

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.validated.body;
  const result = await authService.forgotPassword(email);
  return sendSuccess(res, result);
});

// ── Reset password ────────────────────────────────────────────────────────────

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.validated.body;
  const result = await authService.resetPassword({ token, password });
  return sendSuccess(res, result);
});

// ── Callback Google OAuth ─────────────────────────────────────────────────────
// req.user è il documento Mongoose User popolato dalla callback verify della strategy Passport.
// failureRedirect di Passport gestisce il percorso di errore: questo gestore gira solo in caso di successo.
//
export const googleCallback = asyncHandler(async (req, res) => {
  const code = await authService.createOAuthLoginCode(req.user._id);

  const redirect = new URL('/auth/callback', env.frontend.url);
  redirect.searchParams.set('code', code);
  res.redirect(redirect.toString());
});

export const exchangeOAuthCode = asyncHandler(async (req, res) => {
  const { code } = req.validated.body;

  const { accessToken, refreshToken, user } = await authService.exchangeOAuthLoginCode(code);

  const csrfToken = generateCsrfToken();
  setRefreshCookie(res, refreshToken);
  setCsrfCookie(res, csrfToken);
  return sendSuccess(res, { accessToken, user, csrfToken });
});
