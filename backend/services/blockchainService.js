/**
 * blockchainService.js — StoraChainStorage contract interactions
 *
 * Two fire-and-forget functions:
 *   storeFile()      — record file upload + provider assignments on-chain
 *   recordDownload() — record a download event on-chain
 *
 * Both skip silently if env vars are not configured yet (e.g. before contract deployment).
 */

const { ethers } = require('ethers');
const path = require('path');
const fs   = require('fs');

const RPC_URL          = process.env.SEPOLIA_RPC_URL          || '';
const PRIVATE_KEY      = process.env.PRIVATE_KEY              || '';
const STORAGE_ADDR     = process.env.STORAGE_CONTRACT_ADDRESS || '';

let STORAGE_ABI;
try {
  STORAGE_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/StoraChainStorage.json'), 'utf8'));
} catch {
  STORAGE_ABI = [
    'function storeFile(bytes32 fileHash, string cid, address seekerWallet, address[] providerWallets, uint256 fileSize)',
    'function recordDownload(bytes32 fileHash, address downloader)',
    'function recordReward(address providerWallet, uint256 amountSCT)',
  ];
}

function _ready() {
  return RPC_URL && PRIVATE_KEY && STORAGE_ADDR;
}

function _getContract() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(PRIVATE_KEY.replace(/^0x/, ''), provider);
  return new ethers.Contract(STORAGE_ADDR, STORAGE_ABI, signer);
}

function _isValidNonZeroAddress(addr) {
  return !!addr && ethers.isAddress(addr) && addr.toLowerCase() !== ethers.ZeroAddress.toLowerCase();
}

async function _buildTxOverrides(provider, attempt = 0) {
  const feeData = await provider.getFeeData();
  const bumpWei = ethers.parseUnits(String(Math.min(1 + attempt, 3)), 'gwei');

  // Prefer EIP-1559 when values are sane.
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas && feeData.maxFeePerGas > feeData.maxPriorityFeePerGas) {
    let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas + bumpWei;
    let maxFeePerGas = feeData.maxFeePerGas + (bumpWei * 2n);
    if (maxFeePerGas <= maxPriorityFeePerGas) {
      maxFeePerGas = maxPriorityFeePerGas + 1n;
    }
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  // Fallback for providers/networks that expose only legacy gas price.
  if (feeData.gasPrice && feeData.gasPrice > 0n) {
    return { gasPrice: feeData.gasPrice + bumpWei, type: 0 };
  }

  // Some RPC endpoints return partial EIP-1559 data (e.g. maxFee only), which can
  // make ethers auto-populate an invalid priority/max fee pair. Force legacy tx.
  if (feeData.maxFeePerGas && feeData.maxFeePerGas > 0n) {
    return { gasPrice: feeData.maxFeePerGas, type: 0 };
  }
  if (feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > 0n) {
    return { gasPrice: feeData.maxPriorityFeePerGas, type: 0 };
  }

  // Let ethers/provider infer when fee data is unavailable.
  return {};
}

/**
 * Convert a hex SHA-256 hash string to a bytes32 value for Solidity.
 * @param {string} hexHash  64-char hex string (no 0x prefix)
 * @returns {string}  0x-prefixed 32-byte hex string
 */
function sha256ToBytes32(hexHash) {
  return '0x' + hexHash.padStart(64, '0');
}

/**
 * Record a file upload on-chain.
 * All parameters are derived from the FileRecord saved to MongoDB.
 *
 * @param {string}   sha256Hash      64-char hex SHA-256 of original plaintext
 * @param {string}   ipfsCid         Pinata/IPFS CID (empty string if not yet pinned)
 * @param {string}   seekerWallet    Seeker's wallet address (0x...)
 * @param {string[]} providerWallets Array of provider wallet addresses
 * @param {number}   fileSize        Original file size in bytes
 * @returns {Promise<string|null>}   tx.hash or null on failure
 */
async function storeFile(sha256Hash, ipfsCid, seekerWallet, providerWallets, fileSize) {
  if (!_ready()) {
    console.warn('[Blockchain] storeFile skipped — STORAGE_CONTRACT_ADDRESS or signing keys not configured');
    return null;
  }

  if (!_isValidNonZeroAddress(seekerWallet)) {
    console.warn('[Blockchain] storeFile skipped — seeker wallet missing/invalid');
    return null;
  }

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const contract = _getContract();
      const fileHash = sha256ToBytes32(sha256Hash);

      const safeProviders = (providerWallets || []).filter(w => _isValidNonZeroAddress(w));
      const txOverrides = await _buildTxOverrides(contract.runner.provider, attempt);

      const tx = await contract.storeFile(
        fileHash,
        ipfsCid || '',
        seekerWallet,
        safeProviders,
        BigInt(fileSize),
        txOverrides,
      );
      await tx.wait(1);
      console.log(`[Blockchain] storeFile tx: ${tx.hash}`);
      return tx.hash;
    } catch (err) {
      const retryable = err.message?.includes('REPLACEMENT_UNDERPRICED') ||
                        err.message?.includes('already known') ||
                        err.code === 'NONCE_EXPIRED';
      if (retryable && attempt < maxRetries - 1) {
        console.warn(`[Blockchain] storeFile attempt ${attempt + 1} retrying (${err.code || 'retryable'})…`);
        await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }
      console.error('[Blockchain] storeFile failed:', err.message);
      return null;
    }
  }
  return null;
}

/**
 * Record a download event on-chain.
 *
 * @param {string} sha256Hash    64-char hex SHA-256 of the file
 * @param {string} downloaderWallet  Downloader's wallet address
 * @returns {Promise<string|null>}
 */
async function recordDownload(sha256Hash, downloaderWallet) {
  if (!_ready()) return null;
  // Skip silently if no valid wallet — contract rejects ZeroAddress
  if (!_isValidNonZeroAddress(downloaderWallet)) {
    console.log('[Blockchain] recordDownload skipped — downloader wallet not set');
    return null;
  }
  try {
    const contract = _getContract();
    const fileHash = sha256ToBytes32(sha256Hash);
    const txOverrides = await _buildTxOverrides(contract.runner.provider, 0);
    const tx = await contract.recordDownload(
      fileHash,
      downloaderWallet,
      txOverrides,
    );
    await tx.wait(1);
    console.log(`[Blockchain] recordDownload tx: ${tx.hash}`);
    return tx.hash;
  } catch (err) {
    console.error('[Blockchain] recordDownload failed:', err.message);
    return null;
  }
}

/**
 * Emit a reward distribution event on-chain.
 *
 * @param {string} providerWallet  Provider wallet address
 * @param {number} amountSCT       Human-readable SCT amount
 * @returns {Promise<string|null>}
 */
async function recordReward(providerWallet, amountSCT) {
  if (!_ready()) return null;
  try {
    const contract  = _getContract();
    const amountWei = ethers.parseUnits(String(amountSCT), 18);
    const tx = await contract.recordReward(providerWallet, amountWei);
    await tx.wait(1);
    console.log(`[Blockchain] recordReward tx: ${tx.hash}`);
    return tx.hash;
  } catch (err) {
    console.error('[Blockchain] recordReward failed:', err.message);
    return null;
  }
}

module.exports = { storeFile, recordDownload, recordReward, sha256ToBytes32 };
