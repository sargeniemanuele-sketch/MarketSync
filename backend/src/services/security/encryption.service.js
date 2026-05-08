import crypto from 'crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

// ── Costanti algoritmo ────────────────────────────────────────────────────────
//
// AES-256-GCM: cifrario AEAD simmetrico.
//   - chiave a 256 bit → confidenzialità forte
//   - modalità GCM → tag di autenticazione integrato (integrità + autenticità)
//   - Nessun HMAC separato necessario
//   - Supporto nativo nel modulo crypto di Node, accelerato hardware sulle CPU moderne

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12;   // nonce a 96 bit: ottimale per GCM (evita rischio di counter-wrap)
const TAG_BYTES  = 16;   // tag auth a 128 bit: massimo GCM, non ridurre
const ENCODING   = 'hex';
const VERSION    = 'v1'; // il prefisso abilita rotazione chiavi futura senza rompere i payload salvati

// ── Caricamento chiave (fail-fast allo startup) ──────────────────────────────
//
// ENCRYPTION_KEY deve essere una stringa esadecimale minuscola da 64 caratteri (32 byte grezzi).
// Genera una nuova chiave con:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Salvare in .env: non committare mai la chiave reale nel source control.
// Ruotare la chiave richiede di ricifrare tutti i payload salvati; il prefisso
// di versione nel formato payload ('v1:...') è progettato per supportarlo in futuro.

function loadKey() {
  const hex = env.security.encryptionKey;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, 'hex');
}

// Valutato una sola volta al caricamento del modulo: se la chiave manca o è malformata,
// l'app non parte e mostra un errore chiaro invece di cifrare silenziosamente con una chiave errata.
const KEY = loadKey();

// ── Formato payload ───────────────────────────────────────────────────────────
//
// Salvato come singola stringa: "v1:<iv_hex>:<authtag_hex>:<ciphertext_hex>"
//
//   v1         → versione formato (permette di rilevare rotazione chiavi in futuro)
//   iv_hex     → esadecimale da 24 caratteri (12 byte): unico per ogni chiamata encrypt()
//   authtag_hex → esadecimale da 32 caratteri (16 byte): verificato in decrypt()
//   ciphertext_hex → esadecimale a lunghezza variabile
//
// Tutte le parti sono esadecimali → nessun due punti nelle parti → split su ':' sicuro
// La stringa è un singolo campo String MongoDB; nessuna serializzazione extra necessaria.

// ── API pubblica ──────────────────────────────────────────────────────────────

/**
 * Cifra una stringa in testo in chiaro.
 *
 * - null / undefined / '' → restituisce null (campo non impostato; nessuna CPU sprecata)
 * - Il testo in chiaro non viene mai loggato dentro questa funzione
 *
 * @param   {string|null|undefined} plaintext
 * @returns {string|null}  Stringa payload opaca sicura da salvare in MongoDB
 */
export function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return null;

  const iv         = crypto.randomBytes(IV_BYTES);
  const cipher     = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString(ENCODING),
    authTag.toString(ENCODING),
    ciphertext.toString(ENCODING),
  ].join(':');
}

/**
 * Decifra un payload prodotto da encrypt().
 *
 * - null / undefined / '' → restituisce null (campo non impostato)
 * - Lancia AppError (500 / DECRYPTION_ERROR) se:
 *     - il formato payload non è riconosciuto (versione errata, parti mancanti)
 *     - la verifica del tag auth GCM fallisce (dati manomessi o chiave errata)
 *
 * Gli errori non includono mai il payload grezzo nel messaggio: può contenere
 * dati sensibili parziali.
 *
 * @param   {string|null|undefined} payload  Valore restituito in precedenza da encrypt()
 * @returns {string|null}
 */
export function decrypt(payload) {
  if (payload == null || payload === '') return null;

  // ── Parsing ────────────────────────────────────────────────────────────────
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new AppError(
      'Encrypted payload has an unrecognised format',
      500,
      'DECRYPTION_ERROR',
      { scope: 'security' }
    );
  }

  const [, ivHex, authTagHex, ciphertextHex] = parts;

  // ── Decifratura ────────────────────────────────────────────────────────────
  try {
    const iv         = Buffer.from(ivHex, ENCODING);
    const authTag    = Buffer.from(authTagHex, ENCODING);
    const ciphertext = Buffer.from(ciphertextHex, ENCODING);

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Mismatch del tag auth GCM → ciphertext manomesso o ENCRYPTION_KEY cambiata.
    // NON loggare payload né valori derivati: trattare l'intero payload come sensibile.
    throw new AppError(
      'Unable to decrypt protected data',
      500,
      'DECRYPTION_ERROR',
      { scope: 'security' }
    );
  }
}
