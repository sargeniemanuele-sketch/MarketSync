import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    nickname: {
      type: String,
      default: null,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    // Null quando l'utente si è registrato solo tramite Google OAuth.
    // La cifratura è gestita a livello service prima del salvataggio.
    passwordHash: {
      type: String,
      default: null,
    },
    // Null quando l'utente si è registrato solo tramite email/password.
    googleId: {
      type: String,
      default: null,
    },
    avatarUrl: {
      type: String,
      default: null,
      trim: true,
    },
    // Cloudinary public_id dell'avatar caricato dall'utente. Null per avatar Google o assente.
    avatarPublicId: {
      type: String,
      default: null,
    },
    // 'upload' = caricato dall'utente su Cloudinary; 'google' = foto Google OAuth; null = nessun avatar.
    avatarSource: {
      type: String,
      enum: ['upload', 'google', null],
      default: null,
    },
    bio: {
      type: String,
      default: null,
      trim: true,
    },
    role: {
      type: String,
      enum: ['marketer'],
      default: 'marketer',
    },
    loginProvider: {
      type: String,
      enum: ['local', 'google', 'mixed'],
      default: 'local',
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    // Hash SHA-256 del refresh token attivo.
    // Null quando non esiste una sessione attiva (dopo logout o prima del primo login).
    // Mai restituito al frontend: escluso in tutte le chiamate formatUser.
    refreshTokenHash: {
      type: String,
      default: null,
    },
    // Scadenza lato server del refresh token attivo.
    // Verificata a ogni chiamata /refresh: permette la revoca anche se il cookie persiste.
    refreshTokenExpiresAt: {
      type: Date,
      default: null,
    },
    // Hash SHA-256 del token di reset password monouso.
    // Mai salvato in chiaro. Null se non è in corso un reset.
    passwordResetTokenHash: {
      type: String,
      default: null,
    },
    // Scadenza del token di reset password (TTL 60 minuti).
    passwordResetExpiresAt: {
      type: Date,
      default: null,
    },
    // Timestamp dell'ultimo cambio password tramite flusso reset.
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Sparse per consentire più valori googleId null senza conflitti unique.
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
// Sparse: lookup O(1) durante il reset password, null non occupa spazio nell'indice.
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });
// Sparse: lookup O(1) al refresh token validation, null non occupa spazio nell'indice.
userSchema.index({ refreshTokenHash: 1 }, { sparse: true });

export default mongoose.model('User', userSchema);
