const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { PLANS, REVENUE_SPLIT } = require('../config/plans');

// GET /api/plans — list all plans + revenue split (public)
router.get('/', (req, res) => {
  res.json({ plans: Object.values(PLANS), revenueSplit: REVENUE_SPLIT });
});

// GET /api/plans/my-plan — current user's plan details + wallet
router.get('/my-plan', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    const plan = PLANS[user.plan || 'free'];
    res.json({
      currentPlan:    plan,
      storageQuotaGB: user.storageQuotaGB ?? plan.storageGB,
      usedStorageGB:  parseFloat((user.usedStorageGB || 0).toFixed(4)),
      planExpiresAt:  user.planExpiresAt,
      wallet: {
        demoUSD:    parseFloat((user.demoUSD ?? 50).toFixed(2)),
        sctBalance: user.sctBalance ?? 100,
      },
    });
  } catch (err) {
    console.error('[Plans] my-plan error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/plans/subscribe — change plan with demo payment
router.post('/subscribe', authMiddleware, async (req, res) => {
  const { planId, paymentMethod } = req.body;
  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ message: 'Invalid plan ID' });

  try {
    const user = await User.findById(req.user.id);

    // Downgrade to free — no payment needed
    if (plan.priceUSD === 0) {
      user.plan           = 'free';
      user.storageQuotaGB = plan.storageGB;
      user.planExpiresAt  = null;
      await user.save();
      return res.json({
        message: 'Switched to Free plan',
        plan,
        wallet: { demoUSD: user.demoUSD, sctBalance: user.sctBalance },
        planExpiresAt: null,
      });
    }

    // Validate payment method
    if (!paymentMethod) {
      return res.status(400).json({ message: 'paymentMethod required: token, stripe, demo_usd or demo_sct' });
    }

    if (paymentMethod === 'demo_usd') {
      const balance = parseFloat((user.demoUSD ?? 0).toFixed(2));
      if (balance < plan.priceUSD) {
        return res.status(402).json({
          message: `Insufficient demo USD. Need $${plan.priceUSD}, you have $${balance.toFixed(2)}`,
        });
      }
      user.demoUSD = parseFloat((balance - plan.priceUSD).toFixed(2));
    } else if (paymentMethod === 'demo_sct' || paymentMethod === 'token') {
      const balance = user.sctBalance ?? 0;
      if (balance < plan.priceSCT) {
        return res.status(402).json({
          message: `Insufficient SCT. Need ${plan.priceSCT} SCT, you have ${balance} SCT`,
        });
      }
      user.sctBalance = balance - plan.priceSCT;
    } else if (paymentMethod === 'stripe') {
      // Stripe payment is confirmed via /confirm-stripe-payment; no wallet deduction here.
    } else {
      return res.status(400).json({ message: 'Invalid paymentMethod. Use token, stripe, demo_usd or demo_sct' });
    }

    user.plan           = planId;
    user.storageQuotaGB = plan.storageGB;
    user.planExpiresAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await user.save();

    console.log(`[Plans] User ${user.email} subscribed to ${plan.name} via ${paymentMethod}`);

    res.json({
      message:      `Subscribed to ${plan.name} plan`,
      plan,
      wallet:       { demoUSD: user.demoUSD, sctBalance: user.sctBalance },
      planExpiresAt: user.planExpiresAt,
    });
  } catch (err) {
    console.error('[Plans] subscribe error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/plans/add-demo-funds — top up demo wallet (testing only)
router.post('/add-demo-funds', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.demoUSD    = parseFloat(((user.demoUSD ?? 0) + 50).toFixed(2));
    user.sctBalance = (user.sctBalance ?? 0) + 100;
    await user.save();
    res.json({ message: 'Added $50 demo USD and 100 SCT', wallet: { demoUSD: user.demoUSD, sctBalance: user.sctBalance } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/plans/create-payment-intent — initialize Stripe payment for plan
router.post('/create-payment-intent', authMiddleware, async (req, res) => {
  const { planId } = req.body || {};
  const plan = PLANS[planId];
  if (!plan || plan.priceUSD <= 0) {
    return res.status(400).json({ message: 'Paid plan is required' });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(503).json({ message: 'Stripe payments are not configured on this server' });
  }

  try {
    const stripe = require('stripe')(STRIPE_SECRET_KEY);
    const amountUSDCents = Math.round(plan.priceUSD * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountUSDCents,
      currency: 'usd',
      metadata: {
        type: 'plan_subscription',
        userId: req.user.id,
        planId,
      },
    });

    const tx = await Transaction.create({
      type: 'purchase',
      buyerId: req.user.id,
      paymentMethod: 'stripe',
      amountUSDCents,
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending',
    });

    res.json({ txId: tx._id, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('[Plans] stripe intent error:', err.message);
    res.status(500).json({ message: 'Failed to initialize Stripe payment' });
  }
});

// POST /api/plans/confirm-stripe-payment — finalize Stripe-backed plan tx
router.post('/confirm-stripe-payment', authMiddleware, async (req, res) => {
  const { txId } = req.body || {};
  if (!txId) return res.status(400).json({ message: 'txId is required' });

  try {
    const tx = await Transaction.findOne({ _id: txId, buyerId: req.user.id, paymentMethod: 'stripe' });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    tx.status = 'completed';
    await tx.save();
    res.json({ message: 'Stripe payment confirmed', txId: tx._id });
  } catch (err) {
    console.error('[Plans] stripe confirm error:', err.message);
    res.status(500).json({ message: 'Failed to confirm Stripe payment' });
  }
});

module.exports = router;
