import { HTTP_STATUS } from '../config/app.constants.js';

export class AppError extends Error {
  /**
   * @param {string} message       - Messaggio rivolto all'utente
   * @param {number} statusCode    - Codice di stato HTTP
   * @param {string} code          - Codice errore leggibile dalla macchina
   * @param {object} [ctx]
   * @param {string} [ctx.scope]   - Dominio in cui si è verificato l'errore (es. 'auth', 'shopify')
   * @param {string} [ctx.provider]- Provider di integrazione quando rilevante
   * @param {object} [ctx.meta]     - Metadata sicuri da inoltrare nella risposta
   */
  constructor(message, statusCode, code, { scope = null, provider = null, meta = {} } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.scope = scope;
    this.provider = provider;
    this.meta = meta;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message, ctx = {}) {
    super(message, HTTP_STATUS.BAD_REQUEST, 'BAD_REQUEST', ctx);
  }
}

export class ValidationError extends AppError {
  constructor(message, ctx = {}) {
    super(message, HTTP_STATUS.UNPROCESSABLE, 'VALIDATION_ERROR', ctx);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Accesso richiesto. Effettua il login per continuare.', ctx = {}) {
    super(message, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED', ctx);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Non hai l’accesso necessario per questa operazione.', ctx = {}) {
    super(message, HTTP_STATUS.FORBIDDEN, 'FORBIDDEN', ctx);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'L’elemento richiesto non è stato trovato.', ctx = {}) {
    super(message, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', ctx);
  }
}

export class ConflictError extends AppError {
  constructor(message, ctx = {}) {
    super(message, HTTP_STATUS.CONFLICT, 'CONFLICT', ctx);
  }
}
