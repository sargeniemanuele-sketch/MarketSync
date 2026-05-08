# Landing — MarketSync

Sito statico di presentazione del prodotto con pagine legali e contatti.

---

## File principali

| File | Contenuto |
|------|-----------|
| `index.html` | Home page di presentazione |
| `privacy.html` | Informativa privacy |
| `terms.html` | Termini e condizioni |
| `contact.html` | Pagina contatti |
| `styles.css` | Stili del sito |
| `script.js` | Logica interattiva (menu, animazioni) |
| `robots.txt` | Regole base per crawler |
| `sitemap.xml` | Sitemap statica della landing |

---

## Apertura in locale

Aprire `index.html` direttamente nel browser, oppure usare qualsiasi server statico:

```bash
npx serve landing
```

Non sono necessari Node.js, build step o dipendenze.

---

## Deploy su Vercel

| Impostazione | Valore |
|-------------|--------|
| Root directory | `landing` |
| Build command | *(nessuno)* |
| Output directory | `.` |

---

## Da aggiornare prima del go-live

- URL dell'app nei link "Accedi" / "Prova gratis" → sostituire `[VERCEL_FRONTEND_URL]`
- URL della landing stessa nei file privacy e terms → sostituire `[VERCEL_LANDING_URL]`

