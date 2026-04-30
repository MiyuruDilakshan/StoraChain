/**
 * Automated reward distribution job
 * Runs every night at midnight UTC (00:00).
 * For each active storage provider:
 *   1. Computes reward via Flask AI service (fallback: local formula)
 *   2. Mints SCT to their wallet via StoraToken.mint()
 *   3. Creates a Transaction record (type: 'reward')
 *   4. Updates StorageListing.totalEarnings and lastRewardedAt
 * Saves a RewardCycleLog at the end.
 */

const cron = require('node-cron');
const axios = require('axios');
const StorageListing = require('../models/StorageListing');
const Transaction    = require('../models/Transaction');
const RewardCycleLog = require('../models/RewardCycleLog');
const { mintTokens } = require('../services/tokenService');
const { estimateSystemPricePerGB } = require('../services/pricingService');

const FLASK_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';

// ─── Local fallback reward formula ───────────────────────────────────────────
function localComputeReward(listing) {
  // Base: usedGB × pricePerGB per day (24 h)
  const storageHoursGB = listing.usedGB * 24;
  const effectivePrice = listing.systemPricePerGB || estimateSystemPricePerGB(listing);
  const base = storageHoursGB * effectivePrice;
  // Uptime bonus: scale 0–10% extra for 90–100% uptime
  const uptimeBonus = listing.uptimePct >= 90
    ? base * ((listing.uptimePct - 90) / 100)
    : 0;
  const rewardSCT = parseFloat((base + uptimeBonus).toFixed(4));
  return { storageHoursGB, uptimePct: listing.uptimePct, rewardSCT };
}

// ─── Ask Flask for rewards (returns array of {providerId, rewardSCT, ...}) ──
async function fetchAIRewards(providers) {
  const payload = providers.map(p => ({
    providerId:    p._id.toString(),
    storageGB:     p.usedGB      || 0,
    uptimePct:     p.uptimePct   || 0,
    latencyMs:     p.latencyMs   || 0,
    pricePerGB:    p.systemPricePerGB || estimateSystemPricePerGB(p),
    reputationScore: p.reputationScore || 100,
  }));
  const res = await axios.post(`${FLASK_URL}/compute-rewards`, { providers: payload }, { timeout: 10000 });
  return res.data.rewards || [];
}

// ─── Core cycle logic (exported so adminRoutes can trigger it on-demand) ─────
async function runRewardCycle() {
  console.log('[RewardJob] Starting reward distribution cycle…');
  const cycleStart = new Date();

  const listings = await StorageListing.find({ isActive: true })
    .populate('providerId', 'name email walletAddress');

  if (!listings.length) {
    console.log('[RewardJob] No active providers — skipping cycle.');
    return { providersProcessed: 0, totalSCTMinted: 0, results: [], status: 'completed' };
  }

  // Try Flask; fall back to local formula
  let aiMap = {};
  try {
    const aiRewards = await fetchAIRewards(listings);
    aiRewards.forEach(r => { aiMap[r.providerId] = r; });
  } catch (err) {
    console.warn('[RewardJob] Flask AI unavailable — using local formula:', err.message);
  }

  const results = [];
  let totalSCTMinted = 0;
  let anyFailed = false;

  for (const listing of listings) {
    const pid = listing._id.toString();
    const walletAddress = listing.walletAddress || listing.providerId?.walletAddress || '';

    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      results.push({ providerId: listing.providerId?._id || listing.providerId, walletAddress, storageHoursGB: 0, uptimePct: 0, rewardSCT: 0, txHash: '', status: 'failed', error: 'Invalid or missing wallet address' });
      anyFailed = true;
      continue;
    }

    // Compute reward amount
    let storageHoursGB, uptimePct, rewardSCT;
    if (aiMap[pid]) {
      storageHoursGB = (listing.usedGB || 0) * 24;
      uptimePct      = listing.uptimePct || 0;
      rewardSCT      = parseFloat((aiMap[pid].rewardSCT || 0).toFixed(4));
    } else {
      ({ storageHoursGB, uptimePct, rewardSCT } = localComputeReward(listing));
    }

    if (rewardSCT <= 0) {
      results.push({ providerId: listing.providerId?._id || listing.providerId, walletAddress, storageHoursGB, uptimePct, rewardSCT: 0, txHash: '', status: 'success', error: 'Zero reward — no storage used' });
      continue;
    }

    try {
      // Mint SCT to provider wallet
      const txHash = await mintTokens(walletAddress, rewardSCT);

      // Create Transaction record
      await Transaction.create({
        type:           'reward',
        providerId:      listing.providerId?._id || listing.providerId,
        providerWallet:  walletAddress,
        amountSCT:       rewardSCT,
        txHash:          txHash || '',
        status:          'completed',
        billingPeriod:   cycleStart.toISOString().slice(0, 10),
      });

      // Update listing
      listing.totalEarnings = (listing.totalEarnings || 0) + rewardSCT;
      listing.lastRewardedAt = new Date();
      await listing.save();

      totalSCTMinted += rewardSCT;
      results.push({ providerId: listing.providerId?._id || listing.providerId, walletAddress, storageHoursGB, uptimePct, rewardSCT, txHash: txHash || '', status: 'success', error: '' });
    } catch (err) {
      console.error(`[RewardJob] Failed for provider ${pid}:`, err.message);
      results.push({ providerId: listing.providerId?._id || listing.providerId, walletAddress, storageHoursGB, uptimePct, rewardSCT, txHash: '', status: 'failed', error: err.message });
      anyFailed = true;
    }
  }

  const cycleStatus = anyFailed ? 'partial' : 'completed';
  const log = await RewardCycleLog.create({
    runAt:              cycleStart,
    providersProcessed: listings.length,
    totalSCTMinted:     parseFloat(totalSCTMinted.toFixed(4)),
    results,
    status:             cycleStatus,
  });

  console.log(`[RewardJob] Cycle complete — ${listings.length} providers, ${totalSCTMinted.toFixed(4)} SCT minted, status: ${cycleStatus}`);
  return { providersProcessed: listings.length, totalSCTMinted: parseFloat(totalSCTMinted.toFixed(4)), results, status: cycleStatus, logId: log._id };
}

// ─── Schedule: every day at midnight UTC ─────────────────────────────────────
cron.schedule('0 0 * * *', async () => {
  try {
    await runRewardCycle();
  } catch (err) {
    console.error('[RewardJob] Unhandled error in cycle:', err.message);
  }
}, { timezone: 'UTC' });

console.log('[RewardJob] Reward distribution job scheduled (midnight UTC)');

module.exports = { runRewardCycle };
