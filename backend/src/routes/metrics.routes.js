import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { metricsLimiter } from '../middlewares/rateLimit.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { metricDetailQuerySchema, metricsQuerySchema } from '../validators/metrics.validators.js';
import * as metricsController from '../controllers/metrics.controller.js';

const router = Router();

router.use(requireAuth);
router.use(metricsLimiter);

router.get(
  '/detail',
  validate({ query: metricDetailQuerySchema }),
  metricsController.getMetricDetail
);

router.get(
  '/overview',
  validate({ query: metricsQuerySchema }),
  metricsController.getOverviewMetrics
);

router.get(
  '/shopify',
  validate({ query: metricsQuerySchema }),
  metricsController.getShopifyMetrics
);

router.get(
  '/meta-ads',
  validate({ query: metricsQuerySchema }),
  metricsController.getMetaAdsMetrics
);

router.get(
  '/google-ads',
  validate({ query: metricsQuerySchema }),
  metricsController.getGoogleAdsMetrics
);

router.get(
  '/custom',
  validate({ query: metricsQuerySchema }),
  metricsController.getCustomMetrics
);

router.get(
  '/dashboard',
  validate({ query: metricsQuerySchema }),
  metricsController.getDashboardMetrics
);

export default router;
