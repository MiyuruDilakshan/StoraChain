'use strict';
const express = require('express');

/**
 * Create the Express HTTP server for the provider agent.
 *
 * @param {import('./storage')} storageManager
 * @param {string} agentKey  - shared secret that backend must send in x-agent-key header
 * @returns {express.Application}
 */
module.exports = function createAgentServer(storageManager, agentKey) {
  const app = express();

  // Accept raw binary bodies (for chunk uploads) and JSON
  app.use(express.raw({ limit: '100mb', type: 'application/octet-stream' }));
  app.use(express.json());

  // ── Auth middleware ────────────────────────────────────────────
  function verifyAgentKey(req, res, next) {
    const provided = req.headers['x-agent-key'];
    if (!agentKey || provided !== agentKey) {
      return res.status(401).json({ message: 'Unauthorized: invalid agent key' });
    }
    next();
  }

  // ── Routes ────────────────────────────────────────────────────

  /**
   * POST /chunk
   * Backend sends a binary chunk to store on this node.
   * Required headers:
   *   x-agent-key: <shared secret>
   *   x-chunk-id:  <uuid>
   *   Content-Type: application/octet-stream
   */
  app.post('/chunk', verifyAgentKey, (req, res) => {
    const chunkId = req.headers['x-chunk-id'];
    if (!chunkId) {
      return res.status(400).json({ message: 'Missing x-chunk-id header' });
    }

    // Check available space
    const chunkSize = req.body ? req.body.length : 0;
    if (chunkSize > storageManager.getAvailableSpaceBytes()) {
      return res.status(507).json({ message: 'Insufficient storage' });
    }

    try {
      storageManager.saveChunk(chunkId, req.body);
      console.log(`[Agent] Stored chunk: ${chunkId} (${chunkSize} bytes)`);
      res.status(201).json({ success: true, chunkId, size: chunkSize });
    } catch (err) {
      console.error('[Agent] Error storing chunk:', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /chunk/:chunkId
   * Backend retrieves a stored chunk (for reassembly on download).
   */
  app.get('/chunk/:chunkId', verifyAgentKey, (req, res) => {
    try {
      const data = storageManager.getChunk(req.params.chunkId);
      res.set('Content-Type', 'application/octet-stream');
      res.set('Content-Length', data.length);
      res.send(data);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  });

  /**
   * DELETE /chunk/:chunkId
   * Backend requests deletion of a specific chunk.
   */
  app.delete('/chunk/:chunkId', verifyAgentKey, (req, res) => {
    try {
      storageManager.deleteChunk(req.params.chunkId);
      res.json({ success: true, chunkId: req.params.chunkId });
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  });

  /**
   * GET /health
   * Public endpoint — backend polls this to verify node is online.
   * Also used by the heartbeat for uptime calculation.
   */
  app.get('/health', (req, res) => {
    const used      = storageManager.getUsedSpaceBytes();
    const reserved  = storageManager.getReservedSpaceBytes();
    const allocated = storageManager.getAllocatedFootprintBytes();
    const max       = storageManager.maxCapacityBytes;
    const available = storageManager.getAvailableSpaceBytes();
    res.json({
      status:       'online',
      usedBytes:    used,
      reservedBytes: reserved,
      allocatedBytes: allocated,
      availableBytes: available,
      maxBytes:     max,
      usedGB:       parseFloat((used / (1024 ** 3)).toFixed(4)),
      reservedGB:   parseFloat((reserved / (1024 ** 3)).toFixed(4)),
      allocatedGB:  parseFloat((allocated / (1024 ** 3)).toFixed(4)),
      availableGB:  parseFloat((available / (1024 ** 3)).toFixed(4)),
      maxGB:        parseFloat((max / (1024 ** 3)).toFixed(2)),
      chunkCount:   storageManager.listChunks().length,
      timestamp:    new Date().toISOString(),
    });
  });

  app.post('/uninstall', verifyAgentKey, (req, res) => {
    try {
      const deletedChunks = storageManager.listChunks().length;
      storageManager.wipeAllChunks();
      storageManager.releaseReservation();
      res.json({ success: true, deletedChunks, releasedBytes: storageManager.maxCapacityBytes });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * GET /chunks
   * List all chunk IDs stored on this node (protected).
   */
  app.get('/chunks', verifyAgentKey, (req, res) => {
    res.json({ chunks: storageManager.listChunks() });
  });

  return app;
};
