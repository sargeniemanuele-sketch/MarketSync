import { cleanupOldSyncLogs } from '../services/logging/syncLog.service.js';

/**
 * Cleanup manuale dei log di sync.
 *
 * Riusa la logica di cleanup di syncLog.service per evitare duplicazione.
 *
 * @param {object} [options]
 * @param {number} [options.olderThanDays]
 * @returns {Promise<{ deletedCount: number, cutoffDate: Date, finishedAt: Date }>}
 */
export async function cleanupSyncLogsJob({ olderThanDays } = {}) {
  const { deletedCount, cutoffDate } = await cleanupOldSyncLogs({ olderThanDays });

  return {
    deletedCount: deletedCount ?? 0,
    cutoffDate,
    finishedAt: new Date(),
  };
}

export default cleanupSyncLogsJob;
