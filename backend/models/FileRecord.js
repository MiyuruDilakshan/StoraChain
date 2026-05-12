const mongoose = require('mongoose');

const ChunkSchema = new mongoose.Schema({
  chunkIndex:        Number,
  chunkId:           String,   // unique ID for the chunk
  providerUrl:       String,   // primary agent URL
  replicaProviderUrl: String,  // replica agent URL
  providerWalletAddress: { type: String, default: '' },
  replicaWalletAddress: { type: String, default: '' },
  providerRegion: { type: String, default: '' },
  replicaRegion: { type: String, default: '' },
  providerScore: { type: Number, default: 0 },
  replicaScore: { type: Number, default: 0 },
  size:              Number,   // bytes
  ipfsCid:           { type: String, default: '' }, // per-chunk IPFS CID (Tier-3a recovery)
});

const ProcessingSchema = new mongoose.Schema({
  status:      { type: String, default: 'queued' },
  stage:       { type: String, default: 'queued' },
  progressPct: { type: Number, default: 0 },
  detail:      { type: String, default: '' },
  error:       { type: String, default: '' },
  updatedAt:   { type: Date, default: Date.now },
}, { _id: false });

const MatchCandidateSchema = new mongoose.Schema({
  agentUrl:       { type: String, default: '' },
  walletAddress:  { type: String, default: '' },
  region:         { type: String, default: '' },
  systemPricePerGB: { type: Number, default: 0 },
  score:          { type: Number, default: 0 },
  selectedRole:   { type: String, default: '' },
  source:         { type: String, default: '' },
}, { _id: false });

const FileRecordSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walletAddress:    { type: String, default: '' },
  fileName:         { type: String, required: true },
  fileSize:         { type: Number, required: true },   // bytes (original plaintext)
  mimeType:         { type: String, default: 'application/octet-stream' },
  // Encryption
  isEncrypted:      { type: Boolean, default: false },
  encryptedKey:     { type: String, default: '' },     // AES key wrapped with master key (base64)
  iv:               { type: String, default: '' },     // AES-GCM IV (base64)
  // Integrity
  sha256Hash:       { type: String, default: '' },     // SHA-256 of original plaintext
  // Backup tiers
  ipfsCid:          { type: String, default: '' },     // IPFS CID of encrypted file (set async)
  cloudBackupPath:  { type: String, default: '' },     // S3 object key (set async, April 30)
  // On-chain
  onChainTxHash:    { type: String, default: '' },     // transaction hash when stored on-chain
  txHash:           { type: String, default: '' },     // legacy alias kept for compatibility
  // ── Preview tier (generated from plaintext BEFORE encryption) ─────────────
  // previewType:      'image-thumb' | 'pdf-text' | 'text' | null
  // thumbnailDataUrl: base64 JPEG data URL (images only) — returned in file detail
  // previewText:      first 600 chars (PDF / text / code files)
  // previewCid:       Pinata CID of the thumbnail (pinned async for CDN access)
  previewType:      { type: String,  default: null },
  thumbnailDataUrl: { type: String,  default: null },
  previewText:      { type: String,  default: null },
  previewCid:       { type: String,  default: null },
  processing:       { type: ProcessingSchema, default: () => ({}) },
  matchmaking: {
    source:        { type: String, default: 'local' },
    summary:       { type: String, default: '' },
    candidates:    { type: [MatchCandidateSchema], default: [] },
    selectedCount: { type: Number, default: 0 },
  },
  // Chunks
  chunks:           [ChunkSchema],
  isDeleted:        { type: Boolean, default: false },
  createdAt:        { type: Date, default: Date.now },

  // ── Sharing & monetisation ────────────────────────────────────────────────
  shareToken:          { type: String, unique: true, sparse: true },
  visibility:          { type: String, enum: ['private', 'public', 'shared'], default: 'private' },
  isLocked:            { type: Boolean, default: false },
  priceUSD:            { type: Number,  default: 0 },
  priceSCT:            { type: Number,  default: 0 },
  purchasedBy:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  downloadCount:       { type: Number,  default: 0 },
  marketplaceTitle:    { type: String,  default: '' },
  marketplaceDesc:     { type: String,  default: '' },
  marketplaceCategory: { type: String,  default: '' },
  totalRevenueSCT:     { type: Number,  default: 0 },
  totalRevenueUSD:     { type: Number,  default: 0 },
});

FileRecordSchema.pre('save', function () {
  if (!this.shareToken) {
    this.shareToken = require('crypto').randomBytes(16).toString('hex');
  }
});

module.exports = mongoose.model('FileRecord', FileRecordSchema);
