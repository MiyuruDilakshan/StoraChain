const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/authMiddleware');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';

// @route POST /api/ai/match
// @desc  Get AI-ranked provider recommendations for a storage request
// @access Private
router.post('/match', authMiddleware, async (req, res) => {
  try {
    const providers = Array.isArray(req.body?.providers) ? req.body.providers : [];
    const response = await axios.post(
      `${AI_SERVICE_URL}/score-providers`,
      { providers },
      { timeout: 5000 }
    );
    res.json(response.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'AI service is offline', providers: [], target: AI_SERVICE_URL });
    }
    res.status(500).json({ message: 'AI service error', error: err.message });
  }
});

// @route GET /api/ai/price-estimate
// @desc  Get price estimate for given capacity and region
// @access Private
router.get('/price-estimate', authMiddleware, async (req, res) => {
  try {
    const capacityGB = Number(req.query.capacityGB || 0);
    const providers = Array.isArray(req.query.providers) ? req.query.providers : [];
    const baselinePricePerGB = Number(req.query.baselinePricePerGB || 1);
    const ranked = providers.length
      ? (await axios.post(`${AI_SERVICE_URL}/score-providers`, { providers }, { timeout: 5000 })).data?.ranked || []
      : [];

    const demandMultiplier = capacityGB > 100 ? 1.15 : capacityGB > 10 ? 1.05 : 1;
    const qualityMultiplier = ranked.length ? 1 + ((ranked[0].score || 0.5) - 0.5) * 0.2 : 1;

    res.json({
      estimatedPricePerGB: Number((baselinePricePerGB * demandMultiplier * qualityMultiplier).toFixed(4)),
      demandMultiplier,
      qualityMultiplier,
      rankedProviders: ranked,
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'AI service is offline', target: AI_SERVICE_URL });
    }
    res.status(500).json({ message: 'AI service error', error: err.message });
  }
});

module.exports = router;
