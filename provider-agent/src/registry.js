'use strict';
const axios = require('axios');
const os = require('os');
const path = require('path');

/**
 * Register this agent node with the StoraChain backend.
 * Called once at startup.
 *
 * @param {object} opts
 * @param {string} opts.backendUrl   - e.g. http://localhost:5000
 * @param {string} opts.jwt          - provider's login JWT
 * @param {string} opts.walletAddress
 * @param {number} opts.agentPort
 * @param {number} opts.capacityGB
 * @param {number} opts.pricePerGB
 * @param {string} opts.region
 * @returns {Promise<boolean>} true if registered successfully
 */
async function registerWithBackend({ backendUrl, jwt, walletAddress, agentPort, capacityGB, pricePerGB, region, storageDir }) {
  const agentUrl = `http://localhost:${agentPort}`;
  
  // Gather hardware information
  const cpus = os.cpus();
  const hardware = {
    os: `${os.type()} ${os.release()}`,
    cpu: cpus.length > 0 ? cpus[0].model : 'Unknown',
    cores: cpus.length,
    ramFreeGB: Number((os.freemem() / 1024 ** 3).toFixed(2)),
    ramTotalGB: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
    diskPath: path.resolve(storageDir || './storachain-storage'),
    // IP will be collected by backend using req.ip or req.socket.remoteAddress
  };

  try {
    const res = await axios.post(
      `${backendUrl}/api/providers/register`,
      {
        walletAddress,
        agentUrl,
        capacityGB,
        pricePerGB,
        region,
        hardware
      },
      {
        headers: { Authorization: `Bearer ${jwt}` },
        timeout: 10000,
      }
    );
    console.log('[Agent] Registered with backend:', res.data.message || 'OK');
    return true;
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('[Agent] Registration failed:', msg);
    return false;
  }
}

/**
 * Send a periodic heartbeat to the backend with live stats.
 * Non-fatal — errors are swallowed so the agent keeps running.
 *
 * @param {object} opts
 * @param {string} opts.backendUrl
 * @param {string} opts.jwt
 * @param {import('./storage')} opts.storageManager
 * @param {number} opts.uptimePct  - calculated by caller (default 99.5)
 */
async function sendHeartbeat({ backendUrl, jwt, storageManager, uptimePct = 99.5 }) {
  try {
    const usedGB    = storageManager.getUsedSpaceBytes() / (1024 ** 3);
    const latencyMs = 10 + Math.random() * 20; // simulated RTT in ms

    await axios.put(
      `${backendUrl}/api/providers/heartbeat`,
      {
        usedGB:    parseFloat(usedGB.toFixed(4)),
        latencyMs: parseFloat(latencyMs.toFixed(1)),
        uptimePct,
      },
      {
        headers: { Authorization: `Bearer ${jwt}` },
        timeout: 8000,
      }
    );
  } catch (_) {
    // Heartbeat failure is non-critical — agent keeps serving
  }
}

async function deactivateWithBackend({ backendUrl, jwt }) {
  if (!backendUrl || !jwt) return false;

  try {
    await axios.post(
      `${backendUrl}/api/providers/deactivate`,
      {},
      {
        headers: { Authorization: `Bearer ${jwt}` },
        timeout: 8000,
      }
    );
    return true;
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.warn('[Agent] Deactivation failed:', msg);
    return false;
  }
}

module.exports = { registerWithBackend, sendHeartbeat, deactivateWithBackend };
