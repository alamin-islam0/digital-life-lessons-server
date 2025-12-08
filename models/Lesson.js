const mongoose = require('mongoose');
const { Schema } = mongoose;

const lessonSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true }, // Personal Growth, Career, etc.
    emotionalTone: { type: String, required: true }, // Motivational, Sad, etc.
    image: { type: String }, // URL or base64
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    accessLevel: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    creatorName: String,
    creatorPhoto: String,
    creatorEmail: String,
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    likesCount: { type: Number, default: 0 },
    favoritesCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lesson', lessonSchema);
