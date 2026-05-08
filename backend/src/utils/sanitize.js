import sanitizeHtml from 'sanitize-html';

// Rimuove tutti i tag e attributi HTML: sicuro per campi di testo semplice.
const STRIP_ALL_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
};

/**
 * Rimuove tutto l'HTML da una stringa. Usare su qualsiasi input utente libero
 * (nomi, note, descrizioni) prima del salvataggio nel database.
 */
export function sanitizeText(input) {
  if (typeof input !== 'string') return input;
  return sanitizeHtml(input, STRIP_ALL_OPTIONS).trim();
}

/**
 * Sanifica HTML consentendo un sottoinsieme controllato di tag.
 * Usare solo dove il rich text (es. note client) deve essere preservato.
 *
 * @param {string} input
 * @param {object} [options] - Opzioni sanitize-html (unite ai default sicuri)
 */
export function sanitizeRichText(input, options = {}) {
  if (typeof input !== 'string') return input;
  return sanitizeHtml(input, options);
}

/**
 * Sanifica campi specifici su un oggetto semplice, restituendo un nuovo oggetto.
 * Non muta l'originale.
 *
 * @param {object}   obj    - Oggetto sorgente (es. req.body)
 * @param {string[]} fields - Nomi dei campi da sanificare
 */
export function sanitizeFields(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === 'string') {
      result[field] = sanitizeText(result[field]);
    }
  }
  return result;
}
