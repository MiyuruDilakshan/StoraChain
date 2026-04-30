const mongoose = require('mongoose');

const MarketplaceListingSchema = new mongoose.Schema({
  sellerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileRecordId:   { type: mongoose.Schema.Types.ObjectId, ref: 'FileRecord', default: null },
  title:          { type: String, required: true, maxlength: 120 },
  description:    { type: String, default: '', maxlength: 1000 },
  fileName:       { type: String, required: true },
  fileSize:       { type: Number, required: true },          // bytes
  mimeType:       { type: String, default: 'application/octet-stream' },
  cid:            { type: String, required: true },          // IPFS CID
  category:       { type: String, default: 'General' },      // e.g. Documents, Media, Data, Software
  tags:           [String],
  priceSCT:       { type: Number, default: 0 },              // price in SCT tokens
  priceUSDCents:  { type: Number, default: 0 },              // price in USD cents (for Stripe)
  acceptsTokens:  { type: Boolean, default: true },
  acceptsFiat:    { type: Boolean, default: false },
  previewUrl:     { type: String, default: '' },             // optional thumbnail
  downloads:      { type: Number, default: 0 },
  views:          { type: Number, default: 0 },
  isActive:       { type: Boolean, default: true },
  singleSale:     { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
});

// Text index for search functionality
MarketplaceListingSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('MarketplaceListing', MarketplaceListingSchema);
