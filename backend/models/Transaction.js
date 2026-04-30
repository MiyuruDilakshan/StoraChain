const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  type:                  { type: String, enum: ['purchase', 'reward', 'withdrawal'], default: 'purchase' },
  buyerId:               { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sellerId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  providerId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  listingId:             { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceListing', default: null },
  providerWallet:        { type: String,  default: '' },
  paymentMethod:         { type: String, enum: ['token', 'stripe', 'demo_usd', 'demo_sct', 'reward', 'withdrawal'], default: 'token' },
  amountSCT:             { type: Number, default: 0 },
  amountUSDCents:        { type: Number, default: 0 },
  stripePaymentIntentId: { type: String, default: '' },
  txHash:                { type: String, default: '' },
  status:                { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  downloadGranted:       { type: Boolean, default: false },
  billingPeriod:         { type: String,  default: '' },   // ISO date string for reward cycles
  createdAt:             { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', TransactionSchema);
