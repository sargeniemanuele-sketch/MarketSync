import mongoose from 'mongoose';

const { Schema } = mongoose;

export const METRIC_CACHE_UNIQUE_INDEX_KEY = {
  clientId: 1,
  provider: 1,
  metricKey: 1,
  granularity: 1,
  range: 1,
  startDate: 1,
  endDate: 1,
};

const metricCacheSchema = new Schema(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['overview', 'shopify', 'meta_ads', 'google_ads', 'dashboard', 'custom_metric'],
    },
    metricKey: {
      type: String,
      default: null,
      trim: true,
    },
    granularity: {
      type: String,
      default: null,
      trim: true,
      enum: [null, 'auto', 'hourly', 'daily', 'weekly', 'monthly'],
    },
    range: {
      type: String,
      required: true,
      enum: ['today', 'yesterday', 'last_7_days', 'last_14_days', 'last_30_days', 'custom'],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    responsePayload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    source: {
      type: String,
      required: true,
      enum: ['live', 'cache'],
      default: 'live',
    },
    fetchedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    staleExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

metricCacheSchema.index(
  METRIC_CACHE_UNIQUE_INDEX_KEY,
  { unique: true }
);

// TTL index su staleExpiresAt: i documenti vengono eliminati automaticamente dopo la finestra stale (24h).
// L'indice precedente su expiresAt (7 min) è rimosso: la freshness viene ora controllata via query,
// non tramite eliminazione automatica, per permettere il fallback stale.
metricCacheSchema.index({ staleExpiresAt: 1 }, { expireAfterSeconds: 0 });

metricCacheSchema.index({ clientId: 1, provider: 1 });

const MetricCache = mongoose.models.MetricCache ?? mongoose.model('MetricCache', metricCacheSchema);

function hasExpectedUniqueMetricCacheKey(index) {
  return JSON.stringify(index.key) === JSON.stringify(METRIC_CACHE_UNIQUE_INDEX_KEY);
}

export async function reconcileMetricCacheIndexes(logger = console) {
  let indexes = [];

  try {
    indexes = await MetricCache.collection.indexes();
  } catch (error) {
    if (error?.code !== 26 && error?.codeName !== 'NamespaceNotFound') {
      throw error;
    }
  }

  const staleUniqueIndexes = indexes.filter((index) => {
    return index.name !== '_id_' && index.unique && !hasExpectedUniqueMetricCacheKey(index);
  });

  for (const index of staleUniqueIndexes) {
    await MetricCache.collection.dropIndex(index.name);
    logger.info?.(`[DB] Dropped stale MetricCache unique index: ${index.name}`);
  }

  await MetricCache.createIndexes();
}

export default MetricCache;
