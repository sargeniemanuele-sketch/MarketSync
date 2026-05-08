import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { UnauthorizedError } from '../utils/errors.js';
import { CSRF_COOKIE_NAME } from '../services/auth/token.service.js';

/**
 * Estrae il token Bearer grezzo dall'header Authorization.
 * Restituisce null se l'header è assente o malformato.
 */
function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Costruisce l'oggetto req.user da un payload JWT verificato.
 *
 * Struttura di req.user:
 *   { id: string, email: string, role: string, name: string, avatarUrl: string | null }
 *
 * id    → payload.sub (ObjectId MongoDB come stringa, impostato alla firma)
 * role  → sempre 'marketer' nell'MVP; mantenuto esplicito per estensibilità futura
 */
function buildReqUser(payload) {
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    avatarUrl: payload.avatarUrl ?? null,
  };
}

/**
 * Verifica il CSRF token tramite double-submit cookie.
 * Confronta req.cookies.csrfToken con l'header X-CSRF-Token in modo timing-safe.
 * Protegge refresh e logout da attacchi CSRF cross-site (scenario Render/Vercel).
 */
export function verifyCsrfToken(req, _res, next) {
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.get('X-CSRF-Token');

  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length) {
    return next(new UnauthorizedError('Richiesta non valida.', { scope: 'auth' }));
  }

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken),
    );
    if (!valid) {
      return next(new UnauthorizedError('Richiesta non valida.', { scope: 'auth' }));
    }
  } catch {
    return next(new UnauthorizedError('Richiesta non valida.', { scope: 'auth' }));
  }

  next();
}

/**
 * Richiede un access token JWT valido.
 * Popola req.user in caso di successo.
 * Inoltra UnauthorizedError se il token manca; gli errori JWT (JsonWebTokenError,
 * TokenExpiredError) vengono inoltrati così come sono e gestiti da errorMiddleware.
 *
 * Verifica anche che l'utente esista ancora nel DB: dopo hard delete, un access token
 * formalmente valido non deve più autorizzare richieste.
 */
export async function requireAuth(req, _res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return next(new UnauthorizedError('Accesso richiesto. Effettua il login per continuare.', { scope: 'auth' }));
  }

  try {
    const payload = jwt.verify(token, env.auth.jwtSecret);
    const user = await User.findById(payload.sub).select('_id email role name avatarUrl').lean();

    if (!user) {
      return next(new UnauthorizedError('Account non trovato. Accedi di nuovo.', { scope: 'auth' }));
    }

    req.user = buildReqUser({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
    });
    next();
  } catch (err) {
    // JsonWebTokenError  → mappato a INVALID_TOKEN  (401) da errorMiddleware
    // TokenExpiredError  → mappato a TOKEN_EXPIRED  (401) da errorMiddleware
    next(err);
  }
}
