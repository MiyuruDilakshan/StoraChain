/**
 * pricingService.js
 *
 * System-side pricing estimate for provider storage economics.
 * Providers can suggest values, but this service computes the effective
 * price used by selection/reward logic so providers cannot self-set pricing.
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function estimateSystemPricePerGB(listingLike = {}) {
  const capacityGB = Number(listingLike.capacityGB || 0);
  const usedGB = Number(listingLike.usedGB || 0);
  const uptimePct = Number(listingLike.uptimePct ?? 100);
  const latencyMs = Number(listingLike.latencyMs ?? 50);
  const reputationScore = Number(listingLike.reputationScore ?? 70);
  const region = String(listingLike.region || 'local').toLowerCase();

  const fillRatio = capacityGB > 0 ? clamp(usedGB / capacityGB, 0, 1) : 0;
  const scarcityMultiplier = 1 + (fillRatio * 0.3);

  const uptimePenalty = uptimePct < 95 ? (1 + ((95 - uptimePct) / 100)) : 1;
  const latencyPenalty = latencyMs > 80 ? (1 + ((latencyMs - 80) / 1000)) : 1;
  const reputationDiscount = reputationScore > 80 ? (1 - ((reputationScore - 80) / 1000)) : 1;

  const regionFactorMap = {
    'us-east': 1.02,
    'us-west': 1.03,
    'eu': 1.04,
    'eu-west': 1.04,
    'asia': 1.06,
    'ap-south': 1.06,
    'local': 1.0,
  };
  const regionMultiplier = regionFactorMap[region] || 1.03;

  const basePrice = 1.0;
  const estimated = basePrice * scarcityMultiplier * uptimePenalty * latencyPenalty * reputationDiscount * regionMultiplier;

  return Number(clamp(estimated, 0.25, 5).toFixed(4));
}

module.exports = { estimateSystemPricePerGB };
