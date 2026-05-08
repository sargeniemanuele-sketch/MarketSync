import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../contracts/responseBuilders/success.js';
import { getBootstrapData } from '../services/app/appBootstrap.service.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Restituisce in una singola richiesta tutto ciò che serve al frontend al primo caricamento:
// l'utente autenticato, l'ultimo client selezionato e tutti i client con i relativi
// stati delle integrazioni. Non include dati sensibili delle integrazioni.

export const bootstrap = asyncHandler(async (req, res) => {
  const { lastSelectedClientId, clients } = await getBootstrapData(req.user.id);

  // L'utente deriva dal payload JWT già presente in req.user: nessuna query DB aggiuntiva.
  return sendSuccess(res, {
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatarUrl: req.user.avatarUrl ?? null,
      role: req.user.role,
    },
    lastSelectedClientId,
    clients,
  });
});
