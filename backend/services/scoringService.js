/**
 * scoringService.js — Provider ranking for chunk distribution
 *
 * Scoring formula (max 100 pts):
 *   uptimePct      * 0.40  →  40 pts max
 *   latencyScore   * 0.30  →  30 pts max  (latencyScore = clamp(0,100, (1000 - latencyMs) / 10))
 *   reputationScore* 0.15  →  15 pts max
 *   freeSpacePct   * 0.15  →  15 pts max  (freeSpacePct = (capacity - used) / capacity * 100)
 *
 * Tries the Flask AI service first (AI_SERVICE_URL); falls back to the local formula
 * if the AI service is unreachable or returns an error.
 */

const axios = require('axios');
const { estimateSystemPricePerGB } = require('./pricingService');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
const AI_TIMEOUT_MS  = 3000; // give Flask 3 s before falling back

/**
 * Score a single provider using the local formula.
 * @param {object} provider  StorageListing document
 * @returns {number} 0–100
 */
function scoreLocally(provider) {
  const uptimePct      = provider.uptimePct      ?? 100;
  const latencyMs      = provider.latencyMs      ?? 200;
  const reputationScore = provider.reputationScore ?? 50;
  const capacityGB     = provider.capacityGB     || 1;
  const usedGB         = provider.usedGB         || 0;

  const latencyScore = Math.max(0, Math.min(100, (1000 - latencyMs) / 10));
  const freeSpacePct = Math.max(0, (capacityGB - usedGB) / capacityGB * 100);
  const effectivePrice = provider.systemPricePerGB || estimateSystemPricePerGB(provider);
  const priceScore = Math.max(0, Math.min(100, 100 - (effectivePrice * 15)));

  return (
    uptimePct       * 0.36 +
    latencyScore    * 0.28 +
    reputationScore * 0.15 +
    freeSpacePct    * 0.14 +
    priceScore      * 0.07
  );
}

/**
 * Rank an array of providers (StorageListing documents), highest score first.
 * Attempts the Flask AI service for scoring; falls back to local formula on failure.
 *
 * @param {Array} providers  Raw StorageListing documents
 * @returns {Promise<Array>} Sorted array of providers (highest score first)
 */
async function rankProviders(providers) {
  if (!providers || providers.length === 0) return [];

  // Try Flask AI service
  try {
    const payload = {
      providers: providers.map((provider) => ({
        id: provider._id.toString(),
        uptime: provider.uptimePct,
        latencyMs: provider.latencyMs,
        reputationScore: provider.reputationScore,
        capacityGB: Math.max((provider.capacityGB || 0) - (provider.usedGB || 0), 0),
        systemPricePerGB: provider.systemPricePerGB || estimateSystemPricePerGB(provider),
        region: provider.region || 'local',
      })),
    };

    const response = await axios.post(`${AI_SERVICE_URL}/score-providers`, payload, {
      timeout: AI_TIMEOUT_MS,
    });

    // Flask returns: { ranked: [{ id, score, ... }, ...] }
    const scores = response.data?.ranked || [];
    const scoreMap = {};
    for (const entry of scores) {
      scoreMap[entry.id] = entry.score;
    }

    const ranked = [...providers].sort((a, b) =>
      (scoreMap[b._id.toString()] ?? 0) - (scoreMap[a._id.toString()] ?? 0)
    );
    for (const provider of ranked) {
      provider.matchScore = scoreMap[provider._id.toString()] ?? 0;
      provider.matchSource = 'ai';
    }
    console.log('[scoringService] Scored via Flask AI service');
    return ranked;

  } catch (err) {
    // Flask unavailable — use local formula silently (will be available April 29)
    if (err.code !== 'ECONNREFUSED' && err.code !== 'ECONNRESET' && !err.message.includes('timeout')) {
      console.warn('[scoringService] AI service error, using local formula:', err.message);
    }
  }

  // Local fallback
  const ranked = [...providers].sort((a, b) => scoreLocally(b) - scoreLocally(a));
  for (const provider of ranked) {
    provider.matchScore = scoreLocally(provider);
    provider.matchSource = 'local';
  }
  return ranked;
}

module.exports = { rankProviders, scoreLocally };
