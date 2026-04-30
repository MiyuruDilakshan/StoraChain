const mongoose = require('mongoose');

const AbuseReportSchema = new mongoose.Schema(
  {
    reporterUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: {
      type: String,
      enum: ['file', 'listing', 'user', 'provider', 'other'],
      required: true,
    },
    targetId: { type: String, default: '' },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    evidenceUrl: { type: String, default: '' },
    evidenceImageName: { type: String, default: '' },
    evidenceImageDataUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['open', 'reviewing', 'resolved', 'rejected'],
      default: 'open',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date, default: null },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AbuseReport', AbuseReportSchema);
