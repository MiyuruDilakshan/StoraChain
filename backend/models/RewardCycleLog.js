const mongoose = require('mongoose');

const rewardResultSchema = new mongoose.Schema({
  providerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  walletAddress:  { type: String, default: '' },
  storageHoursGB: { type: Number, default: 0 },
  uptimePct:      { type: Number, default: 0 },
  rewardSCT:      { type: Number, default: 0 },
  txHash:         { type: String, default: '' },
  status:         { type: String, enum: ['success', 'failed'], default: 'success' },
  error:          { type: String, default: '' },
}, { _id: false });

const rewardCycleLogSchema = new mongoose.Schema({
  runAt:              { type: Date, default: Date.now },
  providersProcessed: { type: Number, default: 0 },
  totalSCTMinted:     { type: Number, default: 0 },
  results:            [rewardResultSchema],
  status:             { type: String, enum: ['completed', 'partial', 'failed'], default: 'completed' },
});

module.exports = mongoose.model('RewardCycleLog', rewardCycleLogSchema);
