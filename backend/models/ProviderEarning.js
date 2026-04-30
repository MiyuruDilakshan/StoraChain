const mongoose = require('mongoose');

const ProviderEarningSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      // Amount in SCT tokens
    },
    type: {
      type: String,
      enum: ['registration_bonus', 'online_bonus', 'storage_reward', 'bandwidth_reward', 'uptime_reward'],
      default: 'storage_reward',
    },
    description: String,
    transactionHash: String,
    // Reference to file/transaction if applicable
    fileId: mongoose.Schema.Types.ObjectId,
    chunkHash: String,
    downloadId: String,

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProviderEarning', ProviderEarningSchema);
