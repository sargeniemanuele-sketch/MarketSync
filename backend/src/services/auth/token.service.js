import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export const REFRESH_COOKIE_NAME = 'refreshToken';

// Opzioni cookie condivise tra set e clear: devono essere identiche affinché
// il browser trovi correttamente e rimuova il cookie al logout.
// In produzione (cross-site Render/Vercel) SameSite=None è obbligatorio.
const COOKIE_BASE = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  path: '/api/v1/auth',
};

/**
 * Firma un access token JWT a breve durata.
 * Il payload è mantenuto minimale e coerente con requireAuth in auth.middleware.js.
 *
 * { sub, email, role, name, iat, exp }
 */
export function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    },
    env.auth.jwtSecret,
    { expiresIn: env.auth.jwtAccessExpiresIn }
  );
}

/**
 * Genera un refresh token crittograficamente casuale (80 caratteri esadecimali).
 * NON è un JWT: la scadenza è gestita lato server tramite refreshTokenHash su User.
 */
export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * Restituisce l'hash SHA-256 esadecimale di una stringa token.
 * Usato per salvare e confrontare refresh token senza salvarli in chiaro.
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Durata del refresh token. Singola fonte di verità usata sia dal cookie (maxAge)
// sia dal campo di scadenza lato server (refreshTokenExpiresAt su User).
export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni

/** Imposta il cookie httpOnly del refresh token sulla risposta. */
export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...COOKIE_BASE,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

/**
 * Pulisce il cookie del refresh token.
 * Deve usare opzioni path/sameSite/secure identiche a setRefreshCookie.
 */
export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, COOKIE_BASE);
}

// ── CSRF token ────────────────────────────────────────────────────────────────

export const CSRF_COOKIE_NAME = 'csrfToken';

const CSRF_COOKIE_BASE = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  path: '/api/v1/auth',
};

/** Genera un CSRF token opaco crittograficamente casuale (64 hex chars). */
export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** Imposta il cookie httpOnly del CSRF token sulla risposta. */
export function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE_NAME, token, {
    ...CSRF_COOKIE_BASE,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

/** Pulisce il cookie CSRF. Opzioni identiche a setCsrfCookie. */
export function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, CSRF_COOKIE_BASE);
}
