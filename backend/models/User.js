const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  email:          { type: String, required: true, unique: true },
  password:       { type: String, required: true },
  role:           { type: String, enum: ["provider", "seeker", "admin"], default: "seeker" },

  // Profile extras
  bio:            { type: String, default: "" },
  walletAddress:  { type: String, default: "" },
  avatarColor:    { type: String, default: "#bf5af2" },

  // Subscription plan (seekers)
  plan:           { type: String, enum: ["free", "basic", "pro", "premium"], default: "free" },
  planExpiresAt:  { type: Date, default: null },
  storageQuotaGB: { type: Number, default: 2 },
  usedStorageGB:  { type: Number, default: 0 },

  // Seeker wallet — demo balances for testing
  demoUSD:        { type: Number, default: 50 },   // $50 demo credit on free plan
  sctBalance:     { type: Number, default: 100 },   // 100 SCT demo tokens on free plan

  // Account status (admin-controlled)
  status:         { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },

  // Provider settings
  totalStorageGB: { type: Number, default: 0 },
  pricePerGB:     { type: Number, default: 1 },

  createdAt:      { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
