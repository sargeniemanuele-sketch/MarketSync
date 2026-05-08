import mongoose from 'mongoose';

const { Schema } = mongoose;

const oauthLoginCodeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'oauth_login_codes',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

oauthLoginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OAuthLoginCode', oauthLoginCodeSchema);
