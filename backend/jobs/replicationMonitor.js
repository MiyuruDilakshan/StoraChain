/**
 * replicationMonitor.js — Hourly chunk replication health monitor
 *
 * Schedule: every REPLICATION_INTERVAL_MINUTES minutes (default 60).
 * Set REPLICATION_INTERVAL_MINUTES=2 in .env to test locally.
 *
 * What it does each run:
 *   1. Health-check every active provider agent via GET /health
 *   2. Mark unreachable providers as inactive in MongoDB
 *   3. For each file chunk whose primary or replica is on a dead provider,
 *      copy the chunk from the surviving source to a healthy provider
 *   4. Update FileRecord with the new providerUrl / replicaProviderUrl
 *   5. Log each action to ReplicationLog
 */

const cron = require('node-cron');
const axios = require('axios');
const FileRecord = require('../models/FileRecord');
const StorageListing = require('../models/StorageListing');
const ReplicationLog = require('../models/ReplicationLog');

const AGENT_KEY   = process.env.BACKEND_AGENT_KEY || 'agent-secret-key';
const INTERVAL    = parseInt(process.env.REPLICATION_INTERVAL_MINUTES || '60', 10);

/**
 * Main replication health-check function.
 * Exported so server.js or a dev route can trigger it manually.
 */
async function checkReplication() {
  console.log('[ReplicationMonitor] Starting health check...');

  try {
    // 1. Health-check all active providers
    const providers = await StorageListing.find({}); // check all, not just isActive
    const healthMap = {}; // agentUrl → boolean

    await Promise.all(providers.map(async (p) => {
      try {
        await axios.get(`${p.agentUrl}/health`, { timeout: 5000 });
        healthMap[p.agentUrl] = true;
        // Re-activate if it was previously marked down
        if (!p.isActive) {
          await StorageListing.findByIdAndUpdate(p._id, { isActive: true });
          console.log(`[ReplicationMonitor] Provider back online: ${p.agentUrl}`);
        }
      } catch {
        healthMap[p.agentUrl] = false;
        if (p.isActive) {
          await StorageListing.findByIdAndUpdate(p._id, { isActive: false });
          console.warn(`[ReplicationMonitor] Provider offline, marked inactive: ${p.agentUrl}`);
        }
      }
    }));

    const healthyProviders = providers.filter(p => healthMap[p.agentUrl] === true);
    console.log(`[ReplicationMonitor] ${healthyProviders.length}/${providers.length} providers healthy`);

    // 2. Scan all non-deleted files for under-replicated chunks
    const files = await FileRecord.find({ isDeleted: false });
    let repaired = 0;
    let failed = 0;

    for (const file of files) {
      let fileModified = false;

      for (const chunk of file.chunks) {
        const primaryOk = !chunk.providerUrl || healthMap[chunk.providerUrl] !== false;
        const replicaOk = !chunk.replicaProviderUrl || healthMap[chunk.replicaProviderUrl] !== false;

        if (primaryOk && replicaOk) continue;

        // Determine surviving source URL
        const sourceUrl =
          (chunk.providerUrl && healthMap[chunk.providerUrl] === true)   ? chunk.providerUrl :
          (chunk.replicaProviderUrl && healthMap[chunk.replicaProviderUrl] === true) ? chunk.replicaProviderUrl :
          null;

        if (!sourceUrl) {
          await ReplicationLog.create({
            fileId:  file._id,
            chunkId: chunk.chunkId,
            status:  'failed',
            reason:  'Both primary and replica are unreachable',
          });
          failed++;
          continue;
        }

        // Find a healthy provider that doesn't already hold this chunk
        const target = healthyProviders.find(p =>
          p.agentUrl !== chunk.providerUrl &&
          p.agentUrl !== chunk.replicaProviderUrl
        );

        if (!target) {
          await ReplicationLog.create({
            fileId:  file._id,
            chunkId: chunk.chunkId,
            status:  'skipped',
            reason:  'No spare healthy provider available for re-replication',
          });
          continue;
        }

        try {
          // Fetch chunk from surviving source
          const fetchRes = await axios.get(`${sourceUrl}/chunk/${chunk.chunkId}`, {
            headers:      { 'x-agent-key': AGENT_KEY },
            responseType: 'arraybuffer',
            timeout:      30000,
          });
          const chunkBuffer = Buffer.from(fetchRes.data);

          // Push to new target
          await axios.post(`${target.agentUrl}/chunk`, chunkBuffer, {
            headers: {
              'x-chunk-id':   chunk.chunkId,
              'x-agent-key':  AGENT_KEY,
              'Content-Type': 'application/octet-stream',
            },
            timeout: 30000,
          });

          // Update chunk record
          const wasTargetPrimary = healthMap[chunk.providerUrl] === false;
          if (wasTargetPrimary) {
            chunk.providerUrl = target.agentUrl;
          } else {
            chunk.replicaProviderUrl = target.agentUrl;
          }
          fileModified = true;

          await ReplicationLog.create({
            fileId:  file._id,
            chunkId: chunk.chunkId,
            fromUrl: sourceUrl,
            toUrl:   target.agentUrl,
            status:  'success',
          });

          console.log(`[ReplicationMonitor] Re-replicated chunk ${chunk.chunkId}: ${sourceUrl} → ${target.agentUrl}`);
          repaired++;

        } catch (e) {
          await ReplicationLog.create({
            fileId:  file._id,
            chunkId: chunk.chunkId,
            fromUrl: sourceUrl,
            toUrl:   target ? target.agentUrl : '',
            status:  'failed',
            reason:  e.message,
          });
          failed++;
        }
      }

      if (fileModified) await file.save();
    }

    console.log(`[ReplicationMonitor] Done. Repaired: ${repaired}, Failed: ${failed}`);
    return {
      ok: true,
      checkedFiles: files.length,
      repaired,
      failed,
      healthyProviders: healthyProviders.length,
      totalProviders: providers.length,
      runAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[ReplicationMonitor] Unexpected error:', err.message);
    return {
      ok: false,
      error: err.message,
      runAt: new Date().toISOString(),
    };
  }
}

// Schedule — cron expression: "*/N * * * *"  (every N minutes)
const cronExpression = `*/${INTERVAL} * * * *`;
cron.schedule(cronExpression, checkReplication);
console.log(`[ReplicationMonitor] Scheduled every ${INTERVAL} minute(s)`);

module.exports = { checkReplication };
