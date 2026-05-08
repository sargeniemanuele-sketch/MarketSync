import { ValidationError } from '../utils/errors.js';

/**
 * Formatta le issue zod in stringhe leggibili.
 * source = 'body' | 'params' | 'query'
 */
function formatZodErrors(zodError, source) {
  return zodError.issues.map((issue) => {
    const field = issue.path.length > 0
      ? `${source}.${issue.path.join('.')}`
      : source;
    return `${field}: ${issue.message}`;
  });
}

/**
 * Factory generica per middleware di validazione.
 *
 * Accetta schemi Zod separati per body, params e query.
 * I dati validati e sanificati vengono scritti in req.validated.{body,params,query}.
 * I controller devono leggere da req.validated, non da req.body/params/query grezzi.
 *
 * Uso:
 *   router.post('/register', validate({ body: registerSchema }), handler);
 *   router.get('/:id',       validate({ params: idParamSchema, query: metricsQuerySchema }), handler);
 */
export function validate({ body: bodySchema, params: paramsSchema, query: querySchema } = {}) {
  return (req, _res, next) => {
    const messages = [];
    const out = {};

    const run = (schema, source, input) => {
      const result = schema.safeParse(input);
      if (!result.success) {
        messages.push(...formatZodErrors(result.error, source));
      } else {
        out[source] = result.data;
      }
    };

    if (bodySchema)   run(bodySchema,   'body',   req.body);
    if (paramsSchema) run(paramsSchema, 'params', req.params);
    if (querySchema)  run(querySchema,  'query',  req.query);

    if (messages.length > 0) {
      return next(new ValidationError(messages.join('; '), { scope: 'validation' }));
    }

    req.validated = out;
    next();
  };
}
