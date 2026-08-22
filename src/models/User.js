import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }
});

const UserProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, default: '' },
  bio: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  tier: { type: String, default: 'free', enum: ['free', 'premium'] },
  
  // Clean, structured compatibility matrix fields
  aiAnalysis: {
    temperament: { type: String, default: 'Balanced' },
    vision: { type: String, default: 'Growth & Stability' },
    communication: { type: String, default: 'Expressive' },
    tags: [{ type: String }]
  },
  updatedAt: { type: Date, default: Date.now }
});

const OtpStore = mongoose.models.OtpStore || mongoose.model('OtpStore', OtpSchema);
const UserProfile = mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);

export { OtpStore, UserProfile };