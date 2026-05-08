import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { HTTP_STATUS } from '../../config/app.constants.js';

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

function assertConfigured() {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new AppError(
      'Il servizio di upload foto non è configurato. Contatta il supporto.',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      'CLOUDINARY_NOT_CONFIGURED'
    );
  }
}

/**
 * Carica un buffer immagine su Cloudinary come avatar profilo.
 * Usa public_id stabile per sovrascrivere la versione precedente.
 * Applica crop quadrato 512×512, formato e qualità automatici.
 *
 * @returns {{ secureUrl: string, publicId: string }}
 */
export async function uploadProfileAvatar({ buffer, userId }) {
  assertConfigured();

  const folder = env.cloudinary.profileAvatarFolder;
  const publicId = `${folder}/user-${userId}-avatar`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 512, height: 512, crop: 'fill', gravity: 'face' },
          { fetch_format: 'auto', quality: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          return reject(
            new AppError(
              'Upload immagine non riuscito. Riprova.',
              HTTP_STATUS.INTERNAL_ERROR,
              'AVATAR_UPLOAD_FAILED'
            )
          );
        }
        resolve({ secureUrl: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Elimina un asset Cloudinary per public_id.
 * Non solleva eccezioni se la cancellazione fallisce (evita stati inconsistenti).
 */
export async function deleteCloudinaryAsset(publicId) {
  assertConfigured();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch {
    // Non bloccare il flusso se l'eliminazione remota fallisce
  }
}
