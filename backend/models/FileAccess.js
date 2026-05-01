const mongoose = require('mongoose');

const FileAccessSchema = new mongoose.Schema({
  buyerUserId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',               required: true },
  sellerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',               required: true },
  fileRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'FileRecord',         required: false, default: null },
  listingId:    { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceListing', default: null  },
  grantedAt:    { type: Date,    default: Date.now },
  txHash:       { type: String,  default: '' },
  accessType:   { type: String,  enum: ['purchase', 'share', 'free'], required: true },
  isActive:     { type: Boolean, default: true },
});

// Index for fast lookup during download access checks
FileAccessSchema.index({ buyerUserId: 1, fileRecordId: 1 });

module.exports = mongoose.model('FileAccess', FileAccessSchema);
