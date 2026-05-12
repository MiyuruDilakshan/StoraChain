const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const StorageListing = require('../models/StorageListing');
const PendingChunk = require('../models/PendingChunk');
const { estimateSystemPricePerGB } = require('../services/pricingService');
const { processIntegrityReport, resetProviderPenalties } = require('../services/penaltyService');

// @route POST /api/providers/register
// @desc  Provider agent calls this on startup to register itself
// @access Private (requires JWT)
router.post('/register', authMiddleware, async (req, res) => {
  // pricePerGB is intentionally ignored — the system determines pricing via AI
  const { walletAddress, agentUrl, capacityGB, region, hardware } = req.body;
  
  // Capture and clean the provider's public IP address
  // x-forwarded-for can be a comma-separated list (client, proxy1, proxy2…) — take first entry
  // Also strip IPv4-mapped IPv6 prefix (::ffff:) added by some reverse proxies
  let rawIp = (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || '').toString();
  if (rawIp.includes(',')) rawIp = rawIp.split(',')[0].trim();
  rawIp = rawIp.replace(/^::ffff:/, '').trim();
  const cleanIp = rawIp || null;
  if (hardware) {
    hardware.ip = cleanIp;
  }

  if (!agentUrl || capacityGB === undefined) {
    return res.status(400).json({ message: 'Missing required fields: agentUrl, capacityGB' });
  }

  try {
    const existing = await StorageListing.findOne({ providerId: req.user.id });
    if (existing) {
      existing.agentUrl   = agentUrl;
      if (capacityGB > 0) existing.capacityGB = capacityGB;
      existing.region     = region || existing.region;
      if (walletAddress) existing.walletAddress = walletAddress;
      if (hardware) existing.hardware = hardware;
      existing.isActive   = true;
      existing.systemPricePerGB = estimateSystemPricePerGB(existing);
      await existing.save();
      return res.json({ message: 'Listing updated', listing: existing });
    }

    const initMetrics = { capacityGB, usedGB: 0, uptimePct: 100, latencyMs: 20, reputationScore: 100, region: region || 'local' };
    const listing = new StorageListing({
      providerId:       req.user.id,
      walletAddress:    walletAddress || '',
      agentUrl,
      capacityGB,
      pricePerGB:       1,  // placeholder — not used by system
      systemPricePerGB: estimateSystemPricePerGB(initMetrics),
      region:           region || 'local',
      hardware:         hardware || {},
    });
    await listing.save();
    res.status(201).json({ message: 'Provider registered', listing });
  } catch (err) {
    console.error('[Providers] Register error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route GET /api/providers
// @desc  Get all active storage providers
// @access Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const listings = await StorageListing.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error('[Providers] List error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route GET /api/providers/me
// @desc  Get the current user's own listing
// @access Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const listing = await StorageListing.findOne({ providerId: req.user.id });
    if (!listing) return res.json(null); // Return 200 with null to avoid 404 console spam in browser
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PUT /api/providers/heartbeat
// @desc  Agent sends periodic heartbeat to update live stats + integrity report
// @access Private
router.put('/heartbeat', authMiddleware, async (req, res) => {
  const { usedGB, latencyMs, uptimePct, integrityReport } = req.body;
  try {
    const listing = await StorageListing.findOne({ providerId: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Provider not found. Register first.' });

    if (usedGB    !== undefined) listing.usedGB    = usedGB;
    if (latencyMs !== undefined) listing.latencyMs = latencyMs;
    if (uptimePct !== undefined) listing.uptimePct = uptimePct;
    listing.lastHeartbeatAt   = new Date();
    listing.consecutiveMisses = 0;
    // Only mark active if provider hasn't manually paused their node.
    // If isPaused=true, the heartbeat should NOT override their offline choice.
    if (!listing.isPaused) {
      listing.isActive = true;
    }

    // Update disk stats from integrity report
    if (integrityReport) {
      if (integrityReport.diskFreeGB  !== undefined) listing.hardware.diskFreeGB  = integrityReport.diskFreeGB;
      if (integrityReport.diskTotalGB !== undefined) listing.hardware.diskTotalGB = integrityReport.diskTotalGB;
    }

    listing.systemPricePerGB = estimateSystemPricePerGB(listing);

    // ── Process integrity report for penalties ──────────────────────
    await processIntegrityReport(listing, integrityReport);

    await listing.save();

    res.json({ 
      message: 'Heartbeat received',
      suspended:  listing.isSuspended,
      isPaused:   listing.isPaused,
      penaltyPoints: listing.penaltyPoints,
      reputationScore: listing.reputationScore,
      config: {
        capacityGB:   listing.capacityGB,
        diskPath:     listing.hardware?.diskPath,
        walletAddress: listing.walletAddress
      }
    });
  } catch (err) {
    console.error('[Providers] Heartbeat error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


// @route PUT /api/providers/deactivate
// @desc  Provider goes offline — mark listing inactive
// @access Private
router.put('/deactivate', authMiddleware, async (req, res) => {
  try {
    const listing = await StorageListing.findOne({ providerId: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Provider not found' });
    listing.isActive = false;
    await listing.save();
    res.json({ message: 'Provider deactivated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PUT /api/providers/toggle-pause
// @desc  Toggle provider online/offline — also starts/stops the local PM2 agent if present
// @access Private
router.put('/toggle-pause', authMiddleware, async (req, res) => {
  try {
    const listing = await StorageListing.findOne({ providerId: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Provider not found. Install the agent first.' });

    listing.isPaused = !listing.isPaused;
    // Keep isActive in sync with isPaused:
    // - Going offline (pause) → isActive=false so chunk distribution skips this provider
    // - Going online (unpause) → isActive=true so chunk distribution includes this provider
    listing.isActive = !listing.isPaused;
    await listing.save();

    // ── Try to start/stop the local PM2 process ──────────────────
    // This works when the backend and provider agent are on the same machine.
    // On VPS setups, PM2 is controlled by the agent's own SIGTERM handler.
    const { execSync } = require('child_process');
    if (!listing.isPaused) {
      // Going ONLINE — start or restart the PM2 agent
      try {
        // Try restart first (agent already exists in PM2)
        try {
          execSync('pm2 restart storachain-provider --update-env', { stdio: 'ignore', timeout: 8000, windowsHide: true });
          console.log('[Providers] PM2 restarted storachain-provider');
        } catch {
          // Not in PM2 — try to start from the installed directory
          const os = require('os');
          const agentDir = require('path').join(os.homedir(), 'storachain-agent');
          execSync(`pm2 start ${agentDir}/agent.js --name storachain-provider`, {
            stdio: 'ignore', timeout: 8000, cwd: agentDir, windowsHide: true
          });
          execSync('pm2 save', { stdio: 'ignore', windowsHide: true });
          console.log('[Providers] PM2 started storachain-provider from', agentDir);
        }
      } catch (pm2Err) {
        // PM2 not available on this machine — agent manages itself (VPS mode)
        console.warn('[Providers] PM2 control skipped:', pm2Err.message);
      }
    } else {
      // Going OFFLINE — stop the PM2 agent
      try {
        execSync('pm2 stop storachain-provider', { stdio: 'ignore', timeout: 8000 });
        console.log('[Providers] PM2 stopped storachain-provider');
      } catch (pm2Err) {
        console.warn('[Providers] PM2 stop skipped:', pm2Err.message);
      }
    }

    res.json({
      message: `Provider is now ${listing.isPaused ? 'offline' : 'online'}`,
      listing
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/providers/uninstall
// @desc  Trigger remote agent uninstall and delete listing
// @access Private
router.post('/uninstall', authMiddleware, async (req, res) => {
  try {
    const listing = await StorageListing.findOne({ providerId: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Provider not found' });
    
    // Call agent
    let agentRes = null;
    if (listing.agentUrl) {
      try {
        agentRes = await require('axios').post(`${listing.agentUrl}/uninstall`, {}, {
          headers: { 'x-agent-key': 'agent-secret-key' },
          timeout: 5000
        });
      } catch (agentErr) {
        console.warn('[Providers] Agent uninstall call failed:', agentErr.message);
      }
    }

    await StorageListing.deleteOne({ providerId: req.user.id });
    res.json({ message: 'Provider uninstalled successfully', agentData: agentRes?.data });
  } catch (err) {
    console.error('[Providers] Uninstall error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});
// @desc  Update provider node settings (capacity, price, region)
// @access Private
router.put('/update', authMiddleware, async (req, res) => {
  const { capacityGB, region, walletAddress, diskPath } = req.body;
  try {
    const listing = await StorageListing.findOne({ providerId: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Provider not found' });
    if (capacityGB    !== undefined) listing.capacityGB    = capacityGB;
    if (region        !== undefined) listing.region        = region;
    if (walletAddress !== undefined) listing.walletAddress = walletAddress;
    if (diskPath      !== undefined) { listing.hardware = listing.hardware || {}; listing.hardware.diskPath = diskPath; }
    listing.systemPricePerGB = estimateSystemPricePerGB(listing);
    await listing.save();

    // Push config update to the agent if it's reachable
    if (listing.agentUrl) {
      const axios = require('axios');
      try {
        await axios.post(`${listing.agentUrl}/update-config`, {
          capacityGB,
          diskPath,
          walletAddress
        }, {
          headers: { 'Authorization': `Bearer ${process.env.BACKEND_AGENT_KEY || 'agent-secret-key'}` },
          timeout: 5000
        });
      } catch (e) {
        console.warn(`[Providers] Failed to push config to agent at ${listing.agentUrl}:`, e.message);
      }
    }

    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/providers/activate
// @desc  Re-activate a deactivated listing
// @access Private
router.post('/activate', authMiddleware, async (req, res) => {
  try {
    const listing = await StorageListing.findOne({ providerId: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Provider not found' });
    listing.isActive = true;
    await listing.save();
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/providers/deactivate
// @desc  Deactivate listing via POST (mirrors PUT/deactivate)
// @access Private
router.post('/deactivate', authMiddleware, async (req, res) => {
  try {
    const listing = await StorageListing.findOne({ providerId: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Provider not found' });
    listing.isActive = false;
    await listing.save();
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW: Provider CLI Installation Registration Flow
// ═══════════════════════════════════════════════════════════════════════════════

const Provider = require('../models/Provider');
const ProviderEarning = require('../models/ProviderEarning');
const ProviderWithdrawal = require('../models/ProviderWithdrawal');
const { ethers } = require('ethers');
let StoraTokenABI;
try {
  StoraTokenABI = require('../abi/StoraToken.json');
} catch (e) {
  console.warn('StoraToken  ABI not found');
  StoraTokenABI = [];
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const STORATOKEN_ADDRESS = process.env.STORATOKEN_ADDRESS || process.env.TOKEN_CONTRACT_ADDRESS;

// @route POST /api/provider-cli/register
// @desc  Provider CLI installer registration (new provider signup)
// @access Public
router.post('/cli/register', async (req, res) => {
  try {
    const { email, password, machineId, deviceName } = req.body;

    // Validation
    if (!email || !password || !machineId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check if provider already exists
    let provider = await Provider.findOne({ email });
    if (provider) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Create provider account
    provider = new Provider({
      email,
      password, // TODO: Hash in production
      machineId,
      deviceName,
      status: 'setup',
      wallet: { address: '' },
    });

    await provider.save();

    console.log(`✓ Provider registered: ${email}`);

    res.json({
      success: true,
      message: 'Registration successful',
      providerId: provider._id,
      walletAddress: provider.wallet?.address,
    });
  } catch (error) {
    console.error('[Provider CLI] Register error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route POST /api/provider-cli/heartbeat
// @desc  Provider service sends heartbeat with status
// @access Public (provider service calls this)
router.post('/cli/heartbeat', async (req, res) => {
  try {
    const { providerId, machineId, status, hdd, device, uptime, timestamp } = req.body;

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    // Update provider status
    provider.lastHeartbeat = new Date();
    provider.status = status;
    provider.hdd = hdd;
    provider.device = device;
    provider.uptime = uptime;

    await provider.save();

    res.json({ success: true, message: 'Heartbeat received' });
  } catch (error) {
    console.error('[Provider CLI] Heartbeat error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route POST /api/provider-cli/:id/go-online
// @desc  Provider goes online - mint registration + online bonus tokens
// @access Public
router.post('/cli/:id/go-online', async (req, res) => {
  try {
    const { id: providerId } = req.params;
    const { hddTotalGB, walletAddress } = req.body;

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    // Set wallet if provided
    if (walletAddress) {
      provider.wallet.address = walletAddress;
    }

    if (!provider.wallet.address) {
      return res.status(400).json({ success: false, message: 'Wallet address required' });
    }

    // Update status
    provider.status = 'online';
    provider.hdd.totalGB = hddTotalGB || provider.hdd.totalGB;
    provider.onlineAt = new Date();

    await provider.save();

    // Mint tokens (registration 0.1 + online 0.2 = 0.3 SCT)
    let txHash = null;
    try {
      txHash = await mintTokens(provider.wallet.address, '0.3');

      await ProviderEarning.create({
        providerId: provider._id,
        amount: 0.3,
        type: 'registration_bonus',
        description: 'Registration bonus (0.1 SCT) + Online bonus (0.2 SCT)',
        transactionHash: txHash,
      });

      console.log(`✓ Provider ${provider.email} went online, minted 0.3 SCT`);
    } catch (mintError) {
      console.error('[Mint] Error:', mintError.message);
      // Continue - provider goes online even if minting fails
    }

    res.json({
      success: true,
      message: 'Provider is now online!',
      bonus: '0.3 SCT',
      provider: {
        _id: provider._id,
        status: provider.status,
        wallet: provider.wallet.address,
        onlineAt: provider.onlineAt,
      },
      txHash,
    });
  } catch (error) {
    console.error('[Provider CLI] Go online error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route POST /api/provider-cli/:id/go-offline
// @desc  Provider goes offline
// @access Public
router.post('/cli/:id/go-offline', async (req, res) => {
  try {
    const { id: providerId } = req.params;

    const provider = await Provider.findByIdAndUpdate(
      providerId,
      { status: 'offline', offlineAt: new Date() },
      { new: true }
    );

    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    console.log(`✓ Provider ${provider.email} went offline`);

    res.json({ success: true, provider });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route GET /api/provider-cli/:id/dashboard
// @desc  Get provider dashboard info (status, earnings, device info)
// @access Public
router.get('/cli/:id/dashboard', async (req, res) => {
  try {
    const { id: providerId } = req.params;

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    // Get earnings
    const earnings = await ProviderEarning.find({ providerId }).sort({ createdAt: -1 });
    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);

    // Get withdrawals
    const withdrawals = await ProviderWithdrawal.find({ providerId }).sort({ createdAt: -1 });
    const totalWithdrawn = withdrawals
      .filter((w) => w.status === 'completed')
      .reduce((sum, w) => sum + w.amount, 0);

    res.json({
      success: true,
      provider: {
        _id: provider._id,
        email: provider.email,
        status: provider.status,
        wallet: provider.wallet.address,
        hdd: provider.hdd,
        device: provider.device,
        onlineAt: provider.onlineAt,
        uptime: provider.uptime,
      },
      earnings: {
        total: totalEarnings,
        records: earnings.slice(0, 20),
      },
      withdrawals: withdrawals.slice(0, 10),
      balance: {
        total: totalEarnings,
        withdrawn: totalWithdrawn,
        available: totalEarnings - totalWithdrawn,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route POST /api/provider-cli/:id/withdraw
// @desc  Request withdrawal (transfer SCT to provider wallet)
// @access Public
router.post('/cli/:id/withdraw', async (req, res) => {
  try {
    const { id: providerId } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    if (!provider.wallet.address) {
      return res.status(400).json({ success: false, message: 'Wallet not configured' });
    }

    // Get available balance
    const earnings = await ProviderEarning.find({ providerId });
    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);

    const withdrawals = await ProviderWithdrawal.find({ providerId, status: 'completed' });
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const availableBalance = totalEarnings - totalWithdrawn;

    if (availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ${availableBalance.toFixed(4)} SCT`,
      });
    }

    // Create withdrawal request
    const withdrawal = new ProviderWithdrawal({
      providerId,
      amount,
      walletAddress: provider.wallet.address,
      status: 'pending',
    });

    await withdrawal.save();

    // Process withdrawal (transfer SCT from backend wallet)
    try {
      const txHash = await transferTokens(provider.wallet.address, amount.toString());

      withdrawal.transactionHash = txHash;
      withdrawal.status = 'completed';
      withdrawal.completedAt = new Date();
      await withdrawal.save();

      console.log(`✓ Withdrawal processed: ${amount} SCT to ${provider.email}`);

      res.json({
        success: true,
        message: 'Withdrawal processed',
        withdrawal,
        txHash,
      });
    } catch (txError) {
      withdrawal.status = 'failed';
      withdrawal.error = txError.message;
      await withdrawal.save();

      console.error('[Withdrawal] TX error:', txError.message);

      res.status(500).json({
        success: false,
        message: 'Withdrawal transaction failed',
        error: txError.message,
        withdrawalId: withdrawal._id,
      });
    }
  } catch (error) {
    console.error('[Provider CLI] Withdraw error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Helper Functions ───────────────────────────────────────────────────

// Mint SCT tokens to provider wallet
async function mintTokens(toAddress, amountSCT) {
  if (!SEPOLIA_RPC || !PRIVATE_KEY || !STORATOKEN_ADDRESS) {
    console.warn('[Mint] Skipped: Missing env vars (SEPOLIA_RPC_URL, PRIVATE_KEY, STORATOKEN_ADDRESS)');
    return null;
  }

  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const sct = new ethers.Contract(STORATOKEN_ADDRESS, StoraTokenABI, wallet);

    const amount = ethers.parseUnits(amountSCT, 18);
    const tx = await sct.mint(toAddress, amount);
    const receipt = await tx.wait();

    console.log(`✓ Minted ${amountSCT} SCT to ${toAddress}`);
    console.log(`  TX: ${receipt.transactionHash}`);

    return receipt.transactionHash;
  } catch (error) {
    console.error('[Mint] Error:', error.message);
    throw error;
  }
}

// Transfer SCT from backend wallet to provider
async function transferTokens(toAddress, amountSCT) {
  if (!SEPOLIA_RPC || !PRIVATE_KEY || !STORATOKEN_ADDRESS) {
    throw new Error('Token transfer not configured (missing env vars)');
  }

  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const sct = new ethers.Contract(STORATOKEN_ADDRESS, StoraTokenABI, wallet);

    const amount = ethers.parseUnits(amountSCT, 18);

    // Check balance
    const walletAddr = await wallet.getAddress();
    const balance = await sct.balanceOf(walletAddr);

    if (balance < amount) {
      throw new Error(
        `Insufficient SCT in backend wallet. Have: ${ethers.formatUnits(balance, 18)}, Need: ${amountSCT}`
      );
    }

    const tx = await sct.transfer(toAddress, amount);
    const receipt = await tx.wait();

    console.log(`✓ Transferred ${amountSCT} SCT to ${toAddress}`);
    console.log(`  TX: ${receipt.transactionHash}`);

    return receipt.transactionHash;
  } catch (error) {
    console.error('[Transfer] Error:', error.message);
    throw error;
  }
}

// ── GET /api/providers/disk-info ─────────────────────────────────────────
// Fetches disk information from the running provider agent.
// The agent must expose GET /disk-info returning { disks: [{name,mountpoint,totalGB,freeGB}] }
router.get('/disk-info', authMiddleware, async (req, res) => {
  try {
    const listing = await StorageListing.findOne({ providerId: req.user.id });
    if (!listing) return res.status(404).json({ message: 'No provider registration found. Install the agent first.' });
    const agentUrl = listing.agentUrl || 'http://localhost:3001';
    try {
      const { default: axios } = await import('axios');
      const { data } = await axios.get(`${agentUrl}/disk-info`, { timeout: 15000 });
      return res.json(data);
    } catch (agentErr) {
      // Agent offline — return placeholder message
      return res.status(503).json({ message: 'Agent offline or not responding. Please ensure the StoraChain agent is running.', agentUrl });
    }
  } catch (err) {
    console.error('[Providers] disk-info error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


// ── Chunk Pull Queue (NAT bypass) ─────────────────────────────────────────────
// Provider agent polls this to download chunks that the backend couldn't push
// directly (home PC behind router NAT).

// GET /api/providers/chunk-queue  →  list pending chunk IDs for this provider
router.get('/chunk-queue', authMiddleware, async (req, res) => {
  try {
    const pending = await PendingChunk.find({ providerId: req.user.id }).select('chunkId createdAt').lean();
    res.json({ chunks: pending.map(p => p.chunkId) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/providers/chunk-queue/:chunkId  →  download the raw chunk binary
router.get('/chunk-queue/:chunkId', authMiddleware, async (req, res) => {
  try {
    const pending = await PendingChunk.findOne({ chunkId: req.params.chunkId, providerId: req.user.id });
    if (!pending) return res.status(404).json({ message: 'Chunk not found or already claimed' });
    res.set('Content-Type', 'application/octet-stream');
    res.set('x-chunk-id', pending.chunkId);
    res.send(pending.data);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/providers/chunk-queue/:chunkId  →  confirm receipt, remove from queue
router.delete('/chunk-queue/:chunkId', authMiddleware, async (req, res) => {
  try {
    await PendingChunk.deleteOne({ chunkId: req.params.chunkId, providerId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


// ── GET /api/providers/integrity-report ──────────────────────────────────────
// Provider sees their own integrity + penalty status
router.get('/integrity-report', authMiddleware, async (req, res) => {
  try {
    const listing = await StorageListing.findOne({ providerId: req.user.id });
    if (!listing) return res.json(null);
    res.json({
      integrityHealthy:    listing.integrityHealthy,
      lastIntegrityCheck:  listing.lastIntegrityCheck,
      lastHeartbeatAt:     listing.lastHeartbeatAt,
      reputationScore:     listing.reputationScore,
      penaltyPoints:       listing.penaltyPoints,
      isSuspended:         listing.isSuspended,
      suspensionReason:    listing.suspensionReason,
      totalViolations:     listing.totalViolations,
      recentViolations:    listing.integrityViolations?.slice(-5) || [],
      recentPenalties:     listing.penaltyHistory?.slice(-5) || [],
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Admin: GET /api/providers/admin/suspended ─────────────────────────────────
router.get('/admin/suspended', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const suspended = await StorageListing.find({ isSuspended: true })
      .populate('providerId', 'name email')
      .sort({ suspendedAt: -1 });
    res.json(suspended);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Admin: POST /api/providers/admin/clear-suspension/:listingId ─────────────
router.post('/admin/clear-suspension/:listingId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const listing = await StorageListing.findById(req.params.listingId);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    await resetProviderPenalties(listing);
    await listing.save();
    res.json({ message: 'Suspension cleared', listing });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
