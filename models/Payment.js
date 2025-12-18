const mongoose = require('mongoose');
const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    firebaseUid: { type: String, required: true },
    email: { type: String, required: true },
    stripeSessionId: { type: String, required: true },
    stripePaymentIntentId: { type: String },
    amount: { type: Number, required: true }, // Amount in cents
    currency: { type: String, default: 'bdt' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentMethod: { type: String },
    customerName: { type: String },
    paymentDate: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);


paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ firebaseUid: 1 });
paymentSchema.index({ stripeSessionId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
