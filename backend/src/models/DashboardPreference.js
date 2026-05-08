import mongoose from 'mongoose';

const { Schema } = mongoose;

const dashboardPreferenceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // un documento preferenze per utente
    },
    lastSelectedClientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('DashboardPreference', dashboardPreferenceSchema);
