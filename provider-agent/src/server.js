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

  // Allow browser on storachain.miyuru.dev (and localhost dev) to call agent directly
  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const allowed = [
      'https://storachain.miyuru.dev',
      'https://www.storachain.miyuru.dev',
      'http://localhost:3000',
      'http://localhost:3001',
    ];
    if (allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-agent-key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

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
   * POST /update-config
   * Backend sends updated configuration. The agent updates its .env and restarts/applies it.
   */
  app.post('/update-config', verifyAgentKey, (req, res) => {
    try {
      const { capacityGB, diskPath, walletAddress } = req.body;
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env');
      
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (capacityGB !== undefined) envContent = envContent.replace(/^SPACE_GB=.*$/m, `SPACE_GB=${capacityGB}`);
        if (diskPath !== undefined) envContent = envContent.replace(/^STORAGE_DIR=.*$/m, `STORAGE_DIR=${diskPath.replace(/\\/g, '\\\\')}`);
        if (walletAddress !== undefined) envContent = envContent.replace(/^WALLET_ADDRESS=.*$/m, `WALLET_ADDRESS=${walletAddress}`);
        fs.writeFileSync(envPath, envContent);
      }
      res.json({ success: true, message: 'Agent configuration updated.' });
    } catch (err) {
      res.status(500).json({ message: err.message });
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

      // Stop PM2 process after sending response
      setTimeout(() => {
        try {
          require('child_process').execSync('pm2 delete storachain-provider', { windowsHide: true });
        } catch(e) {}
        process.exit(0);
      }, 1000);
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

  /**
   * GET /disk-info
   * Get available disk space on the provider's machine.
   * Uses pure Node.js fs.statfsSync — zero external processes, zero CMD windows.
   */
  app.get('/disk-info', async (req, res) => {
    try {
      const fs = require('fs');
      const isWin = process.platform === 'win32';
      let disks = [];
      if (isWin) {
        // Probe common drive letters using native fs.statfsSync — no wmic, no CMD flash
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (const letter of letters) {
          const root = `${letter}:\\`;
          try {
            if (!fs.existsSync(root)) continue;
            const stats = fs.statfsSync(root);
            const totalBytes = stats.blocks * stats.bsize;
            const freeBytes  = stats.bfree  * stats.bsize;
            if (totalBytes > 0) {
              disks.push({
                name: `${letter}:`,
                mountpoint: root,
                freeGB: parseFloat((freeBytes / (1024 ** 3)).toFixed(2)),
                totalGB: parseFloat((totalBytes / (1024 ** 3)).toFixed(2)),
              });
            }
          } catch { /* drive not ready or inaccessible */ }
        }
      } else {
        // Linux/macOS: read /proc/mounts or use df as fallback
        try {
          const mounts = fs.readFileSync('/proc/mounts', 'utf8').split('\n')
            .filter(l => l.startsWith('/dev/'))
            .map(l => l.split(/\s+/));
          for (const [, mountpoint] of mounts) {
            try {
              const stats = fs.statfsSync(mountpoint);
              const totalBytes = stats.blocks * stats.bsize;
              const freeBytes  = stats.bfree  * stats.bsize;
              if (totalBytes > 0) {
                disks.push({
                  name: mountpoint,
                  mountpoint,
                  totalGB: parseFloat((totalBytes / (1024 ** 3)).toFixed(2)),
                  freeGB: parseFloat((freeBytes / (1024 ** 3)).toFixed(2)),
                });
              }
            } catch { /* skip */ }
          }
        } catch {
          // Fallback: just report root
          try {
            const stats = fs.statfsSync('/');
            disks.push({
              name: '/',
              mountpoint: '/',
              totalGB: parseFloat((stats.blocks * stats.bsize / (1024 ** 3)).toFixed(2)),
              freeGB: parseFloat((stats.bfree * stats.bsize / (1024 ** 3)).toFixed(2)),
            });
          } catch { /* ignore */ }
        }
      }
      res.json({ disks });
    } catch (err) {
      res.status(500).json({ message: 'Failed to read disks', error: err.message });
    }
  });

  return app;
};
