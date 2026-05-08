import rateLimit from 'express-rate-limit';
import { HTTP_STATUS } from '../config/app.constants.js';
import { AppError } from '../utils/errors.js';

/**
 * Costruisce un gestore di rate limit che inoltra alla pipeline standard degli errori.
 * Il formato della risposta corrisponde esattamente al nostro contratto di errore.
 */
function makeHandler(message) {
  return (_req, _res, next) => {
    next(
      new AppError(message, HTTP_STATUS.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS', {
        scope: 'rate_limit',
      })
    );
  };
}

/**
 * Factory per creare limiter senza duplicazione.
 *
 * @param {object} opts
 * @param {number} opts.windowMs   - Finestra temporale in millisecondi
 * @param {number} opts.limit      - Numero massimo di richieste per finestra per IP
 * @param {string} opts.message    - Messaggio utente al superamento del limite
 */
function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeHandler(message),
  });
}

// ── Limiter generale API ──────────────────────────────────────────────────────
// Applicato globalmente in app.js prima di tutte le route.
// Soglia generosa: pensata per bloccare client fuori controllo, non l'uso normale.

export const generalApiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 200,
  message: 'Troppe richieste. Riprova tra qualche minuto.',
});

// ── Limiter endpoint auth ─────────────────────────────────────────────────────
// Applicati individualmente sulle route auth sensibili.

export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 10,
  message: 'Troppi tentativi di accesso. Riprova tra 15 minuti.',
});

export const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 ora
  limit: 5,
  message: 'Troppi tentativi di registrazione. Riprova più tardi.',
});

export const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 30,
  message: 'Sessione aggiornata troppe volte. Accedi di nuovo più tardi.',
});

export const logoutLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 60,
  message: 'Troppe richieste di logout. Riprova tra qualche minuto.',
});

export const oauthCodeExchangeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 20,
  message: 'Troppe richieste di accesso Google. Riprova tra qualche minuto.',
});

// ── Limiter endpoint profilo ─────────────────────────────────────────────────

export const avatarUploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 10,
  message: 'Troppi caricamenti avatar. Riprova tra qualche minuto.',
});

// ── Limiter endpoint integrazioni ────────────────────────────────────────────

export const integrationFlowLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 30,
  message: 'Troppe richieste di integrazione. Riprova tra qualche minuto.',
});

// ── Limiter endpoint metriche ─────────────────────────────────────────────────
// Applicato sulle route /api/v1/metrics/* dopo requireAuth.
// Più restrittivo del general limiter: protegge i provider esterni da refresh compulsivi.

export const metricsLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 min
  limit: 30,
  message: 'Troppe richieste metriche, attendi qualche minuto prima di aggiornare',
});

// ── Limiter endpoint CSRF ──────────────────────────────────────────────────────

export const csrfLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 30,
  message: 'Troppe richieste. Riprova tra qualche minuto.',
});

// ── Limiter reset password ────────────────────────────────────────────────────

export const forgotPasswordLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 ora — coerente con registerLimiter
  limit: 5,
  message: 'Troppe richieste. Riprova più tardi.',
});

export const resetPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min — il token è già un segreto, ma va limitato
  limit: 10,
  message: 'Troppi tentativi. Riprova tra 15 minuti.',
});
