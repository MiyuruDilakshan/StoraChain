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

  /**
   * GET /disk-info
   * Public endpoint — returns available disks and free space on this machine.
   * Used by the provider dashboard to show disk selection UI.
   */
  app.get('/disk-info', (req, res) => {
    const { execSync } = require('child_process');
    const os = require('os');
    const platform = os.platform();
    try {
      let disks = [];
      if (platform === 'win32') {
        const out = execSync('wmic logicaldisk get Caption,FreeSpace,Size /format:csv', { encoding: 'utf8', timeout: 8000 });
        const lines = out.trim().split('\n').filter(l => l.trim() && !l.startsWith('Node'));
        for (const line of lines) {
          const parts = line.trim().split(',');
          if (parts.length >= 4) {
            const caption = parts[1]?.trim();
            const freeBytes = parseInt(parts[2]);
            const totalBytes = parseInt(parts[3]);
            if (caption && !isNaN(freeBytes) && !isNaN(totalBytes) && totalBytes > 0) {
              disks.push({
                name: caption,
                mountpoint: caption + '\\',
                totalGB: parseFloat((totalBytes / 1073741824).toFixed(2)),
                freeGB:  parseFloat((freeBytes  / 1073741824).toFixed(2)),
              });
            }
          }
        }
      } else {
        // Linux / macOS
        const out = execSync("df -B1 --output=target,avail,size | tail -n +2", { encoding: 'utf8', timeout: 8000 });
        for (const line of out.trim().split('\n')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3) {
            const mp = parts[0], freeB = parseInt(parts[1]), totB = parseInt(parts[2]);
            if (!isNaN(freeB) && !isNaN(totB) && totB > 0 && (mp === '/' || /^\/mnt|\/media|\/data|\/home/.test(mp))) {
              disks.push({ name: mp, mountpoint: mp, totalGB: parseFloat((totB/1073741824).toFixed(2)), freeGB: parseFloat((freeB/1073741824).toFixed(2)) });
            }
          }
        }
      }
      res.json({ disks, platform });
    } catch (err) {
      res.status(500).json({ message: 'Failed to read disk info: ' + err.message });
    }
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
