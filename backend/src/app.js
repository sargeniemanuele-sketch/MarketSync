import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from './config/passport.js';

import { env } from './config/env.js';
import { API_PREFIX, HTTP_STATUS } from './config/app.constants.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { generalApiLimiter } from './middlewares/rateLimit.middleware.js';
import { sendError } from './contracts/responseBuilders/error.js';

import authRouter from './routes/auth.routes.js';
import appRouter from './routes/app.routes.js';
import clientsRouter from './routes/clients.routes.js';
import integrationsRouter from './routes/integrations.routes.js';
import metricsRouter from './routes/metrics.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import profileRouter from './routes/profile.routes.js';
import healthRouter from './routes/health.routes.js';
import webhooksRouter from './routes/webhooks.routes.js';

const OAUTH_SESSION_TTL_MS = 10 * 60 * 1000;

const app = express();

if (env.isProduction) {
  app.set('trust proxy', 1);
}

// ── Sicurezza ────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.cors.allowedOrigins,
    credentials: true,
  })
);

// ── Webhook Shopify (raw body, montato prima di express.json) ────────────────
// Il router usa express.raw() per-route così il raw body è disponibile per la
// verifica HMAC. Montato prima del parser JSON globale: le richieste che arrivano
// qui non raggiungono mai express.json(), preservando il body grezzo.
app.use(`${API_PREFIX}/webhooks`, webhooksRouter);

// ── Parsing richieste ────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser(env.auth.cookieSecret));

// ── Logging ───────────────────────────────────────────────
if (!env.isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ── Sessione OAuth (solo archivio state) ─────────────────
// express-session è richiesto per il parametro state OAuth2 di Passport (protezione CSRF
// durante l'handshake con Google). Gli utenti non vengono mai serializzati in sessione:
// session: false è usato in entrambe le chiamate authenticate. Il cookie ha durata breve
// (10 min) ed è creato solo quando il flusso OAuth viene avviato.
app.use(
  session({
    secret: env.auth.cookieSecret,
    store: MongoStore.create({
      mongoUrl: env.db.uri,
      collectionName: 'sessions',
      ttl: Math.ceil(OAUTH_SESSION_TTL_MS / 1000),
      autoRemove: 'native',
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.isProduction,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: OAUTH_SESSION_TTL_MS, // 10 min: abbastanza per l'andata/ritorno OAuth
    },
  })
);
app.use(passport.initialize());
// passport.session() omesso intenzionalmente: nessuna serializzazione utente in sessione.

// ── Health check pubblico ─────────────────────────────────
app.use(`${API_PREFIX}/health`, healthRouter);

// ── Limitazione frequenza ─────────────────────────────────
app.use(generalApiLimiter);

// ── Route ─────────────────────────────────────────────────
app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/app`, appRouter);
app.use(`${API_PREFIX}/clients`, clientsRouter);
app.use(`${API_PREFIX}/integrations`, integrationsRouter);
app.use(`${API_PREFIX}/metrics`, metricsRouter);
app.use(`${API_PREFIX}/dashboard`, dashboardRouter);
app.use(`${API_PREFIX}/profile`, profileRouter);
// ── 404 ───────────────────────────────────────────────────
app.use((_req, res) => {
  return sendError(res, HTTP_STATUS.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Pagina non trovata.');
});

// ── Gestore errori (deve essere ultimo) ──────────────────
app.use(errorMiddleware);

export default app;
