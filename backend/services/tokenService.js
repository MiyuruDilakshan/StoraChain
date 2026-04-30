const { ethers } = require('ethers');
const path = require('path');
const fs   = require('fs');

const RPC_URL     = process.env.SEPOLIA_RPC_URL        || '';
const PRIVATE_KEY = process.env.PRIVATE_KEY            || '';
const TOKEN_ADDR  = process.env.TOKEN_CONTRACT_ADDRESS || '';

// Serialize token write txs (mint/transfer) to avoid nonce collisions when
// rewards are triggered concurrently.
let tokenTxQueue = Promise.resolve();

function enqueueTokenTx(task) {
  const run = tokenTxQueue.then(task, task);
  tokenTxQueue = run.catch(() => {});
  return run;
}

// Load ABI from compiled artifact
let TOKEN_ABI;
try {
  TOKEN_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/StoraToken.json'), 'utf8'));
} catch {
  // Fallback minimal ABI if file not found
  TOKEN_ABI = [
    'function mint(address to, uint256 amount)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ];
}

function _getContract() {
  if (!RPC_URL || !PRIVATE_KEY || !TOKEN_ADDR) return null;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(PRIVATE_KEY.replace(/^0x/, ''), provider);
  return new ethers.Contract(TOKEN_ADDR, TOKEN_ABI, signer);
}

/**
 * Mint `amountSCT` SCT tokens to `walletAddress`.
 * Uses StoraToken.mint() — requires the backend wallet to be the contract owner.
 * Fire-and-forget: errors are logged but never re-thrown.
 *
 * @param {string} walletAddress  Recipient wallet address
 * @param {number} amountSCT      Human-readable SCT amount (not wei)
 * @returns {Promise<string|null>} Transaction hash or null on failure
 */
async function mintTokens(walletAddress, amountSCT) {
  if (!RPC_URL || !PRIVATE_KEY || !TOKEN_ADDR) {
    console.warn('[Token] mintTokens skipped — missing env vars (SEPOLIA_RPC_URL, PRIVATE_KEY, TOKEN_CONTRACT_ADDRESS)');
    return null;
  }
  return enqueueTokenTx(async () => {
    try {
      const token    = _getContract();
      const decimals = await token.decimals();
      const amountBN = ethers.parseUnits(String(amountSCT), decimals);
      const tx       = await token.mint(walletAddress, amountBN);
      await tx.wait(1);
      console.log(`[Token] Minted ${amountSCT} SCT to ${walletAddress} — tx: ${tx.hash}`);
      return tx.hash;
    } catch (err) {
      console.error('[Token] mintTokens failed:', err.message);
      return null;
    }
  });
}

/**
 * Transfer `amountSCT` SCT tokens from the backend wallet to `walletAddress`.
 * Used for provider withdrawals — transfers existing tokens rather than minting new ones.
 * Requires the backend wallet to hold sufficient SCT balance.
 *
 * @param {string} walletAddress  Recipient wallet address
 * @param {number} amountSCT      Human-readable SCT amount (not wei)
 * @returns {Promise<string|null>} Transaction hash or null on failure
 */
async function transferTokens(walletAddress, amountSCT) {
  if (!RPC_URL || !PRIVATE_KEY || !TOKEN_ADDR) {
    console.warn('[Token] transferTokens skipped — missing env vars (SEPOLIA_RPC_URL, PRIVATE_KEY, TOKEN_CONTRACT_ADDRESS)');
    return null;
  }
  return enqueueTokenTx(async () => {
    try {
      const token    = _getContract();
      const decimals = await token.decimals();
      const amountBN = ethers.parseUnits(String(amountSCT), decimals);
      const tx       = await token.transfer(walletAddress, amountBN);
      await tx.wait(1);
      console.log(`[Token] Transferred ${amountSCT} SCT to ${walletAddress} — tx: ${tx.hash}`);
      return tx.hash;
    } catch (err) {
      console.error('[Token] transferTokens failed:', err.message);
      return null;
    }
  });
}

/**
 * @deprecated Use mintTokens() instead.
 * Legacy rewardProvider kept for backward compatibility — delegates to mint.
 */
async function rewardProvider(walletAddress, amount) {
  return mintTokens(walletAddress, amount);
}

module.exports = { mintTokens, transferTokens, rewardProvider };

