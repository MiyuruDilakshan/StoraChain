/**
 * encryptionService.js — AES-256-GCM file encryption / decryption
 *
 * File encryption key:   random 32 bytes per file
 * Key wrapping:          AES-256-ECB with ENCRYPTION_MASTER_KEY from .env
 * IV (nonce):            random 12 bytes per file (NIST recommended for GCM)
 * Auth tag:              16 bytes appended to ciphertext  →  stored as [ciphertext | authTag]
 *
 * .env requirement:
 *   ENCRYPTION_MASTER_KEY=<64 hex chars>   # openssl rand -hex 32
 *   If missing, a random key is generated at startup — restart will break decryption!
 */

const crypto = require('crypto');

// Validate / load master key
let MASTER_KEY;
if (process.env.ENCRYPTION_MASTER_KEY && process.env.ENCRYPTION_MASTER_KEY.length === 64) {
  MASTER_KEY = Buffer.from(process.env.ENCRYPTION_MASTER_KEY, 'hex');
} else {
  // Fallback: generate ephemeral key — only safe for dev; add a persistent key to .env for prod
  MASTER_KEY = crypto.randomBytes(32);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_MASTER_KEY must be set (64 hex chars) in production');
  }
  console.warn('[encryptionService] WARNING: ENCRYPTION_MASTER_KEY not set — using ephemeral key. Files encrypted in this session cannot be decrypted after restart. Add ENCRYPTION_MASTER_KEY to .env');
}

/**
 * Encrypt a plaintext Buffer with a per-file AES-256-GCM key.
 *
 * @param {Buffer} plaintextBuffer
 * @returns {{ encryptedBuffer: Buffer, encryptedKey: string, iv: string }}
 *   encryptedBuffer = ciphertext + 16-byte authTag
 *   encryptedKey    = base64-encoded AES file key wrapped with MASTER_KEY (AES-256-ECB)
 *   iv              = base64-encoded 12-byte GCM nonce
 */
function encrypt(plaintextBuffer) {
  // 1. Generate per-file encryption key and nonce
  const fileKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12); // 96-bit nonce for AES-GCM

  // 2. Encrypt plaintext
  const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag(); // always 16 bytes

  // 3. Wrap the file key with the master key (AES-256-ECB — 32-byte block input → 32-byte output)
  const wrapCipher = crypto.createCipheriv('aes-256-ecb', MASTER_KEY, null);
  const encryptedKey = Buffer.concat([wrapCipher.update(fileKey), wrapCipher.final()]);

  return {
    encryptedBuffer: Buffer.concat([ciphertext, authTag]), // authTag at the end
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypt an encrypted Buffer.
 *
 * @param {Buffer} encryptedBuffer  ciphertext + 16-byte authTag
 * @param {string} encryptedKeyB64  base64-encoded wrapped file key
 * @param {string} ivB64            base64-encoded 12-byte IV
 * @returns {Buffer} original plaintext
 */
function decrypt(encryptedBuffer, encryptedKeyB64, ivB64) {
  // 1. Unwrap file key
  const encryptedKey = Buffer.from(encryptedKeyB64, 'base64');
  const unwrapCipher = crypto.createDecipheriv('aes-256-ecb', MASTER_KEY, null);
  const fileKey = Buffer.concat([unwrapCipher.update(encryptedKey), unwrapCipher.final()]);

  // 2. Split ciphertext and authTag (last 16 bytes)
  const authTag = encryptedBuffer.slice(-16);
  const ciphertext = encryptedBuffer.slice(0, -16);
  const iv = Buffer.from(ivB64, 'base64');

  // 3. Decrypt
  const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = { encrypt, decrypt };
