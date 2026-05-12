'use strict';
/**
 * StoraChain Provider Penalty Service
 *
 * Processes integrity reports sent by provider agents on each heartbeat.
 * Applies reputation penalties and suspensions as appropriate.
 *
 * Penalty table:
 *   RESERVATION_MISSING  → 15 pts (severe)
 *   RESERVATION_SHRUNK   → 10 pts (moderate)
 *   CHUNK_TAMPERED       → 20 pts (critical)
 *   CHUNK_MISSING        → 5  pts (moderate — may be transient)
 *   NODE_OFFLINE_MISS    → 3  pts per consecutive missed heartbeat
 *
 * Suspension threshold: penaltyPoints >= 50 → suspend until manually reviewed
 * Reputation decay from violations: reputationScore -= (violationPoints * 0.3)
 * Reputation recovery: +1 / clean heartbeat, max 100
 */

const PENALTY_TABLE = {
  RESERVATION_MISSING: 15,
  RESERVATION_SHRUNK:  10,
  CHUNK_TAMPERED:      20,
  CHUNK_MISSING:        5,
  NODE_OFFLINE_MISS:    3,
};

const SUSPENSION_THRESHOLD = 50;
const HEARTBEAT_TIMEOUT_MS = 90 * 1000; // 90 seconds (3 × 30s heartbeat interval)

/**
 * Process an incoming integrity report from a heartbeat.
 *
 * @param {import('../models/StorageListing')} listing   - Mongoose document
 * @param {object|null} integrityReport                  - from agent heartbeat
 */
async function processIntegrityReport(listing, integrityReport) {
  if (!integrityReport) return; // agent didn't send a report (old version)

  listing.lastIntegrityCheck = new Date();
  listing.lastHeartbeatAt    = new Date();
  listing.consecutiveMisses  = 0; // reset miss counter on successful heartbeat

  // Update disk stats in hardware
  if (integrityReport.diskFreeGB  !== undefined) listing.hardware.diskFreeGB  = integrityReport.diskFreeGB;
  if (integrityReport.diskTotalGB !== undefined) listing.hardware.diskTotalGB = integrityReport.diskTotalGB;

  listing.integrityHealthy = integrityReport.healthy;

  if (integrityReport.healthy) {
    // Clean heartbeat — recover reputation slightly
    listing.reputationScore = Math.min(100, listing.reputationScore + 0.5);
    return;
  }

  // ── Apply penalties for each violation ──────────────────────────────────
  for (const violation of (integrityReport.violations || [])) {
    const pts = PENALTY_TABLE[violation.type] || 2;

    listing.penaltyPoints += pts;
    listing.totalViolations++;
    listing.reputationScore = Math.max(0, listing.reputationScore - (pts * 0.3));

    listing.penaltyHistory.push({
      reason:    `${violation.type}: ${violation.detail}`,
      points:    pts,
      appliedAt: new Date(),
    });

    // Keep only last 50 penalty events
    if (listing.penaltyHistory.length > 50) listing.penaltyHistory.splice(0, listing.penaltyHistory.length - 50);

    // Store violation in integrityViolations (keep last 20)
    listing.integrityViolations.push({
      type:       violation.type,
      detail:     violation.detail,
      detectedAt: new Date(),
    });
    if (listing.integrityViolations.length > 20) {
      listing.integrityViolations.splice(0, listing.integrityViolations.length - 20);
    }

    console.warn(`[Penalty] Provider ${listing.providerId} — ${violation.type} (+${pts} pts, total: ${listing.penaltyPoints})`);
  }

  // ── Suspension check ─────────────────────────────────────────────────────
  if (!listing.isSuspended && listing.penaltyPoints >= SUSPENSION_THRESHOLD) {
    listing.isSuspended      = true;
    listing.isActive         = false;
    listing.isPaused         = true;
    listing.suspendedAt      = new Date();
    listing.suspensionReason = `Automatic suspension: penalty points reached ${listing.penaltyPoints}`;
    console.error(`[Penalty] Provider ${listing.providerId} SUSPENDED — penalty points: ${listing.penaltyPoints}`);
  }
}

/**
 * Called by a background job every 60 seconds to detect silent offline providers.
 * Applies NODE_OFFLINE_MISS penalties for providers whose last heartbeat is overdue.
 *
 * @param {import('../models/StorageListing')} StorageListing - the Mongoose model
 */
async function applyOfflinePenalties(StorageListing) {
  try {
    const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
    const staleProviders = await StorageListing.find({
      isActive: true,
      isPaused: false,
      isSuspended: false,
      lastHeartbeatAt: { $lt: cutoff },
    });

    for (const listing of staleProviders) {
      listing.consecutiveMisses = (listing.consecutiveMisses || 0) + 1;

      // Mark as inactive after 3 consecutive misses (90 s each = 4.5 min window)
      if (listing.consecutiveMisses >= 3) {
        listing.isActive = false;
        listing.integrityHealthy = false;
        listing.reputationScore  = Math.max(0, listing.reputationScore - 1);
        console.warn(`[Penalty] Provider ${listing.providerId} offline — ${listing.consecutiveMisses} missed heartbeats`);
      }

      // Apply NODE_OFFLINE_MISS penalty (capped to avoid over-punishing transient issues)
      if (listing.consecutiveMisses <= 10) {
        const pts = PENALTY_TABLE.NODE_OFFLINE_MISS;
        listing.penaltyPoints += pts;
        listing.penaltyHistory.push({ reason: 'NODE_OFFLINE_MISS', points: pts, appliedAt: new Date() });
      }

      if (!listing.isSuspended && listing.penaltyPoints >= SUSPENSION_THRESHOLD) {
        listing.isSuspended      = true;
        listing.isActive         = false;
        listing.isPaused         = true;
        listing.suspendedAt      = new Date();
        listing.suspensionReason = `Automatic suspension: repeated offline (${listing.consecutiveMisses} misses, ${listing.penaltyPoints} pts)`;
      }

      await listing.save();
    }
  } catch (e) {
    console.error('[Penalty] applyOfflinePenalties error:', e.message);
  }
}

/**
 * Manually reset penalties for a provider (admin action).
 */
async function resetProviderPenalties(listing) {
  listing.penaltyPoints      = 0;
  listing.isSuspended        = false;
  listing.suspendedAt        = undefined;
  listing.suspensionReason   = undefined;
  listing.consecutiveMisses  = 0;
  listing.integrityViolations = [];
  listing.reputationScore    = Math.max(listing.reputationScore, 60); // restore to at least 60
  listing.isActive           = true;
  listing.isPaused           = false;
}

module.exports = { processIntegrityReport, applyOfflinePenalties, resetProviderPenalties };
