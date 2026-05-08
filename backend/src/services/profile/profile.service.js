import mongoose from 'mongoose';
import User from '../../models/User.js';
import Client from '../../models/Client.js';
import DashboardPreference from '../../models/DashboardPreference.js';
import Integration from '../../models/Integration.js';
import MetricCache from '../../models/MetricCache.js';
import SyncLog from '../../models/SyncLog.js';
import OAuthLoginCode from '../../models/OAuthLoginCode.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import { HTTP_STATUS } from '../../config/app.constants.js';
import * as cloudinaryService from '../uploads/cloudinary.service.js';
import * as googleAdsAuthService from '../googleAds/googleAds.auth.service.js';
import * as metaAdsAuthService from '../metaAds/metaAds.auth.service.js';
import { decrypt } from '../security/encryption.service.js';

function inferLoginProvider(user) {
  if (user.passwordHash && user.googleId) return 'mixed';
  if (user.googleId) return 'google';
  return 'local';
}

function serializeProfile(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    nickname: user.nickname ?? null,
    email: user.email,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    avatarSource: user.avatarSource ?? null,
    role: user.role,
    loginProvider: user.loginProvider ?? inferLoginProvider(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

function removeUndefinedFields(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}

function isTransactionUnsupportedError(err) {
  const message = err?.message ?? '';
  return message.includes('Transaction numbers are only allowed on a replica set member or mongos')
    || message.includes('This MongoDB deployment does not support retryable writes');
}

async function getProfileDeletionContext(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new NotFoundError('Profilo non trovato.', { scope: 'profile' });
  }

  const clients = await Client.find({ ownerUserId: userId })
    .select('_id')
    .lean();
  const clientIds = clients.map((client) => client._id);
  const integrations = clientIds.length > 0
    ? await Integration.find({ clientId: { $in: clientIds } })
      .select('clientId provider credentials')
      .lean()
    : [];

  return { user, integrations };
}

async function cleanupExternalProfileAssetsBestEffort(user) {
  if (user?.avatarSource !== 'upload' || !user.avatarPublicId) return;

  try {
    await cloudinaryService.deleteCloudinaryAsset(user.avatarPublicId);
  } catch {
    console.warn('[profile.delete] Cloudinary avatar cleanup failed during account deletion.');
  }
}

function decryptFirstAvailableToken(credentials) {
  try {
    const refreshToken = decrypt(credentials?.refreshToken);
    if (refreshToken) return refreshToken;
  } catch {
    // Prova accessToken come fallback.
  }

  try {
    return decrypt(credentials?.accessToken);
  } catch {
    return null;
  }
}

async function revokeMetaAdsIntegrationsBestEffort(integrations) {
  const metaAdsIntegrations = integrations.filter((integration) => integration.provider === 'meta_ads');

  for (const integration of metaAdsIntegrations) {
    try {
      const tokenToRevoke = decryptFirstAvailableToken(integration.credentials);
      if (!tokenToRevoke) {
        console.warn('[profile.delete] Meta Ads token revoke skipped during account deletion:', {
          clientId: String(integration.clientId),
          code: 'META_ADS_REVOKE_TOKEN_UNAVAILABLE',
        });
        continue;
      }

      const revokeResult = await metaAdsAuthService.revokeMetaAdsToken(tokenToRevoke);
      if (!revokeResult.success) {
        console.warn('[profile.delete] Meta Ads token revoke failed during account deletion:', {
          clientId: String(integration.clientId),
          code: revokeResult.code,
        });
      }
    } catch {
      console.warn('[profile.delete] Meta Ads token revoke failed during account deletion:', {
        clientId: String(integration.clientId),
      });
    }
  }
}

async function revokeGoogleAdsIntegrationsBestEffort(integrations) {
  const googleAdsIntegrations = integrations.filter((integration) => integration.provider === 'google_ads');

  for (const integration of googleAdsIntegrations) {
    try {
      const tokenToRevoke = decryptFirstAvailableToken(integration.credentials);
      if (!tokenToRevoke) {
        console.warn('[profile.delete] Google Ads token revoke skipped during account deletion:', {
          clientId: String(integration.clientId),
          code: 'GOOGLE_ADS_REVOKE_TOKEN_UNAVAILABLE',
        });
        continue;
      }

      const revokeResult = await googleAdsAuthService.revokeGoogleAdsToken(tokenToRevoke);
      if (!revokeResult.success) {
        console.warn('[profile.delete] Google Ads token revoke failed during account deletion:', {
          clientId: String(integration.clientId),
          code: revokeResult.code,
        });
      }
    } catch {
      console.warn('[profile.delete] Google Ads token revoke failed during account deletion:', {
        clientId: String(integration.clientId),
      });
    }
  }
}

async function deleteProfileData(userId, session = null) {
  const user = await User.findById(userId).session(session).lean();
  if (!user) {
    throw new NotFoundError('Profilo non trovato.', { scope: 'profile' });
  }

  const clients = await Client.find({ ownerUserId: userId })
    .select('_id')
    .session(session)
    .lean();
  const clientIds = clients.map((client) => client._id);

  if (clientIds.length > 0) {
    await Integration.deleteMany({ clientId: { $in: clientIds } }).session(session);
    await MetricCache.deleteMany({ clientId: { $in: clientIds } }).session(session);
    await SyncLog.deleteMany({ clientId: { $in: clientIds } }).session(session);
  }

  await OAuthLoginCode.deleteMany({ userId }).session(session);
  await DashboardPreference.deleteMany({ userId }).session(session);
  await Client.deleteMany({ ownerUserId: userId }).session(session);
  await User.deleteOne({ _id: userId }).session(session);
}

export async function getProfile(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new NotFoundError('Profilo non trovato.', { scope: 'profile' });
  }

  return serializeProfile(user);
}

