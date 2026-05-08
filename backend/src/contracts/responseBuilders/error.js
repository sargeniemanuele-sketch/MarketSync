import { HTTP_STATUS } from '../../config/app.constants.js';

/**
 * Costruisce l'envelope di errore senza inviarlo.
 * Lo stack trace è escluso intenzionalmente qui; il middleware lo aggiunge in dev.
 *
 * Struttura: { success: false, error: { code, message, [scope], [provider] }, meta }
 */
export function buildErrorBody(code, message, { scope = null, provider = null, meta = {} } = {}) {
  return {
    success: false,
    error: {
      code,
      message,
      ...(scope !== null && { scope }),
      ...(provider !== null && { provider }),
    },
    meta,
  };
}

/**
 * Invia una risposta di errore strutturata.
 * Preferire errorMiddleware per gli errori non gestiti.
 * Usare direttamente solo per risposte di errore note e inline.
 */
export function sendError(res, statusCode, code, message, { scope, provider, meta } = {}) {
  return res
    .status(statusCode ?? HTTP_STATUS.INTERNAL_ERROR)
    .json(buildErrorBody(code, message, { scope, provider, meta }));
}
