import { HTTP_STATUS } from '../../config/app.constants.js';

/**
 * Risposta di successo standard.
 *
 * Struttura: { success: true, data, warnings, meta }
 */
export function sendSuccess(res, data = null, { meta = {}, warnings = [], status = HTTP_STATUS.OK } = {}) {
  return res.status(status).json({
    success: true,
    data,
    warnings,
    meta,
  });
}

/** 201 Created */
export function sendCreated(res, data = null, { meta = {}, warnings = [] } = {}) {
  return sendSuccess(res, data, { meta, warnings, status: HTTP_STATUS.CREATED });
}

/** 204 No Content */
export function sendNoContent(res) {
  return res.status(HTTP_STATUS.NO_CONTENT).end();
}

/**
 * Risposta per lista paginata.
 * I meta della paginazione vengono uniti nel campo meta di primo livello.
 *
 * @param {object} pagination - Risultato di buildPaginationMeta()
 */
export function sendPaginated(res, data, pagination, { meta = {}, warnings = [] } = {}) {
  return sendSuccess(res, data, {
    meta: { ...meta, pagination },
    warnings,
  });
}
