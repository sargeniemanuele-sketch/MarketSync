import { z } from 'zod';
import { sanitizeText } from '../utils/sanitize.js';

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Il nome è obbligatorio.' })
    .min(1, 'Il nome è obbligatorio.')
    .max(100, 'Il nome non può superare 100 caratteri.')
    .transform((s) => sanitizeText(s.trim())),
  email: z
    .string({ required_error: "L'email è obbligatoria." })
    .email('Inserisci un indirizzo email valido.')
    .transform((s) => s.trim().toLowerCase()),
  // Non sanificata: bcrypt la gestisce. Nessun rischio HTML nella fase di hash.
  password: z
    .string({ required_error: 'La password è obbligatoria.' })
    .min(8, 'La password deve contenere almeno 8 caratteri.')
    .max(100, 'La password non può superare 100 caratteri.')
    .regex(/[a-zA-Z]/, 'La password deve contenere almeno una lettera.')
    .regex(/[0-9]/, 'La password deve contenere almeno un numero.'),
}).strict();

export const loginSchema = z.object({
  email: z
    .string({ required_error: "L'email è obbligatoria." })
    .email('Inserisci un indirizzo email valido.')
    .transform((s) => s.trim().toLowerCase()),
  password: z
    .string({ required_error: 'La password è obbligatoria.' })
    .min(1, 'La password è obbligatoria.'),
}).strict();

// I token arrivano tramite cookie httpOnly: nessun body atteso.
export const emptyBodySchema = z.object({}).strict();

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "L'email è obbligatoria." })
    .email('Inserisci un indirizzo email valido.')
    .transform((s) => s.trim().toLowerCase()),
}).strict();

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'Il token è obbligatorio.' })
    .min(1, 'Il token è obbligatorio.'),
  // Stesse regole di registerSchema
  password: z
    .string({ required_error: 'La password è obbligatoria.' })
    .min(8, 'La password deve contenere almeno 8 caratteri.')
    .max(100, 'La password non può superare 100 caratteri.')
    .regex(/[a-zA-Z]/, 'La password deve contenere almeno una lettera.')
    .regex(/[0-9]/, 'La password deve contenere almeno un numero.'),
}).strict();

export const exchangeOAuthCodeSchema = z.object({
  code: z
    .string({ required_error: 'Codice OAuth obbligatorio.' })
    .trim()
    .min(32, 'Codice OAuth non valido.')
    .max(128, 'Codice OAuth non valido.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Codice OAuth non valido.'),
}).strict();
