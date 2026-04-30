const mongoose = require('mongoose');

const ReplicationLogSchema = new mongoose.Schema({
  fileId:   { type: mongoose.Schema.Types.ObjectId, ref: 'FileRecord', required: true },
  chunkId:  { type: String, required: true },
  fromUrl:  { type: String, default: '' },  // source provider agent URL
  toUrl:    { type: String, default: '' },  // destination provider agent URL
  status:   { type: String, enum: ['success', 'failed', 'skipped'], default: 'success' },
  reason:   { type: String, default: '' },  // error message on failure
  createdAt:{ type: Date, default: Date.now },
});

module.exports = mongoose.model('ReplicationLog', ReplicationLogSchema);
