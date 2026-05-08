import { PAGINATION } from '../config/app.constants.js';

/**
 * Esegue il parsing di page/limit dalla query string con default sicuri e clamping.
 * Restituisce il valore skip pronto per Mongoose .skip().
 */
export function parsePaginationQuery(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT)
  );
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Costruisce il blocco pagination inserito in meta.pagination nelle risposte.
 *
 * @param {number} page  - Pagina corrente (base 1)
 * @param {number} limit - Elementi per pagina
 * @param {number} total - Totale documenti corrispondenti
 */
export function buildPaginationMeta(page, limit, total) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
