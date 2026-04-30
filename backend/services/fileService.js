const crypto = require('crypto');

/**
 * Split a buffer into `numShards` roughly-equal chunks.
 * Returns [{ chunkId, buffer }]
 */
function shardBuffer(buffer, numShards = 2) {
  const chunkSize = Math.ceil(buffer.length / numShards);
  const chunks = [];
  for (let i = 0; i < numShards; i++) {
    const slice = buffer.slice(i * chunkSize, (i + 1) * chunkSize);
    const chunkId = crypto.randomBytes(16).toString('hex');
    chunks.push({ chunkId, buffer: slice });
  }
  return chunks;
}

/**
 * Concatenate an array of buffers in order.
 */
function reassembleChunks(buffers) {
  return Buffer.concat(buffers);
}

module.exports = { shardBuffer, reassembleChunks };
