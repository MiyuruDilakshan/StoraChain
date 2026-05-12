'use strict';
const mongoose = require('mongoose');

/**
 * PendingChunk — stores a chunk that the backend couldn't push to a provider agent
 * (e.g. home PC behind NAT). The agent polls GET /api/providers/chunk-queue and
 * pulls these chunks directly, bypassing NAT.
 *
 * TTL: 24 hours — unclaimed chunks are auto-deleted by MongoDB.
 */
const PendingChunkSchema = new mongoose.Schema({
  chunkId:    { type: String, required: true, index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  data:       { type: Buffer, required: true },
  createdAt:  { type: Date, default: Date.now, expires: 86400 }, // auto-delete after 24h
});

module.exports = mongoose.model('PendingChunk', PendingChunkSchema);
