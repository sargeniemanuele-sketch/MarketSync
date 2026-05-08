import { z } from 'zod';
import {
  CUSTOM_METRIC_SOURCE_PROVIDERS,
  isSupportedSourceMetricKey,
} from '../../contracts/metrics/customMetricSources.js';
import { sanitizeText } from '../../utils/sanitize.js';
import { METRIC_RANGE_VALUES } from '../../utils/ranges.js';

// ── Sicurezza formule ─────────────────────────────────────────────────────────
//
// Singola fonte di verità per le regole di validazione delle formule.
// Importato da client.validators.js per l'array customMetricsConfig.
//
// Caratteri consentiti: identificatori, numeri decimali, operatori aritmetici,
// parentesi, whitespace. Graffe, virgolette, punti e virgola, ecc. sono rifiutati.
// Un secondo controllo blocca la sintassi di chiamata funzione (identificatore subito seguito da '(').

export const SAFE_FORMULA_CHARS = /^[a-zA-Z0-9_.+\-*/() \t\n]+$/;
export const FUNCTION_CALL_PATTERN = /[a-zA-Z_]\w*\s*\(/;
export const CUSTOM_METRIC_UNITS = Object.freeze(['currency', 'number', 'percentage', 'ratio']);
export const CUSTOM_METRIC_PROVIDER_CONTEXTS = Object.freeze([
  'overview',
  'shopify',
  'meta_ads',
  'google_ads',
  'mixed',
]);

export const formulaSchema = z
  .string({ required_error: 'Formula obbligatoria.' })
  .min(1, 'Formula obbligatoria.')
  .max(500, 'La formula non può superare 500 caratteri.')
  .trim()
  .refine(
    (val) => SAFE_FORMULA_CHARS.test(val),
    'La formula contiene caratteri non supportati.'
  )
  .refine(
    (val) => !FUNCTION_CALL_PATTERN.test(val),
    'La formula può usare solo operatori matematici (+, -, *, /) e le variabili definite.'
  );

// ── Schema variabile ──────────────────────────────────────────────────────────

export const metricVariableSchema = z
  .object({
    variableKey: z
      .string({ required_error: 'Nome variabile obbligatorio.' })
      .min(1)
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Usa solo lettere, numeri e trattini bassi ( _ ). Non iniziare con un numero.')
      .trim(),
    sourceProvider: z.enum(
      CUSTOM_METRIC_SOURCE_PROVIDERS,
      { errorMap: () => ({ message: 'Seleziona una sorgente dati valida.' }) }
    ),
    metricKey: z
      .string({ required_error: 'Seleziona la metrica da usare per questa variabile.' })
      .min(1)
      .trim(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isSupportedSourceMetricKey(value.sourceProvider, value.metricKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metricKey'],
        message: 'Seleziona una metrica sorgente valida per questa fonte.',
      });
    }
  });

// ── Elemento config metrica custom ────────────────────────────────────────────
//
// Usato in client.validators.js (array customMetricsConfig in create/patch).

const customMetricConfigItemBaseSchema = z.object({
  key: z
    .string()
    .min(1, 'Identificatore obbligatorio.')
    .max(50)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Usa solo lettere, numeri e trattini bassi ( _ ). Non iniziare con un numero.')
    .trim(),
  label: z
    .string()
    .min(1, 'Etichetta obbligatoria.')
    .max(100)
    .transform((s) => sanitizeText(s.trim())),
  description: z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;

      const text = sanitizeText(String(value).trim());
      return text || null;
    },
    z
      .string()
      .max(500, 'La descrizione non può superare 500 caratteri.')
      .nullable()
      .optional()
  ),
  enabled: z.boolean().optional().default(true),
  unit: z.enum(CUSTOM_METRIC_UNITS, {
    errorMap: () => ({ message: "Seleziona un'unità di misura valida." }),
  }),
  formula: formulaSchema,
  variables: z
    .array(metricVariableSchema)
    .min(1, 'Configura almeno una variabile.'),
  providerContext: z
    .enum(CUSTOM_METRIC_PROVIDER_CONTEXTS, {
      errorMap: () => ({ message: 'Seleziona un contesto valido.' }),
    })
    .optional()
    .default('mixed'),
});

function validateVariableFormulaReferences(value, ctx) {
  if (!Array.isArray(value.variables)) return;

  const variableKeys = new Set();
  for (const variable of value.variables) {
    if (variableKeys.has(variable.variableKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variables'],
        message: `Nome variabile duplicato: ${variable.variableKey}`,
      });
    }
    variableKeys.add(variable.variableKey);
  }

  if (!value.formula) return;

  const identifiers = new Set(value.formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []);
  for (const identifier of identifiers) {
    if (!variableKeys.has(identifier)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['formula'],
        message: `La formula usa una variabile non configurata: ${identifier}`,
      });
    }
  }
}

export const customMetricConfigItemSchema = customMetricConfigItemBaseSchema
  .strict()
  .superRefine(validateVariableFormulaReferences);

export const customMetricKeyParamSchema = z.object({
  clientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Cliente non valido.'),
  metricKey: z
    .string()
    .min(1, 'Seleziona una metrica.')
    .max(50)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'La metrica selezionata non è valida.'),
});

export const customMetricClientParamSchema = z.object({
  clientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Cliente non valido.'),
});

export const createCustomMetricSchema = customMetricConfigItemSchema;
export const updateCustomMetricSchema = customMetricConfigItemBaseSchema
  .partial()
  .strict()
  .superRefine(validateVariableFormulaReferences);
export const previewCustomMetricSchema = customMetricConfigItemSchema;

const isoDateSchema = z
  .string()
  .refine(
    (s) =>
      (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) &&
      !isNaN(new Date(s).getTime()),
    'Inserisci una data valida.'
  )
  .transform((s) => new Date(s));

export const previewCustomMetricQuerySchema = z.object({
  range: z.enum(METRIC_RANGE_VALUES).default('last_30_days'),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
}).strict().superRefine((data, ctx) => {
  if (data.range !== 'custom') return;

  if (!data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Seleziona la data di inizio per il periodo personalizzato.',
      path: ['startDate'],
    });
  }

  if (!data.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Seleziona la data di fine per il periodo personalizzato.',
      path: ['endDate'],
    });
  }

  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La data di inizio deve essere precedente o uguale alla data di fine.',
      path: ['startDate'],
    });
  }
});
