const mongoose = require('mongoose');

const StorageListingSchema = new mongoose.Schema({
  providerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walletAddress:   { type: String, required: true },
  agentUrl:        { type: String, required: true },  // e.g. http://localhost:3001
  capacityGB:      { type: Number, required: true },
  usedGB:          { type: Number, default: 0 },
  pricePerGB:      { type: Number, default: 1 },       // ignored by system — providers cannot set their own price
  systemPricePerGB:{ type: Number, default: 1 },      // AI-determined effective price (authoritative)
  region:          { type: String, default: 'local' },
  isActive:        { type: Boolean, default: true },
  uptimePct:       { type: Number, default: 100 },
  latencyMs:       { type: Number, default: 20 },
  reputationScore: { type: Number, default: 100 },    // 0-100, used in AI scoring formula
  totalEarnings:   { type: Number, default: 0 },      // accumulated SCT (April 30)
  lastRewardedAt:  { type: Date },                    // last reward timestamp (April 30)
  hardware: {
    os: String,
    cpu: String,
    cores: Number,
    ramFreeGB: Number,
    ramTotalGB: Number,
    diskPath: String,
    ip: String,
  },
  createdAt:       { type: Date, default: Date.now },
});

module.exports = mongoose.model('StorageListing', StorageListingSchema);
