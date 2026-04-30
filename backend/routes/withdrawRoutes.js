const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const { transferTokens } = require('../services/tokenService');

// @route GET /api/withdraw/balance
// @desc  Get current SCT balance
// @access Private
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('sctBalance walletAddress name role');
    res.json({ sctBalance: user?.sctBalance || 0, walletAddress: user?.walletAddress || '' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route GET /api/withdraw/history
// @desc  Get withdrawal history for the current provider
// @access Private
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ providerId: req.user.id }).sort({ createdAt: -1 });
    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/withdraw/request
// @desc  Submit a withdrawal request
// @access Private (providers only)
router.post('/request', authMiddleware, async (req, res) => {
  if (req.user.role !== 'provider') {
    return res.status(403).json({ message: 'Only providers can withdraw earnings' });
  }

  const { amountSCT, walletAddress } = req.body;
  if (!amountSCT || !walletAddress) {
    return res.status(400).json({ message: 'amountSCT and walletAddress are required' });
  }
  if (Number(amountSCT) < 1) {
    return res.status(400).json({ message: 'Minimum withdrawal is 1 SCT' });
  }

  try {
    const user = await User.findById(req.user.id);
    if ((user.sctBalance || 0) < Number(amountSCT)) {
      return res.status(400).json({
        message: `Insufficient balance. Requested: ${amountSCT} SCT, Available: ${user.sctBalance || 0} SCT`,
      });
    }

    // Deduct from off-chain balance immediately
    user.sctBalance = (user.sctBalance || 0) - Number(amountSCT);
    await user.save();

    // Create withdrawal record
    const withdrawal = new Withdrawal({
      providerId:    req.user.id,
      amountSCT:     Number(amountSCT),
      walletAddress: walletAddress.trim(),
      status:        'processing',
    });
    await withdrawal.save();

    // Attempt on-chain transfer (non-blocking, best effort)
    transferTokens(walletAddress.trim(), Number(amountSCT))
      .then(async (txHash) => {
        withdrawal.status = 'completed';
        withdrawal.processedAt = new Date();
        if (txHash) withdrawal.txHash = txHash;
        await withdrawal.save();
      })
      .catch(async (err) => {
        console.error('[Withdraw] On-chain transfer failed:', err.message);
        // Refund the balance since on-chain failed
        user.sctBalance = (user.sctBalance || 0) + Number(amountSCT);
        await user.save();
        withdrawal.status = 'failed';
        withdrawal.note = err.message;
        await withdrawal.save();
      });

    res.status(201).json({
      message:       'Withdrawal submitted',
      withdrawal,
      newBalance:    user.sctBalance,
    });
  } catch (err) {
    console.error('[Withdraw]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
