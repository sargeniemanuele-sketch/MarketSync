import { Router } from 'express';

import * as clientsController from '../controllers/clients.controller.js';
import * as customMetricsController from '../controllers/customMetrics.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { createClientSchema, updateClientSchema, idParamSchema } from '../validators/client.validators.js';
import {
  createCustomMetricSchema,
  customMetricClientParamSchema,
  customMetricKeyParamSchema,
  previewCustomMetricQuerySchema,
  previewCustomMetricSchema,
  updateCustomMetricSchema,
} from '../validators/shared/customMetric.schema.js';

const router = Router();

// Tutte le route client richiedono autenticazione: l'ownership è sempre limitata a req.user.id.
router.use(requireAuth);

router.get('/', clientsController.listClients);

router.post(
  '/',
  validate({ body: createClientSchema }),
  clientsController.createClient
);

router.get(
  '/:id',
  validate({ params: idParamSchema }),
  clientsController.getClient
);

router.get(
  '/:clientId/custom-metrics',
  validate({ params: customMetricClientParamSchema }),
  customMetricsController.listCustomMetrics
);

router.post(
  '/:clientId/custom-metrics',
  validate({ params: customMetricClientParamSchema, body: createCustomMetricSchema }),
  customMetricsController.createCustomMetric
);

router.post(
  '/:clientId/custom-metrics/preview',
  validate({
    params: customMetricClientParamSchema,
    query: previewCustomMetricQuerySchema,
    body: previewCustomMetricSchema,
  }),
  customMetricsController.previewCustomMetric
);

router.patch(
  '/:clientId/custom-metrics/:metricKey',
  validate({ params: customMetricKeyParamSchema, body: updateCustomMetricSchema }),
  customMetricsController.updateCustomMetric
);

router.delete(
  '/:clientId/custom-metrics/:metricKey',
  validate({ params: customMetricKeyParamSchema }),
  customMetricsController.deleteCustomMetric
);

router.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateClientSchema }),
  clientsController.updateClient
);

router.delete(
  '/:id',
  validate({ params: idParamSchema }),
  clientsController.deleteClient
);

export default router;
