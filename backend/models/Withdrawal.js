const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
  providerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amountSCT:     { type: Number, required: true },
  walletAddress: { type: String, required: true },
  txHash:        { type: String, default: '' },
  status:        { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  note:          { type: String, default: '' },
  createdAt:     { type: Date, default: Date.now },
  processedAt:   { type: Date },
});

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);
