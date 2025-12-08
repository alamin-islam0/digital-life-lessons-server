const mongoose = require('mongoose');
const { Schema } = mongoose;

const favoriteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
  },
  { timestamps: true }
);
favoriteSchema.index({ user: 1, lesson: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
