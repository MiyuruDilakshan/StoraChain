const axios = require('axios');
const FormData = require('form-data');
const { Blob } = require('buffer');

const PINATA_JWT = process.env.PINATA_JWT || '';
const PINATA_API_KEY = process.env.PINATA_API_KEY || '';
const PINATA_API_SECRET = process.env.PINATA_API_SECRET || '';
const GATEWAY_URL = process.env.GATEWAY_URL || '';
const PINATA_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_MAX_RETRIES = Number(process.env.PINATA_MAX_RETRIES || 3);
const PINATA_ATTEMPT_TIMEOUT_MS = Number(process.env.PINATA_ATTEMPT_TIMEOUT_MS || 60000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  const status = err?.response?.status;
  if (status >= 500) return true;
  if (status === 429) return true;
  const code = String(err?.code || '');
  return code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENOTFOUND';
}

function getPinataAuthHeaders() {
  if (PINATA_JWT) {
    return { Authorization: `Bearer ${PINATA_JWT}` };
  }

  if (PINATA_API_KEY && PINATA_API_SECRET) {
    return {
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_API_SECRET,
    };
  }

  throw new Error('Pinata credentials are missing. Set PINATA_JWT or PINATA_API_KEY/PINATA_API_SECRET');
}

function canUseSdk() {
  return !!PINATA_JWT;
}

async function pinViaSdk(buffer, fileName) {
  const { PinataSDK } = require('pinata');

  const pinata = new PinataSDK({
    pinataJwt: PINATA_JWT,
    ...(GATEWAY_URL ? { pinataGateway: GATEWAY_URL } : {}),
  });

  const blob = new Blob([buffer]);
  const FileCtor = globalThis.File;

  if (!FileCtor) {
    throw new Error('Global File constructor not available in this Node runtime for Pinata SDK upload');
  }

  const file = new FileCtor([blob], fileName, { type: 'application/octet-stream' });
  const upload = await pinata.upload.public.file(file);
  return upload?.cid;
}

/**
 * Pin a buffer to IPFS via Pinata.
 * Returns the IPFS CID string.
 */
async function pinBuffer(buffer, fileName) {
  // Prefer the official Pinata SDK path when JWT + runtime support are available.
  if (canUseSdk()) {
    try {
      const sdkCid = await pinViaSdk(buffer, fileName);
      if (sdkCid) return sdkCid;
      throw new Error('Pinata SDK upload succeeded but no cid was returned');
    } catch (sdkErr) {
      console.warn(`[Pinata] SDK path failed, falling back to REST API: ${sdkErr.message}`);
    }
  }

  const authHeaders = getPinataAuthHeaders();

  let lastError;

  for (let attempt = 1; attempt <= PINATA_MAX_RETRIES; attempt++) {
    try {
      const attemptTimeoutMs = PINATA_ATTEMPT_TIMEOUT_MS * attempt;
      const form = new FormData();
      form.append('file', buffer, { filename: fileName });
      form.append('pinataMetadata', JSON.stringify({ name: fileName }));

      const response = await axios.post(PINATA_URL, form, {
        headers: {
          ...authHeaders,
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
        timeout: attemptTimeoutMs,
      });

      return response.data.IpfsHash;
    } catch (err) {
      lastError = err;
      const retryable = isRetryable(err);
      const status = err?.response?.status;
      const msg = err?.response?.data?.error?.reason || err?.message || 'Unknown Pinata error';

      console.warn(
        `[Pinata] Attempt ${attempt}/${PINATA_MAX_RETRIES} failed${status ? ` (HTTP ${status})` : ''}: ${msg}`
      );

      if (!retryable || attempt === PINATA_MAX_RETRIES) {
        break;
      }

      const backoffMs = 2000 * Math.pow(2, attempt - 1);
      await sleep(backoffMs);
    }
  }

  throw lastError;
}

module.exports = { pinBuffer };
