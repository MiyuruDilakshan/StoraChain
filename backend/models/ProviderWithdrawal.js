const mongoose = require('mongoose');

const ProviderWithdrawalSchema = new mongoose.Schema(
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
    walletAddress: {
      type: String,
      required: true,
      // Ethereum wallet address where tokens are sent
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    transactionHash: String,
    error: String,

    createdAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProviderWithdrawal', ProviderWithdrawalSchema);
