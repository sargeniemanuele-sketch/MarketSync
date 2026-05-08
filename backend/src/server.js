import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import app from './app.js';
import { cleanupMetricCacheJob } from './jobs/cleanupMetricCache.job.js';
import { cleanupSyncLogsJob } from './jobs/cleanupSyncLogs.job.js';

const CACHE_CLEANUP_INTERVAL_MS    =  60 * 60 * 1000; // ogni ora
const SYNC_LOG_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // ogni 24h

function scheduleCleanupJobs() {
  setInterval(() => {
    cleanupMetricCacheJob().catch(() => {});
  }, CACHE_CLEANUP_INTERVAL_MS);

  setInterval(() => {
    cleanupSyncLogsJob().catch(() => {});
  }, SYNC_LOG_CLEANUP_INTERVAL_MS);
}

async function bootstrap() {
  await connectDB();

  scheduleCleanupJobs();

  const server = app.listen(env.PORT, () => {
    console.log(`[Server] Running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`[Server] ${signal} received – shutting down gracefully`);
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
