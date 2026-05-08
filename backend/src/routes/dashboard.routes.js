import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { metricsLimiter } from '../middlewares/rateLimit.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { metricsQuerySchema } from '../validators/metrics.validators.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

router.use(requireAuth);
router.use(metricsLimiter);

router.get(
  '/',
  validate({ query: metricsQuerySchema }),
  dashboardController.getDashboard
);

export default router;
