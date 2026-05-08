/**
 * Wrappa un gestore route async così che le promise rejection non catturate
 * vengano inoltrate a next() di Express invece di lasciare la richiesta sospesa.
 *
 * Uso:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
