import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../contracts/responseBuilders/success.js';
import * as clientsService from '../services/clients/clients.service.js';

// ── Lista ─────────────────────────────────────────────────────────────────────

export const listClients = asyncHandler(async (req, res) => {
  const { clients, pagination } = await clientsService.listClients(req.user.id, req.query);
  return sendPaginated(res, clients, pagination);
});

// ── Creazione ─────────────────────────────────────────────────────────────────

export const createClient = asyncHandler(async (req, res) => {
  const client = await clientsService.createClient(req.user.id, req.validated.body);
  return sendCreated(res, { client });
});

// ── Recupero per id ───────────────────────────────────────────────────────────

export const getClient = asyncHandler(async (req, res) => {
  const client = await clientsService.getClientById(req.user.id, req.validated.params.id);
  return sendSuccess(res, { client });
});

// ── Aggiornamento ─────────────────────────────────────────────────────────────

export const updateClient = asyncHandler(async (req, res) => {
  const client = await clientsService.updateClient(
    req.user.id,
    req.validated.params.id,
    req.validated.body
  );
  return sendSuccess(res, { client });
});

// ── Eliminazione ──────────────────────────────────────────────────────────────

export const deleteClient = asyncHandler(async (req, res) => {
  await clientsService.deleteClient(req.user.id, req.validated.params.id);
  return sendNoContent(res);
});
