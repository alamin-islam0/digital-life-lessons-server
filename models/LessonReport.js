const mongoose = require('mongoose');
const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      required: true,
    },
    message: { type: String },
  },
  { timestamps: true, collection: 'lessonReports' }
);

module.exports = mongoose.model('LessonReport', reportSchema);
