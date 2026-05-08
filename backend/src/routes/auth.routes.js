import { Router } from 'express';
import passport from '../config/passport.js';

import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireAuth, verifyCsrfToken } from '../middlewares/auth.middleware.js';
import {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  logoutLimiter,
  oauthCodeExchangeLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  csrfLimiter,
} from '../middlewares/rateLimit.middleware.js';
import { registerSchema, loginSchema, emptyBodySchema, forgotPasswordSchema, resetPasswordSchema, exchangeOAuthCodeSchema } from '../validators/auth.validators.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/csrf',
  csrfLimiter,
  authController.getCsrfToken
);

router.post('/register',
  registerLimiter,
  validate({ body: registerSchema }),
  authController.register
);

router.post('/login',
  loginLimiter,
  validate({ body: loginSchema }),
  authController.login
);

router.post('/refresh',
  refreshLimiter,
  verifyCsrfToken,
  validate({ body: emptyBodySchema }),
  authController.refresh
);

// Il logout non richiede un access token valido.
// Il cookie del refresh token è sufficiente per la revoca lato server.
router.post('/logout',
  logoutLimiter,
  verifyCsrfToken,
  validate({ body: emptyBodySchema }),
  authController.logout
);

router.get('/me',
  requireAuth,
  authController.me
);

router.post('/forgot-password',
  forgotPasswordLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);

router.post('/reset-password',
  resetPasswordLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);

router.post('/exchange-oauth-code',
  oauthCodeExchangeLimiter,
  validate({ body: exchangeOAuthCodeSchema }),
  authController.exchangeOAuthCode
);

// ── Google OAuth ──────────────────────────────────────────────────────────────
// state: true  → Passport genera un valore casuale, lo salva in req.session tramite
//               SessionStateStore e lo verifica sulla callback (protezione CSRF).
// session: false → gli utenti non vengono mai serializzati in sessione dopo l'autenticazione;
//                  req.session esiste solo per trasportare lo state OAuth tra le due fasi.

router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state: true,
  })
);

router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${env.frontend.url}/login?error=google_auth_failed`,
  }),
  authController.googleCallback
);

export default router;
