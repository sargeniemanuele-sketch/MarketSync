import mongoose from 'mongoose';

const { Schema } = mongoose;

// ── Business settings ─────────────────────────────────────────────────────────

const extraCostSchema = new Schema(
  {
    key:   { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    value: { type: Number, required: true, default: 0 },
    type:  { type: String, required: true, enum: ['fixed', 'percentage'] },
  },
  { _id: false }
);

const businessSettingsSchema = new Schema(
  {
    commissionPercentage: { type: Number, default: null },
    fixedCommission:      { type: Number, default: null },
    extraCosts:           { type: [extraCostSchema], default: [] },
  },
  { _id: false }
);

// ── Variabile metrica custom ──────────────────────────────────────────────────

const metricVariableSchema = new Schema(
  {
    variableKey: { type: String, required: true, trim: true },
    sourceProvider: {
      type: String,
      required: true,
      enum: ['shopify', 'meta_ads', 'google_ads', 'overview', 'client_setting'],
    },
    metricKey: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// ── Elemento config metrica custom ────────────────────────────────────────────
// timestamps: true aggiunge createdAt/updatedAt a ogni voce di config come richiesto.

const customMetricConfigSchema = new Schema(
  {
    key:      { type: String, required: true, trim: true },
    label:    { type: String, required: true, trim: true },
    description: { type: String, default: null, maxlength: 500, trim: true },
    enabled:  { type: Boolean, default: true },
    unit: {
      type: String,
      required: true,
      enum: ['currency', 'number', 'percentage', 'ratio'],
    },
    formula:  { type: String, required: true, trim: true },
    variables: {
      type: [metricVariableSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one variable is required',
      },
    },
    providerContext: {
      type: String,
      required: true,
      enum: ['overview', 'shopify', 'meta_ads', 'google_ads', 'mixed'],
      default: 'mixed',
    },
  },
  { timestamps: true }
);

// ── Client ────────────────────────────────────────────────────────────────────

const clientSchema = new Schema(
  {
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
    },
    contactEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid contact email format'],
    },
    notes: {
      type: String,
      default: null,
      maxlength: [500, 'Notes must not exceed 500 characters'],
      trim: true,
    },
    website: {
      type: String,
      default: null,
      trim: true,
      match: [/^https?:\/\/.+/, 'Website must be a valid URL starting with http:// or https://'],
    },
    businessSettings: {
      type: businessSettingsSchema,
      default: () => ({ commissionPercentage: null, fixedCommission: null, extraCosts: [] }),
    },
    customMetricsConfig: {
      type: [customMetricConfigSchema],
      default: [],
      validate: {
        validator(metrics) {
          if (!Array.isArray(metrics)) return true;
          const keys = metrics.map((metric) => metric?.key).filter(Boolean);
          return keys.length === new Set(keys).size;
        },
        message: 'customMetricsConfig keys must be unique inside the client',
      },
    },
  },
  { timestamps: true }
);

// Un marketer non può avere due client con lo stesso nome.
clientSchema.index({ ownerUserId: 1, name: 1 }, { unique: true });

export default mongoose.model('Client', clientSchema);
