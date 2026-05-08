import { cleanupExpiredMetricCache } from '../services/cache/metricCache.service.js';

export async function cleanupMetricCacheJob() {
  const { deletedCount } = await cleanupExpiredMetricCache();

  return {
    deletedCount,
    finishedAt: new Date(),
  };
}

export default cleanupMetricCacheJob;
