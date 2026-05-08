import { z } from 'zod';
import { sanitizeText } from '../utils/sanitize.js';
import { customMetricConfigItemSchema } from './shared/customMetric.schema.js';

export const mongoIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Identificatore non valido.');

export const idParamSchema = z.object({
  id: mongoIdSchema,
});

// ── Business settings ─────────────────────────────────────────────────────────

const extraCostItemSchema = z.object({
  key: z
    .string()
    .min(1, 'Identificatore costo obbligatorio.')
    .regex(/^[a-z][a-z0-9_]*$/, 'Usa solo lettere minuscole, numeri e trattini bassi ( _ ). Inizia con una lettera.'),
  label: z.string().min(1, 'Nome costo obbligatorio.').max(100),
  value: z.number().min(0, 'Il costo deve essere maggiore o uguale a 0.'),
  type: z.enum(['fixed', 'percentage']),
});

const businessSettingsSchema = z
  .object({
    commissionPercentage: z.number().min(0, 'Il valore deve essere maggiore o uguale a 0.').nullable().optional(),
    fixedCommission: z.number().min(0, 'Il valore deve essere maggiore o uguale a 0.').nullable().optional(),
    extraCosts: z
      .array(extraCostItemSchema)
      .optional()
      .superRefine((items, ctx) => {
        if (!Array.isArray(items)) return;
        const seen = new Set();
        items.forEach((item, index) => {
          if (seen.has(item.key)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'key'],
              message: `Esiste già un costo con questo identificatore: ${item.key}`,
            });
          }
          seen.add(item.key);
        });
      }),
  })
  .optional();

// ── Schemi client ─────────────────────────────────────────────────────────────

const clientBaseSchema = z.object({
  name: z
    .string()
    .min(1, 'Il nome cliente è obbligatorio.')
    .max(150)
    .transform((s) => sanitizeText(s.trim())),
  contactEmail: z
    .string()
    .email('Inserisci un indirizzo email valido.')
    .transform((s) => s.trim().toLowerCase())
    .nullable()
    .optional(),
  website: z
    .string()
    .url('Inserisci un URL valido.')
    .trim()
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(500, 'Le note non possono superare 500 caratteri.')
    .transform((s) => sanitizeText(s.trim()))
    .nullable()
    .optional(),
  businessSettings: businessSettingsSchema,
  customMetricsConfig: z.array(customMetricConfigItemSchema).optional().superRefine((metrics, ctx) => {
    if (!Array.isArray(metrics)) return;

    const seen = new Set();
    metrics.forEach((metric, index) => {
      if (seen.has(metric.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'key'],
          message: `Esiste già una metrica con questo identificatore: ${metric.key}`,
        });
      }
      seen.add(metric.key);
    });
  }),
});

export const createClientSchema = clientBaseSchema.strict();

// Aggiornamento parziale: sono consentite solo le chiavi elencate esplicitamente.
export const updateClientSchema = clientBaseSchema.partial().strict();
