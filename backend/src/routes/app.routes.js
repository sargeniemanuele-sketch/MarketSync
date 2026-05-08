import { Router } from 'express';

import { requireAuth } from '../middlewares/auth.middleware.js';
import * as appController from '../controllers/app.controller.js';

const router = Router();

router.get('/bootstrap', requireAuth, appController.bootstrap);

export default router;
