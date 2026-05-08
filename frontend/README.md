# Frontend — MarketSync

SPA React che fornisce l'interfaccia utente per login, dashboard KPI, gestione clienti e integrazioni.

---

## Tecnologie principali

- **React 18** + **Vite 6**
- **React Router v6** — routing lato client
- **Tailwind CSS** — stili
- **Axios** — chiamate HTTP al backend
- **Chart.js** + **react-chartjs-2** — grafici KPI
- **Lucide React** — icone

---

## Script

```bash
npm run dev       # avvia il dev server (porta 5173)
npm run build     # compila per produzione → cartella dist/
npm run preview   # anteprima del build produzione in locale
```

---

## Variabile d'ambiente

Crea un file `.env` nella cartella `frontend/`:

```env
# Locale
VITE_API_BASE_URL=http://localhost:4000/api/v1

# Produzione
# VITE_API_BASE_URL=https://[RENDER_BACKEND_URL]/api/v1
```

---

## Pagine principali

| Pagina | Funzionalità |
|--------|-------------|
| Login / Register | Accesso con email+password o Google |
| Forgot / Reset Password | Recupero account via email |
| Dashboard | Panoramica KPI aggregati |
| Clienti | Lista e dettaglio clienti |
| Integrazioni | Collegamento Shopify, Meta Ads, Google Ads |
| Metriche Shopify / Meta / Google Ads | KPI dettagliati per piattaforma |
| Profilo | Modifica dati, avatar, impostazioni account |
| Impostazioni | Preferenze dashboard e aspetto |

---

## Avvio in locale

```bash
cd frontend
cp .env.example .env
# imposta VITE_API_BASE_URL=http://localhost:4000/api/v1
npm install
npm run dev
```

L'app è disponibile su `http://localhost:5173`. Il backend deve essere già in esecuzione.

---

## Deploy su Vercel

| Impostazione | Valore |
|-------------|--------|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | >= 20 |

Il file `vercel.json` presente nella cartella reindirizza tutte le rotte verso `index.html`, evitando errori 404 al refresh delle pagine React.

Impostare la variabile `VITE_API_BASE_URL` nel pannello Vercel con l'URL del backend Render.
