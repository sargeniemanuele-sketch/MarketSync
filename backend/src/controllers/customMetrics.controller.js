import { sendCreated, sendNoContent, sendSuccess } from '../contracts/responseBuilders/success.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { resolveMetricsRange } from '../utils/ranges.js';
import * as customMetricsService from '../services/customMetrics/customMetrics.service.js';

export const listCustomMetrics = asyncHandler(async (req, res) => {
  const { clientId } = req.validated.params;
  const result = await customMetricsService.listCustomMetrics(req.user.id, clientId);
  return sendSuccess(res, { customMetrics: result.metrics }, { meta: result.meta });
});

export const createCustomMetric = asyncHandler(async (req, res) => {
  const { clientId } = req.validated.params;
  const metric = await customMetricsService.createCustomMetric(
    req.user.id,
    clientId,
    req.validated.body
  );
  return sendCreated(res, { customMetric: metric });
});

export const updateCustomMetric = asyncHandler(async (req, res) => {
  const { clientId, metricKey } = req.validated.params;
  const metric = await customMetricsService.updateCustomMetric(
    req.user.id,
    clientId,
    metricKey,
    req.validated.body
  );
  return sendSuccess(res, { customMetric: metric });
});

export const deleteCustomMetric = asyncHandler(async (req, res) => {
  const { clientId, metricKey } = req.validated.params;
  await customMetricsService.deleteCustomMetric(req.user.id, clientId, metricKey);
  return sendNoContent(res);
});

export const previewCustomMetric = asyncHandler(async (req, res) => {
  const { clientId } = req.validated.params;
  const resolved = resolveMetricsRange(req.validated.query);
  const result = await customMetricsService.previewCustomMetric(
    req.user.id,
    clientId,
    req.validated.body,
    {
      range: req.validated.query.range,
      startDate: resolved.startDate,
      endDate: resolved.endDate,
    }
  );

  return sendSuccess(res, { preview: result.metric }, {
    warnings: result.warnings,
    meta: result.meta,
  });
});
