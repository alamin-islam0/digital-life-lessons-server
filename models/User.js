const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String },
    photoURL: { type: String },
    isPremium: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    totalLessons: { type: Number, default: 0 },
    totalFavorites: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
