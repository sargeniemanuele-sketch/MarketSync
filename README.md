# MarketSync

Applicazione web per freelance e marketer che centralizza i KPI delle principali piattaforme pubblicitarie in un'unica dashboard.

Progetto finale Epicode — versione beta/MVP.

---

## Stack principale

| Area | Tecnologie |
|------|-----------|
| Backend | Node.js, Express, MongoDB, Mongoose |
| Frontend | React 18, Vite, Tailwind CSS |
| Landing | HTML, CSS, JavaScript statici |
| Email | SendGrid |
| Upload avatar | Cloudinary |
| Auth OAuth | Google OAuth 2.0 |

---

## Struttura del progetto

```
MarketSync/
├── backend/     # API REST, autenticazione, integrazioni esterne
├── frontend/    # SPA React, dashboard, gestione account
└── landing/     # Pagine statiche: home, privacy, termini, contatti
```

---

## Funzionalità principali

- Registrazione e login con email/password o Google OAuth
- Reset password via email (SendGrid)
- Creazione e gestione clienti
- Collegamento integrazioni: Shopify, Meta Ads, Google Ads
- Dashboard KPI per piattaforma
- Gestione profilo e upload avatar (Cloudinary)
- Cancellazione account

---

## Avvio in locale

Ogni sottomodulo ha il proprio README con le istruzioni dettagliate:

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)
- [landing/README.md](landing/README.md)

Ordine consigliato:
1. Avviare il backend (porta 4000)
2. Avviare il frontend (porta 5173)
3. Aprire la landing direttamente nel browser

---

## Deploy previsto

| Componente | Piattaforma | URL |
|-----------|-------------|-----|
| Backend | Render | `[RENDER_BACKEND_URL]` |
| Frontend | Vercel | `[VERCEL_FRONTEND_URL]` |
| Landing | Vercel | `[VERCEL_LANDING_URL]` |

---

## Note di sicurezza

Il progetto utilizza JWT con refresh token in cookie HttpOnly, protezione CSRF, cifratura AES-256-GCM dei token provider e rate limiter sugli endpoint sensibili.

---

## Stato progetto

- Progetto finale Epicode
- Versione beta/MVP funzionante in locale
- Alcune configurazioni esterne (Google Ads API, Meta Ads, Shopify Partner account) richiedono approvazioni da parte dei rispettivi provider prima di essere operative in produzione
