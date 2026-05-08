import mongoose from 'mongoose';

const { Schema } = mongoose;

// ── SyncLog ───────────────────────────────────────────────────────────────────
//
// Policy di retention: 30 giorni.
// Il job di cleanup (jobs/cleanupLogs.job.js) interroga { createdAt: { $lt: cutoff } }
// e usa l'indice { clientId, provider, createdAt } per cancellazioni efficienti.
// Un indice TTL NON è usato intenzionalmente qui, per lasciare al job il controllo
// dei tempi di retention e permettere override manuali durante il debug.

const syncLogSchema = new Schema(
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
    endpoint: {
      type: String,
      default: null,
      trim: true,
    },
    rangeRequested: {
      type: String,
      enum: ['today', 'yesterday', 'last_7_days', 'last_14_days', 'last_30_days', 'custom'],
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    source: {
      type: String,
      required: true,
      enum: ['live', 'cache', 'stale'],
    },
    status: {
      type: String,
      required: true,
      enum: ['success', 'error'],
    },
    httpStatus: {
      type: Number,
      default: null,
    },
    durationMs: {
      type: Number,
      default: null,
      min: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    errorCode: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Pattern di query principale: log per un dato client/provider ordinati per tempo.
syncLogSchema.index({ clientId: 1, provider: 1, createdAt: -1 });

// Usato da cleanupLogs.job.js per trovare documenti più vecchi di 30 giorni.
syncLogSchema.index({ createdAt: 1 });

export default mongoose.model('SyncLog', syncLogSchema);
