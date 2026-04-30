/**
 * cloudBackupService.js — AWS S3 cloud disaster-recovery backup
 *
 * Env vars required (add to backend/.env):
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_REGION
 *
 * All functions catch errors internally and return null on failure — S3
 * problems must never propagate into the calling upload route.
 */

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

const BUCKET = process.env.AWS_S3_BUCKET  || '';
const REGION = process.env.AWS_REGION     || 'us-east-1';

function _client() {
  return new S3Client({
    region: REGION,
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
}

/**
 * Upload a buffer to S3.
 *
 * Signature used by storageRoutes.js:  upload(buffer, fileName)
 * Signature specified in plan:          uploadToCloud(buffer, originalName, fileId)
 * Both are exported as aliases to the same function.
 *
 * Object key: files/<fileId>/<sanitisedName>  (when fileId provided)
 *             files/<sanitisedName>           (legacy 2-arg call)
 *
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} [fileId]
 * @returns {Promise<string|null>} S3 object key, or null on failure
 */
async function upload(buffer, originalName, fileId) {
  if (!BUCKET) {
    console.warn('[CloudBackup] AWS_S3_BUCKET not set — skipping S3 upload');
    return null;
  }
  try {
    // Sanitise the file name: strip path traversal characters
    const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._\-]/g, '_');
    const key = fileId ? `files/${fileId}/${safeName}` : `files/${safeName}`;

    await _client().send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: 'application/octet-stream',
    }));

    console.log(`[CloudBackup] Uploaded to S3: ${key}`);
    return key;
  } catch (err) {
    console.error('[CloudBackup] S3 upload failed:', err.message);
    return null;
  }
}

/** Alias so callers using the plan's function name also work. */
const uploadToCloud = upload;

/**
 * Download a file from S3 by its object key.
 *
 * @param {string} objectKey
 * @returns {Promise<Buffer|null>} file buffer, or null on failure
 */
async function download(objectKey) {
  if (!BUCKET) return null;
  try {
    const response = await _client().send(new GetObjectCommand({
      Bucket: BUCKET,
      Key:    objectKey,
    }));

    // Stream body to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (err) {
    console.error('[CloudBackup] S3 download failed:', err.message);
    return null;
  }
}

module.exports = { upload, uploadToCloud, download };
