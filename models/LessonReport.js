const mongoose = require('mongoose');
const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      enum: [
        'Inappropriate Content',
        'Hate Speech or Harassment',
        'Misleading or False Information',
        'Spam or Promotional Content',
        'Sensitive or Disturbing Content',
        'Other',
      ],
      required: true,
    },
    message: { type: String },
  },
  { timestamps: true, collection: 'lessonReports' }
);

module.exports = mongoose.model('LessonReport', reportSchema);
