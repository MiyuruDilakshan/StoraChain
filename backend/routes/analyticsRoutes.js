const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const FileRecord = require('../models/FileRecord');
const StorageListing = require('../models/StorageListing');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');

// @route GET /api/analytics/overview
// @desc  Get aggregated stats for the current user (role-aware)
// @access Private
router.get('/overview', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const role   = req.user.role;

  try {
    const user = await User.findById(userId).select('-password');

    if (role === 'seeker') {
      const files = await FileRecord.find({ userId, isDeleted: false });
      const totalSizeBytes = files.reduce((a, f) => a + (f.fileSize || 0), 0);

      // File-type breakdown
      const byType = {};
      files.forEach(f => {
        const ext = f.fileName.split('.').pop().toLowerCase() || 'other';
        byType[ext] = (byType[ext] || 0) + 1;
      });

      // Spend on marketplace
      const purchases = await Transaction.find({ buyerId: userId, status: 'completed' });
      const totalSpentSCT = purchases.reduce((a, t) => a + (t.amountSCT || 0), 0);

      const recentFiles = files
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 8)
        .map(f => ({
          fileId:   f._id,
          fileName: f.fileName,
          fileSize: f.fileSize,
          cid:      f.cid,
          txHash:   f.txHash,
          createdAt: f.createdAt,
        }));

      // ── Recharts: uploads per day (last 30 days) ───────────────────────────
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const uploadsPerDayMap = {};
      files
        .filter(f => new Date(f.createdAt) >= thirtyDaysAgo)
        .forEach(f => {
          const d = new Date(f.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          uploadsPerDayMap[d] = (uploadsPerDayMap[d] || 0) + 1;
        });

      // build a continuous 30-day array
      const uploadsPerDay = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        uploadsPerDay.push({ date: label, count: uploadsPerDayMap[label] || 0 });
      }

      // ── Recharts: storage by MIME type [{name, value (bytes)}] ─────────────
      const mimeMap = {};
      files.forEach(f => {
        const mime = (f.mimeType || '').split('/')[0] || 'other';
        const label = mime.charAt(0).toUpperCase() + mime.slice(1);
        mimeMap[label] = (mimeMap[label] || 0) + (f.fileSize || 0);
      });
      const storageByMime = Object.entries(mimeMap).map(([name, value]) => ({ name, value }));

      return res.json({
        role:           'seeker',
        totalFiles:     files.length,
        totalSizeBytes,
        totalSizeGB:    (totalSizeBytes / (1024 ** 3)).toFixed(3),
        filesByType:    byType,
        totalSpentSCT,
        sctBalance:     user?.sctBalance ?? 100,
        demoUSD:        parseFloat((user?.demoUSD ?? 50).toFixed(2)),
        plan:           user?.plan || 'free',
        storageQuotaGB: user?.storageQuotaGB || 2,
        usedStorageGB:  parseFloat((user?.usedStorageGB || 0).toFixed(4)),
        planExpiresAt:  user?.planExpiresAt || null,
        recentFiles,
        purchases:      purchases.length,
        uploadsPerDay,
        storageByMime,
      });
    }

    if (role === 'provider') {
      const listing = await StorageListing.findOne({ providerId: userId });

      // Earnings from storage rewards and marketplace sales
      // Reward transactions use providerId; marketplace sales use sellerId
      const transactions = await Transaction.find({
        $or: [{ sellerId: userId }, { providerId: userId }],
        status: 'completed',
      });
      const tokensEarned  = transactions.reduce((a, t) => a + (t.amountSCT || 0), 0);
      const fiatEarnedUSD = (transactions.reduce((a, t) => a + (t.amountUSDCents || 0), 0) / 100).toFixed(2);

      // Withdrawal history
      const withdrawals = await Withdrawal.find({ providerId: userId }).sort({ createdAt: -1 }).limit(5);
      const totalWithdrawn = withdrawals
        .filter(w => w.status === 'completed')
        .reduce((a, w) => a + w.amountSCT, 0);

      // Monthly earnings (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const monthlyMap = {};
      transactions
        .filter(t => new Date(t.createdAt) > sixMonthsAgo)
        .forEach(t => {
          const key = new Date(t.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
          monthlyMap[key] = (monthlyMap[key] || 0) + (t.amountSCT || 0);
        });

      // ── Recharts: earnings per day (last 30 days) ──────────────────────────
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const earningsDayMap = {};
      transactions
        .filter(t => new Date(t.createdAt) >= thirtyDaysAgo)
        .forEach(t => {
          const d = new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          earningsDayMap[d] = parseFloat(((earningsDayMap[d] || 0) + (t.amountSCT || 0)).toFixed(4));
        });

      const earningsPerDay = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        earningsPerDay.push({ date: label, sct: earningsDayMap[label] || 0 });
      }

      // ── Recharts: utilisation history — rolling snapshot (last 30 days based on listing.usedGB) ──
      // We use the listing's current usedGB for today and create a simple 30-point array
      // (historical snapshots aren't stored per-day so we use the current value for demo)
      const utilisationHistory = earningsPerDay.map((e, idx) => ({
        date:   e.date,
        usedGB: idx === earningsPerDay.length - 1 ? (listing?.usedGB || 0) : 0,
      }));

      return res.json({
        role:           'provider',
        capacityGB:     listing?.capacityGB  || 0,
        usedGB:         listing?.usedGB      || 0,
        freeGB:         ((listing?.capacityGB || 0) - (listing?.usedGB || 0)).toFixed(2),
        usedPct:        listing ? ((listing.usedGB / listing.capacityGB) * 100).toFixed(1) : 0,
        isOnline:       listing?.isActive    || false,
        uptimePct:      listing?.uptimePct   || 0,
        latencyMs:      listing?.latencyMs   || 0,
        pricePerGB:     listing?.pricePerGB  || 0,
        totalEarnings:  listing?.totalEarnings || 0,   // cumulative from reward cycles
        tokensEarned,
        fiatEarnedUSD,
        totalWithdrawn,
        pendingBalance: user?.sctBalance || 0,
        transactionCount: transactions.length,
        recentWithdrawals: withdrawals,
        monthlyEarnings: monthlyMap,
        earningsPerDay,
        utilisationHistory,
      });
    }

    res.json({});
  } catch (err) {
    console.error('[Analytics]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
