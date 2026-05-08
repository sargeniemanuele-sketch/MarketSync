import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../contracts/responseBuilders/success.js';
import { getClientById } from '../services/clients/clients.service.js';
import { resolveMetricsRange } from '../utils/ranges.js';
import { buildDashboardData } from '../services/dashboard/dashboard.service.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const { clientId, range, startDate, endDate } = req.validated.query;

  await getClientById(req.user.id, clientId);

  const resolved = resolveMetricsRange({
    range,
    startDate,
    endDate,
  });

  const data = await buildDashboardData({
    clientId,
    range,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
  });

  return sendSuccess(res, data);
});