export async function updateProfile(userId, data) {
  const update = removeUndefinedFields(data);

  if (Object.keys(update).length === 0) {
    return getProfile(userId);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true }
  ).lean();

  if (!user) {
    throw new NotFoundError('Profilo non trovato.', { scope: 'profile' });
  }

  return serializeProfile(user);
}

function assertAvatarUploadAllowed(user) {
  const provider = user.loginProvider ?? inferLoginProvider(user);
  if (provider === 'google') {
    throw new AppError(
      'Il caricamento della foto profilo è disponibile solo per account registrati con email e password.',
      HTTP_STATUS.FORBIDDEN,
      'AVATAR_UPLOAD_NOT_ALLOWED',
      { scope: 'profile' }
    );
  }
}

export async function uploadProfileAvatar(userId, file) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('Profilo non trovato.', { scope: 'profile' });
  }

  assertAvatarUploadAllowed(user);

  const { secureUrl, publicId } = await cloudinaryService.uploadProfileAvatar({
    buffer: file.buffer,
    userId,
  });

  // Rimuovi il vecchio asset Cloudinary solo se era un upload personalizzato
  if (user.avatarPublicId && user.avatarSource === 'upload') {
    await cloudinaryService.deleteCloudinaryAsset(user.avatarPublicId);
  }

  user.avatarUrl = secureUrl;
  user.avatarPublicId = publicId;
  user.avatarSource = 'upload';
  await user.save();

  return serializeProfile(user);
}

export async function deleteProfileAvatar(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('Profilo non trovato.', { scope: 'profile' });
  }

  assertAvatarUploadAllowed(user);

  if (user.avatarSource !== 'upload') {
    throw new AppError(
      'Nessuna foto profilo personalizzata da rimuovere.',
      HTTP_STATUS.BAD_REQUEST,
      'NO_CUSTOM_AVATAR'
    );
  }

  if (user.avatarPublicId) {
    await cloudinaryService.deleteCloudinaryAsset(user.avatarPublicId);
  }

  user.avatarUrl = null;
  user.avatarPublicId = null;
  user.avatarSource = null;
  await user.save();

  return serializeProfile(user);
}

export async function deleteProfile(userId) {
  const { user, integrations } = await getProfileDeletionContext(userId);

  await cleanupExternalProfileAssetsBestEffort(user);
  await revokeGoogleAdsIntegrationsBestEffort(integrations);
  await revokeMetaAdsIntegrationsBestEffort(integrations);

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await deleteProfileData(userId, session);
    });
  } catch (err) {
    if (!isTransactionUnsupportedError(err)) {
      throw err;
    }

    await deleteProfileData(userId);
  } finally {
    await session.endSession();
  }

  return { deleted: true };
}
