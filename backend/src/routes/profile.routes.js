import { Router } from 'express';

import * as profileController from '../controllers/profile.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { avatarUploadLimiter } from '../middlewares/rateLimit.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { avatarUpload } from '../middlewares/upload.middleware.js';
import { updateProfileSchema } from '../validators/profile.validators.js';

const router = Router();

router.use(requireAuth);

router.get('/', profileController.getProfile);

router.patch(
  '/',
  validate({ body: updateProfileSchema }),
  profileController.updateProfile
);

router.patch('/avatar', avatarUploadLimiter, avatarUpload, profileController.uploadAvatar);

router.delete('/avatar', profileController.deleteAvatar);

router.delete('/', profileController.deleteProfile);

export default router;
