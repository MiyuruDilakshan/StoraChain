/**
 * adminRoutes.js — Admin-only backend APIs
 * All routes require: authenticated user (authMiddleware) + role === 'admin'.
 */

const express    = require('express');
const router     = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User           = require('../models/User');
const StorageListing = require('../models/StorageListing');
const FileRecord     = require('../models/FileRecord');
const MarketplaceListing = require('../models/MarketplaceListing');
const Transaction    = require('../models/Transaction');
const ReplicationLog = require('../models/ReplicationLog');
const RewardCycleLog = require('../models/RewardCycleLog');
const AbuseReport    = require('../models/AbuseReport');
const { checkReplication } = require('../jobs/replicationMonitor');
const { mintTokens } = require('../services/tokenService');
const axios          = require('axios');

const { PLANS } = require('../config/plans');
const PLATFORM_LAUNCH = new Date('2025-01-01'); // adjust as needed
const AI_SERVICE_URL  = process.env.AI_SERVICE_URL || 'http://localhost:5001';

// ─── Admin guard middleware ────────────────────────────────────────────────
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

// Apply auth + admin guard to all routes in this router
router.use(authMiddleware, adminOnly);

// ─── GET /api/admin/stats ─────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalProviders,
      activeProviders,
      totalFiles,
      storageAgg,
      sctAgg,
    ] = await Promise.all([
      User.countDocuments(),
      StorageListing.countDocuments(),
      StorageListing.countDocuments({ isActive: true }),
      FileRecord.countDocuments({ isDeleted: false }),
      StorageListing.aggregate([{ $group: { _id: null, total: { $sum: '$usedGB' } } }]),
      Transaction.aggregate([
        { $match: { type: 'reward', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amountSCT' } } },
      ]),
    ]);

    const [
      totalMarketplaceListings,
      activeUsers,
      suspendedUsers,
    ] = await Promise.all([
      MarketplaceListing.countDocuments({ isActive: true }),
      User.countDocuments({ status: { $in: ['active', null, undefined] } }),
      User.countDocuments({ status: { $in: ['suspended', 'banned'] } }),
    ]);

    const totalStorageGB  = storageAgg[0]?.total  || 0;
    const totalSCTMinted  = sctAgg[0]?.total       || 0;
    const platformDaysOnline = Math.floor(
      (Date.now() - PLATFORM_LAUNCH.getTime()) / (1000 * 60 * 60 * 24)
    );

    res.json({
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalProviders,
      activeProviders,
      totalFiles,
      totalStorageGB,
      totalSCTMinted,
      totalMarketplaceListings,
      platformDaysOnline,
    });
  } catch (err) {
    console.error('[Admin] Stats error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error('[Admin] Users error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/admin/providers ─────────────────────────────────────────────
router.get('/providers', async (req, res) => {
  try {
    const providers = await StorageListing.find()
      .populate('providerId', 'name email createdAt')
      .sort({ createdAt: -1 });
    res.json(providers);
  } catch (err) {
    console.error('[Admin] Providers error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/admin/files ─────────────────────────────────────────────────
// Returns all FileRecords with a computed chunkHealth field per file.
// chunkHealth is derived from the most recent ReplicationLog entry per chunk:
//   'failed'  → 'critical'
//   'skipped' → 'degraded'  (couldn't find spare provider)
//   'success' or no entry   → 'healthy'
router.get('/files', async (req, res) => {
  try {
    const files = await FileRecord.find({ isDeleted: false })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    // Collect all chunkIds across all files
    const allChunkIds = files.flatMap(f => f.chunks.map(c => c.chunkId));

    // Fetch the most recent ReplicationLog per chunkId (one query)
    const logs = await ReplicationLog.aggregate([
      { $match: { chunkId: { $in: allChunkIds } } },
      { $sort:  { createdAt: -1 } },
      { $group: { _id: '$chunkId', status: { $first: '$status' } } },
    ]);

    const logMap = {};
    for (const l of logs) logMap[l._id] = l.status;

    const result = files.map(file => {
      let worstHealth = 'healthy';
      for (const chunk of file.chunks) {
        const s = logMap[chunk.chunkId];
        if (s === 'failed')  { worstHealth = 'critical';  break; }
        if (s === 'skipped') { worstHealth = 'degraded'; }
      }
      return { ...file.toObject(), chunkHealth: worstHealth };
    });

    res.json(result);
  } catch (err) {
    console.error('[Admin] Files error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/admin/transactions ──────────────────────────────────────────
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(transactions);
  } catch (err) {
    console.error('[Admin] Transactions error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/admin/replication-logs ─────────────────────────────────────
router.get('/replication-logs', async (req, res) => {
  try {
    const logs = await ReplicationLog.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('fileId', 'fileName');
    res.json(logs);
  } catch (err) {
    console.error('[Admin] Replication logs error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/admin/reward-cycle ─────────────────────────────────────────
// Triggers a reward distribution cycle synchronously and returns full results.
router.post('/reward-cycle', async (req, res) => {
  try {
    const providers = await StorageListing.find({ isActive: true })
      .populate('providerId', 'name walletAddress');

    if (providers.length === 0) {
      return res.json({ message: 'No active providers', results: [] });
    }

    const now = new Date();

    // Build performance report for each provider from StorageListing fields
    const reports = providers.map(p => {
      const daysActive = Math.max(1, Math.floor(
        (now - new Date(p.createdAt)) / (1000 * 60 * 60 * 24)
      ));
      return {
        id:               p._id.toString(),
        storageHoursGB:   (p.usedGB || 0) * 24,    // estimate from current usage
        bandwidthGB:      0,                         // no download telemetry yet
        uptime:           p.uptimePct ?? 100,
        replicas:         1,
        daysActive,
      };
    });

    // Call Flask AI service for reward computation (with fallback)
    let rewardMap = {};
    try {
      const aiRes = await axios.post(
        `${AI_SERVICE_URL}/compute-rewards`,
        { providers: reports },
        { timeout: 5000 }
      );
      for (const r of aiRes.data.rewards || []) {
        rewardMap[r.id] = r.rewardSCT;
      }
    } catch {
      // Local formula fallback (mirrors ai-service/app.py)
      const SCT_PER_POINT = 5.0;
      const daysArr = reports.map(r => r.daysActive);
      const minD = Math.min(...daysArr), maxD = Math.max(...daysArr);
      for (const r of reports) {
        const normDays = (maxD > minD) ? (r.daysActive - minD) / (maxD - minD) : 0.5;
        let base = r.storageHoursGB * 0.35
          + r.bandwidthGB * 0.20
          + (r.uptime / 100) * 0.25
          + r.replicas * 0.10
          + normDays * 0.10;
        if (r.uptime > 99) base *= 1.5;
        else if (r.uptime < 80) base *= 0.7;
        rewardMap[r._id || r.id] = parseFloat((base * SCT_PER_POINT).toFixed(4));
      }
    }

    // Mint SCT and record transactions
    const results = [];
    const today = now.toISOString().split('T')[0];

    for (const p of providers) {
      const report      = reports.find(r => r.id === p._id.toString());
      const rewardSCT   = rewardMap[p._id.toString()] ?? 0;
      const wallet      = p.walletAddress || p.providerId?.walletAddress || '';

      // Prevent double-payment within same calendar day
      if (p.lastRewardedAt) {
        const lastDate = new Date(p.lastRewardedAt).toISOString().split('T')[0];
        if (lastDate === today) {
          results.push({ provider: p._id, wallet, rewardSCT, status: 'skipped', reason: 'Already rewarded today' });
          continue;
        }
      }

      let txHash = null;
      if (wallet && rewardSCT > 0) {
        txHash = await mintTokens(wallet, rewardSCT);
      }

      // Record transaction
      try {
        await Transaction.create({
          type:          'reward',
          providerId:    p.providerId?._id || p._id,
          providerWallet: wallet,
          paymentMethod: 'reward',
          amountSCT:     rewardSCT,
          txHash:        txHash || '',
          status:        txHash ? 'completed' : 'pending',
          billingPeriod: today,
        });
      } catch { /* ignore tx record failures */ }

      // Update provider totals
      await StorageListing.findByIdAndUpdate(p._id, {
        $inc: { totalEarnings: rewardSCT },
        lastRewardedAt: now,
      });

      results.push({
        provider:       p._id,
        wallet,
        storageHoursGB: report?.storageHoursGB || 0,
        uptime:         report?.uptime || 0,
        rewardSCT,
        txHash,
        status: txHash ? 'minted' : (rewardSCT > 0 ? 'pending_wallet' : 'zero_reward'),
      });
    }

    res.json({
      message:    'Reward cycle complete',
      runAt:      now.toISOString(),
      totalMinted: results.reduce((s, r) => s + (r.rewardSCT || 0), 0),
      results,
    });

    // Save cycle log (non-blocking)
    RewardCycleLog.create({
      runAt:              now,
      providersProcessed: providers.length,
      totalSCTMinted:     parseFloat(results.reduce((s, r) => s + (r.rewardSCT || 0), 0).toFixed(4)),
      results: results.map(r => ({
        providerId:     r.provider,
        walletAddress:  r.wallet,
        storageHoursGB: r.storageHoursGB || 0,
        uptimePct:      r.uptime || 0,
        rewardSCT:      r.rewardSCT || 0,
        txHash:         r.txHash || '',
        status:         r.status === 'minted' ? 'success' : 'failed',
        error:          r.reason || '',
      })),
      status: results.some(r => r.status === 'minted') ? 'completed' : 'partial',
    }).catch(e => console.warn('[Admin] Failed to save RewardCycleLog:', e.message));
  } catch (err) {
    console.error('[Admin] Reward cycle error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── GET /api/admin/reward-cycles ────────────────────────────────────────
router.get('/reward-cycles', async (req, res) => {
  try {
    const logs = await RewardCycleLog.find().sort({ runAt: -1 }).limit(50);
    res.json(logs);
  } catch (err) {
    console.error('[Admin] Reward cycles error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/admin/abuse-reports ───────────────────────────────────────
router.get('/abuse-reports', async (req, res) => {
  try {
    const reports = await AbuseReport.find()
      .populate('reporterUserId', 'name email role')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(reports);
  } catch (err) {
    console.error('[Admin] Abuse reports error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUT /api/admin/abuse-reports/:id ───────────────────────────────────
router.put('/abuse-reports/:id', async (req, res) => {
  try {
    const { status, adminNote } = req.body || {};
    if (!['open', 'reviewing', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    const report = await AbuseReport.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNote: adminNote || '',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json({ message: 'Report updated', report });
  } catch (err) {
    console.error('[Admin] Abuse update error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/admin/risk-posture ────────────────────────────────────────
router.get('/risk-posture', async (req, res) => {
  try {
    const [
      totalProviders,
      activeProviders,
      openAbuse,
      totalFiles,
      withIpfs,
      withCloud,
    ] = await Promise.all([
      StorageListing.countDocuments(),
      StorageListing.countDocuments({ isActive: true }),
      AbuseReport.countDocuments({ status: { $in: ['open', 'reviewing'] } }),
      FileRecord.countDocuments({ isDeleted: false }),
      FileRecord.countDocuments({ isDeleted: false, ipfsCid: { $nin: ['', null] } }),
      FileRecord.countDocuments({ isDeleted: false, cloudBackupPath: { $nin: ['', null] } }),
    ]);

    const issues = [
      { key: 'slow_retrieval', title: 'Slow file retrieval and preview for large encrypted/chunked files', severity: 'medium', status: 'mitigated', mitigation: 'Dedicated preview route, chunk fallback chain, provider+replica retrieval.', metric: `${activeProviders}/${Math.max(totalProviders, 1)} providers online` },
      { key: 'provider_offline', title: 'Provider nodes going offline or becoming unreliable', severity: 'high', status: activeProviders < Math.max(1, Math.ceil(totalProviders * 0.6)) ? 'at_risk' : 'mitigated', mitigation: 'Replication monitor and replica-first fallback on download.', metric: `${activeProviders}/${totalProviders} active` },
      { key: 'data_loss', title: 'Data loss risk if replication or backup fails', severity: 'critical', status: withIpfs < totalFiles ? 'at_risk' : 'mitigated', mitigation: 'Four-tier reliability: provider, replica, IPFS, cloud backup.', metric: `IPFS coverage: ${withIpfs}/${totalFiles}` },
      { key: 'storage_overhead', title: 'High storage overhead from replication and multiple backups', severity: 'medium', status: 'open', mitigation: 'Tune replication factor by file criticality and access frequency.', metric: 'Optimization backlog' },
      { key: 'key_management', title: 'Encryption key management complexity', severity: 'critical', status: 'open', mitigation: 'Move to KMS/HSM and key rotation policy with envelope encryption.', metric: 'Planned hardening' },
      { key: 'provider_cheating', title: 'Provider cheating (fake storage claims)', severity: 'high', status: 'open', mitigation: 'Implement proof-of-storage challenge audits and penalties.', metric: 'Challenge protocol pending' },
      { key: 'tampering', title: 'File corruption or tampering by providers', severity: 'high', status: 'mitigated', mitigation: 'AES-GCM auth tag + SHA-256 verification on download.', metric: 'Integrity checks active' },
      { key: 'gas_scaling', title: 'Smart contract gas fee and scalability limits', severity: 'medium', status: 'open', mitigation: 'Batch events / L2 migration for production traffic.', metric: 'Sepolia baseline only' },
      { key: 'sync_complexity', title: 'Complex synchronization across providers, IPFS, cloud', severity: 'medium', status: 'open', mitigation: 'Add background reconciliation and drift alerts.', metric: 'Reconciliation backlog' },
      { key: 'load_balance', title: 'Uneven provider load balancing', severity: 'medium', status: 'open', mitigation: 'Improve AI scoring with capacity and heat balancing.', metric: 'AI iteration needed' },
      { key: 'ux_speed', title: 'Slow UX vs centralized storage providers', severity: 'medium', status: 'mitigated', mitigation: 'Preview layer and non-blocking upload stages implemented.', metric: 'Preview pipeline active' },
      { key: 'legal_privacy', title: 'Legal/privacy risks from prohibited content', severity: 'high', status: openAbuse > 0 ? 'at_risk' : 'mitigated', mitigation: 'Terms of Service + Abuse reporting workflow + admin moderation.', metric: `${openAbuse} open abuse reports` },
      { key: 'api_security', title: 'API/auth/node communication vulnerabilities', severity: 'high', status: 'open', mitigation: 'Periodic pentest, strict JWT/CORS hardening, key rotation.', metric: 'Continuous hardening required' },
      { key: 'cost_growth', title: 'Infrastructure costs as user base grows', severity: 'medium', status: 'open', mitigation: 'Tiered storage and provider incentive tuning.', metric: 'Cost controls pending' },
      { key: 'node_ops', title: 'Complex node management across environments', severity: 'medium', status: 'mitigated', mitigation: 'VPS setup scripts + service templates + health endpoints.', metric: 'Deployment guides added' },
      { key: 'trust_reputation', title: 'Provider reputation and trust management', severity: 'medium', status: 'open', mitigation: 'Weighted reputation model and dispute resolution process.', metric: 'Model in progress' },
      { key: 'ai_matchmaking', title: 'AI matchmaking and optimization quality', severity: 'medium', status: 'open', mitigation: 'Feedback loop with outcome metrics and retraining.', metric: 'Needs production telemetry' },
      { key: 'version_efficiency', title: 'Version control and file update inefficiencies', severity: 'low', status: 'open', mitigation: 'Introduce chunk-level dedupe and delta versioning.', metric: 'Planned' },
      { key: 'mass_failure', title: 'Disaster recovery during mass provider failure', severity: 'critical', status: withCloud < totalFiles ? 'at_risk' : 'mitigated', mitigation: 'IPFS + cloud recovery and replay workflow.', metric: `Cloud backup coverage: ${withCloud}/${totalFiles}` },
      { key: 'uptime_monitoring', title: 'Monitoring and uptime maintenance in distributed system', severity: 'high', status: 'mitigated', mitigation: 'Heartbeat + replication logs + admin observability.', metric: 'Monitoring active' },
      { key: 'onboarding', title: 'User onboarding complexity for non-technical users', severity: 'medium', status: 'open', mitigation: 'Guided setup wizard and simplified language UX.', metric: 'UX roadmap item' },
    ];

    res.json({
      summary: {
        totalIssues: issues.length,
        open: issues.filter(i => i.status === 'open').length,
        atRisk: issues.filter(i => i.status === 'at_risk').length,
        mitigated: issues.filter(i => i.status === 'mitigated').length,
      },
      issues,
    });
  } catch (err) {
    console.error('[Admin] Risk posture error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUT /api/admin/providers/:id/status ─────────────────────────────────
// body.status: 'active' | 'suspended' | 'banned'
router.put('/providers/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ message: "status must be 'active', 'suspended', or 'banned'" });
    }

    const listing = await StorageListing.findByIdAndUpdate(
      req.params.id,
      { isActive: status === 'active' },
      { new: true }
    ).populate('providerId', 'name email');

    if (!listing) return res.status(404).json({ message: 'Provider not found' });
    res.json({ message: `Provider ${status}`, listing });
  } catch (err) {
    console.error('[Admin] Provider status error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PATCH /api/admin/users/:id ──────────────────────────────────────────
// Update user role, plan, balances, or status
router.patch('/users/:id', async (req, res) => {
  try {
    const { role, plan, sctBalance, demoUSD, status, storageQuotaGB } = req.body || {};
    const update = {};

    if (role && ['seeker', 'provider', 'admin'].includes(role)) update.role = role;
    if (status && ['active', 'suspended', 'banned'].includes(status)) update.status = status;
    if (plan && PLANS[plan]) {
      update.plan = plan;
      if (!storageQuotaGB) update.storageQuotaGB = PLANS[plan].storageGB;
    }
    if (typeof sctBalance === 'number' && sctBalance >= 0) update.sctBalance = sctBalance;
    if (typeof demoUSD    === 'number' && demoUSD    >= 0) update.demoUSD    = demoUSD;
    if (typeof storageQuotaGB === 'number' && storageQuotaGB >= 0) update.storageQuotaGB = storageQuotaGB;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User updated', user });
  } catch (err) {
    console.error('[Admin] User update error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `User ${user.email} deleted` });
  } catch (err) {
    console.error('[Admin] User delete error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/admin/marketplace ──────────────────────────────────────────
router.get('/marketplace', async (req, res) => {
  try {
    const listings = await MarketplaceListing.find()
      .populate('sellerId', 'name email')
      .populate('fileRecordId', 'shareToken visibility isLocked')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(listings);
  } catch (err) {
    console.error('[Admin] Marketplace error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── DELETE /api/admin/marketplace/:id ──────────────────────────────────
router.delete('/marketplace/:id', async (req, res) => {
  try {
    const listing = await MarketplaceListing.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    res.json({ message: 'Listing removed from marketplace' });
  } catch (err) {
    console.error('[Admin] Marketplace delete error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/admin/replication-monitor/run ─────────────────────────────
router.post('/replication-monitor/run', async (req, res) => {
  try {
    const result = await checkReplication();
    if (!result?.ok) {
      return res.status(500).json({
        message: 'Replication monitor run failed',
        result,
      });
    }
    res.json({
      message: 'Replication monitor run completed',
      result,
    });
  } catch (err) {
    console.error('[Admin] Manual replication run error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
