import mongoose from 'mongoose';

const { Schema } = mongoose;

// ── Snapshot ultimo errore ────────────────────────────────────────────────────

const lastErrorSchema = new Schema(
  {
    code:       { type: String, default: null },
    message:    { type: String, default: null },
    provider:   { type: String, default: null },
    scope:      { type: String, default: null },
    // Payload grezzo dell'errore provider: mantenuto solo per debug a livello service.
    // Mai inoltrato al frontend.
    rawDetails: { type: Schema.Types.Mixed, default: null },
    at:         { type: Date, default: null },
  },
  { _id: false }
);

// ── Info account connesso (display, non sensibili) ────────────────────────────
// Dati pubblici del provider usati solo per la UI: nome account, business, dominio.
// Non contengono token né dati cifrati.

const accountInfoSchema = new Schema(
  {
    displayName:     { type: String, default: null },
    businessName:    { type: String, default: null },  // Meta: portfolio business
    businessId:      { type: String, default: null },  // Meta: portfolio business ID
    parentManagerId: { type: String, default: null },  // Google Ads: MCC parent
    domain:          { type: String, default: null },  // Shopify: custom domain
    myshopifyDomain: { type: String, default: null },  // Shopify: *.myshopify.com
    email:           { type: String, default: null },  // Shopify: store email
    currency:        { type: String, default: null },
    timezone:        { type: String, default: null },
  },
  { _id: false }
);

// ── Credenziali OAuth ─────────────────────────────────────────────────────────
// I token sono salvati qui così come sono. Cifratura/decifratura sono gestite a livello
// service (services/integrations, services/shopify, ecc.) prima del salvataggio
// e dopo la lettura. Il modello è intenzionalmente ignaro della cifratura.

const credentialsSchema = new Schema(
  {
    accessToken:    { type: String, default: null },
    refreshToken:   { type: String, default: null },
    tokenExpiresAt: { type: Date, default: null },
  },
  { _id: false }
);

// ── Integrazione ──────────────────────────────────────────────────────────────

const integrationSchema = new Schema(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['shopify', 'meta_ads', 'google_ads'],
    },
    status: {
      type: String,
      required: true,
      enum: [
        'not_connected',
        'incomplete',
        'needs_account_selection',
        'connected',
        'expired',
        'needs_reauth',
        'error',
        'disconnected',
      ],
      default: 'not_connected',
    },
    // Identificatore esterno specifico del provider (es. dominio shop Shopify,
    // ID account Meta). Trattato come sensibile: nessuna cifratura a livello model.
    externalRef: {
      type: String,
      default: null,
      trim: true,
    },
    managerCustomerId: {
      type: String,
      default: null,
      trim: true,
    },
    credentials: {
      type: credentialsSchema,
      default: () => ({}),
    },
    lastError: {
      type: lastErrorSchema,
      default: null,
    },
    connectedAt: {
      type: Date,
      default: null,
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    accountInfo: {
      type: accountInfoSchema,
      default: null,
    },
  },
  { timestamps: true }
);

// Ogni client può avere al massimo una integrazione per provider.
integrationSchema.index({ clientId: 1, provider: 1 }, { unique: true });

export default mongoose.model('Integration', integrationSchema);
