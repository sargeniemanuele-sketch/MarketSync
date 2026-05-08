import { env } from '../config/env.js';
import { HTTP_STATUS } from '../config/app.constants.js';
import { AppError } from '../utils/errors.js';
import { buildErrorBody } from '../contracts/responseBuilders/error.js';

/**
 * Mappa qualsiasi errore lanciato in una struttura normalizzata prima dell'invio.
 * Restituisce: { statusCode, code, message, scope, provider, stack }
 */
function normalizeError(err) {
  // ── Gerarchia AppError ────────────────────────────────
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      scope: err.scope,
      provider: err.provider,
      meta: err.meta ?? {},
      stack: err.stack,
    };
  }

  // ── Mongoose ValidationError ──────────────────────────
  if (err.name === 'ValidationError' && err.errors) {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
    return {
      statusCode: HTTP_STATUS.UNPROCESSABLE,
      code: 'VALIDATION_ERROR',
      message,
      scope: 'database',
      provider: null,
      meta: {},
      stack: err.stack,
    };
  }

  // ── Mongoose CastError (ObjectId non valido) ──────────
  if (err.name === 'CastError') {
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_ID',
      message: 'Il valore inserito per questo campo non è valido.',
      scope: 'database',
      provider: null,
      meta: {},
      stack: err.stack,
    };
  }

  // ── Chiave duplicata MongoDB ──────────────────────────
  if (err.code === 11000) {
    return {
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'DUPLICATE_KEY',
      message: 'Esiste già un elemento con questo valore.',
      scope: 'database',
      provider: null,
      meta: {},
      stack: err.stack,
    };
  }

  // ── Errori JWT (predisposti per il task auth) ────────
  if (err.name === 'JsonWebTokenError') {
    return {
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'INVALID_TOKEN',
      message: 'La sessione non è valida. Accedi di nuovo.',
      scope: 'auth',
      provider: null,
      meta: {},
      stack: err.stack,
    };
  }

  if (err.name === 'TokenExpiredError') {
    return {
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'TOKEN_EXPIRED',
      message: 'La sessione è scaduta. Accedi di nuovo per continuare.',
      scope: 'auth',
      provider: null,
      meta: {},
      stack: err.stack,
    };
  }

  // ── Fallback generico ─────────────────────────────────
  // I dettagli grezzi dell'errore non raggiungono mai il frontend in produzione.
  return {
    statusCode: HTTP_STATUS.INTERNAL_ERROR,
    code: 'INTERNAL_ERROR',
    message: env.isProduction ? 'Si è verificato un problema. Riprova tra qualche minuto.' : (err.message ?? 'Si è verificato un problema. Riprova tra qualche minuto.'),
    scope: null,
    provider: null,
    meta: {},
    stack: err.stack,
  };
}

// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
  const { statusCode, code, message, scope, provider, meta: errorMeta = {}, stack } = normalizeError(err);
  const { debug, ...safeMeta } = errorMeta ?? {};
  // Strip all raw provider data from debug before exposing it — even in dev.
  // Safe fields kept: url, method, httpStatus, contentType, requestId.
  const {
    rawBodyPreview: _rbp,
    rawBody: _rb,
    raw: _raw,
    providerRaw: _providerRaw,
    responseBody: _responseBody,
    providerResponse: _providerResponse,
    response: _response,
    body: _body,
    data: _data,
    ...safeDebug
  } = debug ?? {};

  const meta = {
    ...safeMeta,
    ...(!env.isProduction && stack
      ? { debug: { ...safeDebug, stack } }
      : {}),
  };

  const body = buildErrorBody(code, message, { scope, provider, meta });

  return res.status(statusCode).json(body);
}
