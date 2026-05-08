import { z } from 'zod';
import { mongoIdSchema } from './client.validators.js';
import { METRIC_RANGE_VALUES } from '../utils/ranges.js';
import { METRIC_GRANULARITY_VALUES } from '../utils/granularity.js';

const DEFAULT_LEGACY_RANGE_FALLBACK = 'last_30_days';

const rangeEnum = z.preprocess(
  (value) => (value === 'this_month' ? DEFAULT_LEGACY_RANGE_FALLBACK : value),
  z.enum(METRIC_RANGE_VALUES, { errorMap: () => ({ message: 'Seleziona un periodo valido.' }) })
);

// Accetta YYYY-MM-DD (data semplice) o qualsiasi stringa ISO 8601 valida (con ora/offset).
// Entrambe vengono convertite in un oggetto Date per i confronti a livello service.
const isoDateSchema = z
  .string()
  .refine(
    (s) =>
      (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) &&
      !isNaN(new Date(s).getTime()),
    'Inserisci una data valida.'
  )
  .transform((s) => new Date(s));

const metricsQueryBaseSchema = z.object({
  // clientId è obbligatorio e deve essere un ObjectId valido.
  // L'ownership rispetto all'utente autenticato è verificata a livello service:
  // non fare mai affidamento solo su clientId dal frontend.
  clientId: mongoIdSchema,
  range: rangeEnum,
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
});

function validateCustomRange(data, ctx) {
    if (data.range === 'custom') {
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
    }
}

export const metricsQuerySchema = metricsQueryBaseSchema.superRefine(validateCustomRange);

const metricDetailProviderEnum = z.enum(
  ['overview', 'shopify', 'meta_ads', 'google_ads', 'custom_metric'],
  { errorMap: () => ({ message: 'Seleziona una piattaforma valida.' }) }
);

const granularityEnum = z
  .enum(METRIC_GRANULARITY_VALUES, {
    errorMap: () => ({ message: 'Seleziona un intervallo di tempo valido.' }),
  })
  .default('auto');

const metricKeySchema = z
  .string()
  .trim()
  .min(1, 'Seleziona una metrica.')
  .max(120, 'La metrica selezionata non è valida.')
  .regex(/^[A-Za-z0-9_.:-]+$/, 'La metrica selezionata non è valida.');

export const metricDetailQuerySchema = metricsQueryBaseSchema
  .extend({
    provider: metricDetailProviderEnum,
    metricKey: metricKeySchema,
    granularity: granularityEnum.optional().default('auto'),
  })
  .superRefine(validateCustomRange);
