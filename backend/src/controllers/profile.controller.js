import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../contracts/responseBuilders/success.js';
import { clearRefreshCookie, clearCsrfCookie } from '../services/auth/token.service.js';
import * as profileService from '../services/profile/profile.service.js';
import { AppError } from '../utils/errors.js';
import { HTTP_STATUS } from '../config/app.constants.js';

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await profileService.getProfile(req.user.id);
  return sendSuccess(res, { profile });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const profile = await profileService.updateProfile(req.user.id, req.validated.body);
  return sendSuccess(res, { profile });
});

export const deleteProfile = asyncHandler(async (req, res) => {
  const result = await profileService.deleteProfile(req.user.id);
  clearRefreshCookie(res);
  clearCsrfCookie(res);
  return sendSuccess(res, result);
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(
      "Nessun file ricevuto. Seleziona un'immagine da caricare.",
      HTTP_STATUS.BAD_REQUEST,
      'NO_FILE_PROVIDED'
    );
  }
  const profile = await profileService.uploadProfileAvatar(req.user.id, req.file);
  return sendSuccess(res, { profile });
});

export const deleteAvatar = asyncHandler(async (req, res) => {
  const profile = await profileService.deleteProfileAvatar(req.user.id);
  return sendSuccess(res, { profile });
});
