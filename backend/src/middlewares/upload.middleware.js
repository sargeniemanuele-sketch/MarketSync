import multer from 'multer';
import { UPLOAD, HTTP_STATUS } from '../config/app.constants.js';
import { AppError } from '../utils/errors.js';

const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  if (UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Formato immagine non supportato. Usa JPG, PNG o WebP.',
        HTTP_STATUS.BAD_REQUEST,
        'INVALID_PROFILE_IMAGE'
      )
    );
  }
}

const _multer = multer({
  storage,
  limits: { fileSize: UPLOAD.MAX_FILE_SIZE_BYTES },
  fileFilter,
});

/**
 * Middleware multer per upload singolo campo "avatar".
 * Converte MulterError in AppError con codici leggibili.
 * Il file viene tenuto in memoria (req.file.buffer): non tocca il filesystem.
 */
export function avatarUpload(req, res, next) {
  _multer.single('avatar')(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new AppError(
          `Il file è troppo grande. Dimensione massima: ${UPLOAD.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
          HTTP_STATUS.BAD_REQUEST,
          'PROFILE_IMAGE_TOO_LARGE'
        )
      );
    }

    next(err);
  });
}
