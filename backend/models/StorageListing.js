const mongoose = require('mongoose');

const StorageListingSchema = new mongoose.Schema({
  providerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walletAddress:    { type: String, default: '' },
  agentUrl:         { type: String, required: true },
  capacityGB:       { type: Number, required: true },
  usedGB:           { type: Number, default: 0 },
  pricePerGB:       { type: Number, default: 1 },
  systemPricePerGB: { type: Number, default: 1 },
  region:           { type: String, default: 'local' },
  isActive:         { type: Boolean, default: true },
  isPaused:         { type: Boolean, default: false },
  uptimePct:        { type: Number, default: 100 },
  latencyMs:        { type: Number, default: 20 },
  reputationScore:  { type: Number, default: 100, min: 0, max: 100 },
  totalEarnings:    { type: Number, default: 0 },
  lastRewardedAt:   { type: Date },

  // ── Hardware snapshot ──────────────────────────────────────────
  hardware: {
    os: String,
    cpu: String,
    cores: Number,
    ramFreeGB: Number,
    ramTotalGB: Number,
    diskPath: String,
    diskFreeGB: Number,
    diskTotalGB: Number,
    ip: String,
  },

  // ── Integrity & Anti-Cheat tracking ───────────────────────────
  lastIntegrityCheck: { type: Date },
  integrityHealthy:   { type: Boolean, default: true },
  integrityViolations: [{
    type:      String,   // RESERVATION_MISSING, RESERVATION_SHRUNK, CHUNK_TAMPERED, CHUNK_MISSING
    detail:    String,
    detectedAt: { type: Date, default: Date.now },
  }],
  totalViolations:    { type: Number, default: 0 },

  // ── Penalty tracking ──────────────────────────────────────────
  isSuspended:        { type: Boolean, default: false },
  suspendedAt:        { type: Date },
  suspensionReason:   { type: String },
  penaltyPoints:      { type: Number, default: 0 },   // accumulates; threshold triggers suspension
  penaltyHistory: [{
    reason:    String,
    points:    Number,
    appliedAt: { type: Date, default: Date.now },
  }],

  // ── Heartbeat tracking ────────────────────────────────────────
  lastHeartbeatAt:  { type: Date },
  consecutiveMisses: { type: Number, default: 0 },   // consecutive missed heartbeats

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StorageListing', StorageListingSchema);
