# Backend — MarketSync

API REST che gestisce autenticazione, profilo utente, clienti, integrazioni esterne e raccolta metriche di marketing.

---

## Tecnologie principali

- **Node.js** >= 20 con ES Modules
- **Express** — framework HTTP
- **MongoDB** + **Mongoose** — database e ODM
- **Passport.js** — Google OAuth 2.0
- **JWT** + cookie HttpOnly — autenticazione stateless
- **SendGrid** — email transazionali
- **Cloudinary** — upload avatar
- **Zod** — validazione input
- **Helmet**, **express-rate-limit** — sicurezza

---

## Script

```bash
npm start       # avvia il server in produzione
npm run dev     # avvia con --watch (ricarica automatica)
npm run lint    # lint del codice sorgente
```

---

## Variabili d'ambiente

Crea un file `.env` copiando `.env.example`. Le variabili principali:

```env
# Server
NODE_ENV=development
PORT=4000

# Database
MONGODB_URI=mongodb://localhost:27017/marketsync

# Auth
JWT_SECRET=...
JWT_ACCESS_EXPIRES_IN=15m
COOKIE_SECRET=...
ENCRYPTION_KEY=          # 64 caratteri hex (AES-256-GCM)

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback

# Shopify
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_API_VERSION=2026-01
SHOPIFY_SCOPES=read_orders,read_products,read_analytics,read_all_orders
SHOPIFY_CALLBACK_URL=http://localhost:4000/api/v1/integrations/shopify/callback
BACKEND_PUBLIC_URL=http://localhost:4000   # obbligatorio in produzione

# Meta Ads
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=http://localhost:4000/api/v1/integrations/meta-ads/callback

# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_REDIRECT_URI=http://localhost:4000/api/v1/integrations/google-ads/callback

# SendGrid
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...       # mittente verificato in SendGrid

# CORS / Frontend
ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Cloudinary (opzionale — disabilitato se vuoto)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

> Le API esterne (Shopify, Meta Ads, Google Ads) richiedono configurazione sul portale del rispettivo provider. Google Ads richiede approvazione specifica per l'accesso a dati reali.

---

## Endpoint principali

| Gruppo | Prefisso | Funzionalità |
|--------|----------|-------------|
| Health | `GET /api/v1/health` | Stato del server |
| Auth | `POST /api/v1/auth/register` | Registrazione |
| Auth | `POST /api/v1/auth/login` | Login |
| Auth | `POST /api/v1/auth/logout` | Logout |
| Auth | `GET  /api/v1/auth/me` | Utente corrente |
| Auth | `POST /api/v1/auth/forgot-password` | Richiesta reset password |
| Auth | `POST /api/v1/auth/reset-password` | Reset password |
| Auth | `GET  /api/v1/auth/google` | Login con Google |
| Profile | `GET/PATCH /api/v1/profile` | Lettura e modifica profilo |
| Profile | `PATCH /api/v1/profile/avatar` | Upload avatar |
| Profile | `DELETE /api/v1/profile` | Cancellazione account |
| Clients | `GET/POST /api/v1/clients` | Lista e creazione clienti |
| Clients | `GET/PATCH/DELETE /api/v1/clients/:id` | Gestione singolo cliente |
| Integrations | `/api/v1/integrations/...` | Collegamento, callback, selezione account e disconnessione provider |
| Metrics | `GET /api/v1/metrics/...` | KPI per piattaforma |
| Webhooks | `POST /api/v1/webhooks/shopify/...` | Webhook Shopify |

---

## Avvio in locale

```bash
cd backend
cp .env.example .env
# compila le variabili nel .env
npm install
npm run dev
```

Il server risponde su `http://localhost:4000`.

---

## Deploy su Render

| Impostazione | Valore |
|-------------|--------|
| Root directory | `backend` |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/api/v1/health` |
| Node version | >= 20 |

Impostare tutte le variabili d'ambiente nel pannello Render. `BACKEND_PUBLIC_URL` deve contenere l'URL definitivo assegnato da Render.
