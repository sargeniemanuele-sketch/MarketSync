import mongoose from 'mongoose';
import { env } from './env.js';
import { reconcileMetricCacheIndexes } from '../models/MetricCache.js';

const MONGOOSE_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
};

export async function connectDB() {
  try {
    await mongoose.connect(env.db.uri, MONGOOSE_OPTIONS);
    await reconcileMetricCacheIndexes();
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB disconnected');
});
