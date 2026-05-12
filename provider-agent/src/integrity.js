'use strict';
/**
 * StoraChain Provider Integrity Monitor
 *
 * Responsibilities:
 *  1. Verify the physical reservation file has not been deleted / shrunk.
 *  2. Sample-check stored chunks for bit-rot / tampering via stored CRC32.
 *  3. Track continuous disk-free / disk-total for the allocated partition.
 *  4. Produce an IntegrityReport for inclusion in every heartbeat.
 *
 * Penalties are NOT applied here — the backend decides based on the report.
 */

const fs        = require('fs');
const path      = require('path');

const IS_WINDOWS = process.platform === 'win32';

// ── tiny CRC32 (no external dep) ─────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}

// ── Disk free space (cross-platform, pure Node.js — NO external processes) ────
function getDiskStats(targetPath) {
  try {
    // fs.statfsSync is available in Node 18.15+ — pure native call, zero CMD windows
    const stats = fs.statfsSync(path.resolve(targetPath));
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes  = stats.bfree  * stats.bsize;
    return { freeBytes, totalBytes };
  } catch {
    return { freeBytes: 0, totalBytes: 0 };
  }
}

class IntegrityMonitor {
  /**
   * @param {import('./storage')} storageManager
   */
  constructor(storageManager) {
    this.sm = storageManager;
    // In-memory checksum cache keyed by chunkId
    this._checksumCache = {};
    // Flag set when a violation is first detected
    this._violations = [];
    this._lastReport = null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Register a chunk's checksum immediately after storage.
   * Called by StorageManager.saveChunk() indirectly via agent.
   */
  recordChunk(chunkId, data) {
    this._checksumCache[chunkId] = crc32(Buffer.isBuffer(data) ? data : Buffer.from(data));
  }

  /**
   * Remove a chunk from the registry.
   */
  forgetChunk(chunkId) {
    delete this._checksumCache[chunkId];
  }

  /**
   * Load existing checksum cache from disk (so reboots retain chunk hashes).
   * Called once at agent startup.
   */
  loadCacheFromDisk() {
    const cachePath = path.join(this.sm.vaultDir, 'integrity.json');
    try {
      if (fs.existsSync(cachePath)) {
        const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        this._checksumCache = raw.checksums || {};
        console.log(`[Integrity] Loaded ${Object.keys(this._checksumCache).length} chunk checksums from cache.`);
      }
    } catch (e) {
      console.warn('[Integrity] Could not load checksum cache:', e.message);
    }
  }

  /**
   * Persist checksum cache to disk.
   */
  saveCacheToDisk() {
    const cachePath = path.join(this.sm.vaultDir, 'integrity.json');
    try {
      fs.writeFileSync(cachePath, JSON.stringify({ checksums: this._checksumCache, savedAt: new Date().toISOString() }, null, 2));
    } catch { /* non-fatal */ }
  }

  /**
   * Run a full integrity check and return a report object.
   * This is called every heartbeat interval.
   *
   * @returns {IntegrityReport}
   */
  async runCheck() {
    const violations = [];
    const startedAt = Date.now();

    // 1. Reservation file check
    const reserveOk = this._checkReservationFile(violations);

    // 2. Chunk integrity (sample up to 10 per cycle to avoid I/O spikes)
    const { passed: chunkPassed, failed: chunkFailed } = this._sampleChunkIntegrity(violations);

    // 3. Disk health
    const diskPath = this.sm.storageDir;
    const diskStats = getDiskStats(diskPath);

    // 4. Build report
    const allocatedBytes = this.sm.maxCapacityBytes;
    const usedBytes      = this.sm.getUsedSpaceBytes();
    const reservedBytes  = this.sm.getReservedSpaceBytes();
    const freeBytes      = Math.max(0, allocatedBytes - usedBytes);

    this._lastReport = {
      timestamp:        new Date().toISOString(),
      checkDurationMs:  Date.now() - startedAt,
      reservationOk:    reserveOk,
      allocatedGB:      +(allocatedBytes / (1024 ** 3)).toFixed(4),
      usedGB:           +(usedBytes / (1024 ** 3)).toFixed(4),
      reservedGB:       +(reservedBytes / (1024 ** 3)).toFixed(4),
      freeAllocatedGB:  +(freeBytes / (1024 ** 3)).toFixed(4),
      diskFreeGB:       +(diskStats.freeBytes / (1024 ** 3)).toFixed(2),
      diskTotalGB:      +(diskStats.totalBytes / (1024 ** 3)).toFixed(2),
      chunksRegistered: Object.keys(this._checksumCache).length,
      chunksPassed:     chunkPassed,
      chunksFailed:     chunkFailed,
      violations,
      healthy:          violations.length === 0,
    };

    if (violations.length > 0) {
      console.warn(`[Integrity] ⚠ ${violations.length} violation(s) detected:`, violations.map(v => v.type).join(', '));
    }

    return this._lastReport;
  }

  getLastReport() { return this._lastReport; }

  // ── Private helpers ─────────────────────────────────────────────────────────

  _checkReservationFile(violations) {
    const rFile = this.sm.reserveFile;
    const expectedBytes = this.sm.maxCapacityBytes - this.sm.getUsedSpaceBytes();

    if (expectedBytes <= 0) return true; // Nothing to reserve

    if (!fs.existsSync(rFile)) {
      violations.push({ type: 'RESERVATION_MISSING', detail: `Reserve file not found: ${rFile}` });
      // Attempt self-heal
      try { this.sm._rebalanceReserve(); console.log('[Integrity] Self-healed missing reservation file.'); }
      catch { /* could not heal */ }
      return false;
    }

    const actualBytes = fs.statSync(rFile).size;
    // Allow 5% tolerance (truncateSync can be OS-rounded)
    const tolerance = expectedBytes * 0.05;
    if (Math.abs(actualBytes - expectedBytes) > tolerance && actualBytes < expectedBytes - tolerance) {
      violations.push({
        type: 'RESERVATION_SHRUNK',
        detail: `Expected ~${(expectedBytes / 1e9).toFixed(2)} GB, found ${(actualBytes / 1e9).toFixed(2)} GB`,
      });
      // Self-heal
      try { this.sm._rebalanceReserve(); console.log('[Integrity] Self-healed shrunk reservation file.'); }
      catch { /* could not heal */ }
      return false;
    }

    return true;
  }

  _sampleChunkIntegrity(violations) {
    const chunkIds = Object.keys(this._checksumCache);
    if (chunkIds.length === 0) return { passed: 0, failed: 0 };

    // Sample up to 10 random chunks per run
    const SAMPLE_SIZE = Math.min(10, chunkIds.length);
    const sample = chunkIds.sort(() => Math.random() - 0.5).slice(0, SAMPLE_SIZE);

    let passed = 0;
    let failed = 0;

    for (const chunkId of sample) {
      try {
        let data;
        if (IS_WINDOWS && this.sm.adsHost) {
          data = fs.readFileSync(`${this.sm.adsHost}:${chunkId}`);
        } else {
          const p = path.join(this.sm.chunkDir, `${chunkId}.bin`);
          data = fs.readFileSync(p);
        }
        const actual   = crc32(data);
        const expected = this._checksumCache[chunkId];
        if (actual !== expected) {
          violations.push({ type: 'CHUNK_TAMPERED', detail: `Chunk ${chunkId}: expected CRC ${expected}, got ${actual}` });
          failed++;
        } else {
          passed++;
        }
      } catch (e) {
        violations.push({ type: 'CHUNK_MISSING', detail: `Chunk ${chunkId}: ${e.message}` });
        failed++;
      }
    }

    return { passed, failed };
  }
}

module.exports = IntegrityMonitor;
