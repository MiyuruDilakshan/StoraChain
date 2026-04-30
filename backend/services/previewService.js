/**
 * previewService.js
 * Generates lightweight, unencrypted preview assets BEFORE a file is encrypted.
 *
 * Tier 1 – Image files:  resizes to 320 px thumbnail → base64 JPEG data URL (stored in DB)
 *                         thumbnail is also pinned to Pinata for public CDN access via previewCid
 * Tier 1 – PDF files:    extracts first-page text snippet via pdf-parse
 * Tier 1 – Text/code:    slices first 500 chars
 * Everything else:        returns null (no preview generated)
 *
 * Why before encryption?
 * The original plaintext buffer is available only at this point in the upload pipeline.
 * Once encrypted, generating a preview would require decryption first.
 * Previews are intentionally lightweight and non-sensitive (thumbnails, text snippets).
 */

const sharp = require('sharp');

let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('[preview] pdf-parse not available — PDF text previews disabled');
}

const THUMB_SIZE = 320;  // max dimension for thumbnail
const THUMB_Q    = 78;   // JPEG quality

/**
 * generatePreview(buffer, mimeType)
 * @param {Buffer} buffer    - raw, unencrypted file bytes
 * @param {string} mimeType  - MIME type string from multer
 * @returns {object|null}    - { thumbnailBuffer, thumbnailDataUrl, previewText, previewType }
 *                             or null if preview is not applicable
 */
async function generatePreview(buffer, mimeType) {
  if (!mimeType || !buffer?.length) return null;

  // ── Images ────────────────────────────────────────────────────────────────
  if (mimeType.startsWith('image/')) {
    try {
      const thumb = await sharp(buffer)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: THUMB_Q })
        .toBuffer();

      return {
        thumbnailBuffer:  thumb,
        thumbnailDataUrl: `data:image/jpeg;base64,${thumb.toString('base64')}`,
        previewText:      null,
        previewType:      'image-thumb',
      };
    } catch (e) {
      console.warn('[preview] Image thumbnail failed:', e.message);
      return null;
    }
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  if (mimeType === 'application/pdf' && pdfParse) {
    try {
      // max:1 limits parsing to the first page for speed
      const data    = await pdfParse(buffer, { max: 1 });
      const snippet = (data.text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 600);
      return {
        thumbnailBuffer:  null,
        thumbnailDataUrl: null,
        previewText:      snippet || '(no extractable text on first page)',
        previewType:      'pdf-text',
      };
    } catch (e) {
      console.warn('[preview] PDF parse failed:', e.message);
      return null;
    }
  }

  // ── Plain text / JSON / code ───────────────────────────────────────────────
  const textTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/typescript',
    'application/xml',
  ];
  if (textTypes.some(t => mimeType.startsWith(t))) {
    try {
      const snippet = buffer.toString('utf8').slice(0, 600).trim();
      return {
        thumbnailBuffer:  null,
        thumbnailDataUrl: null,
        previewText:      snippet,
        previewType:      'text',
      };
    } catch {
      return null;
    }
  }

  // Video, audio, binary archives → no preview generated
  return null;
}

module.exports = { generatePreview };
