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
  // Gather hardware information
  let osName = os.type();
  const osRelease = os.release();
  let osDisplay = '';
  if (osName === 'Windows_NT') {
    const build = parseInt(osRelease.split('.')[2] || '0');
    if (build >= 22000) osDisplay = `Windows 11 (Build ${build})`;
    else osDisplay = `Windows 10 (Build ${build})`;
  } else if (osName === 'Darwin') {
    osDisplay = `macOS ${osRelease}`;
  } else {
    osDisplay = `${osName} ${osRelease}`;
  }

  // Fetch Public IP — used as agentUrl so backend can reach VPS providers
  let publicIp = null;
  // If backend is running locally, we must register as localhost to avoid NAT hairpin issues
  const isLocalBackend = backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');

  if (!isLocalBackend) {
    try {
      const ipRes = await axios.get('https://api.ipify.org?format=json', { timeout: 4000 });
      publicIp = ipRes.data.ip;
    } catch (e) {
      // Fallback to first non-internal network interface
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            publicIp = net.address;
            break;
          }
        }
        if (publicIp) break;
      }
    }
  }

  // agentUrl must be reachable BY THE BACKEND
  const agentHost = publicIp || 'localhost';
  const agentUrl = `http://${agentHost}:${agentPort}`;

  const cpus = os.cpus();
  const hardware = {
    os: osDisplay,
    cpu: cpus.length > 0 ? cpus[0].model : 'Unknown',
    cores: cpus.length,
    ramFreeGB: Number((os.freemem() / 1024 ** 3).toFixed(2)),
    ramTotalGB: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
    diskPath: path.resolve(storageDir || './storachain-storage'),
    ip: agentHost,
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
 * Send a periodic heartbeat to the backend with live stats + integrity report.
 * Non-fatal — errors are swallowed so the agent keeps running.
 *
 * @param {object} opts
 * @param {string} opts.backendUrl
 * @param {string} opts.jwt
 * @param {import('./storage')} opts.storageManager
 * @param {import('./integrity')} opts.integrityMonitor
 * @param {number} opts.uptimePct
 */
async function sendHeartbeat({ backendUrl, jwt, storageManager, integrityMonitor, uptimePct = 99.5 }) {
  try {
    const usedGB    = storageManager.getUsedSpaceBytes() / (1024 ** 3);
    const latencyMs = 10 + Math.random() * 20; // simulated RTT in ms

    // Run integrity check each heartbeat
    let integrityReport = null;
    if (integrityMonitor) {
      try {
        integrityReport = await integrityMonitor.runCheck();
        integrityMonitor.saveCacheToDisk();
      } catch (ie) {
        console.warn('[Heartbeat] Integrity check error:', ie.message);
      }
    }

    const res = await axios.put(
      `${backendUrl}/api/providers/heartbeat`,
      {
        usedGB:          parseFloat(usedGB.toFixed(4)),
        latencyMs:       parseFloat(latencyMs.toFixed(1)),
        uptimePct,
        integrityReport,
      },
      {
        headers: { Authorization: `Bearer ${jwt}` },
        timeout: 8000,
      }
    );

    // ── Dynamic Config Sync ──────────────────────────────────────────────────
    if (res.data?.config) {
      const { capacityGB, diskPath, walletAddress } = res.data.config;
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env');
      
      let changed = false;
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        if (capacityGB !== undefined && capacityGB !== parseFloat(process.env.SPACE_GB)) {
          envContent = envContent.replace(/^SPACE_GB=.*$/m, `SPACE_GB=${capacityGB}`);
          changed = true;
        }
        if (diskPath !== undefined && diskPath !== process.env.STORAGE_DIR) {
          envContent = envContent.replace(/^STORAGE_DIR=.*$/m, `STORAGE_DIR=${diskPath.replace(/\\/g, '\\\\')}`);
          changed = true;
        }
        if (walletAddress !== undefined && walletAddress !== process.env.WALLET_ADDRESS) {
          envContent = envContent.replace(/^WALLET_ADDRESS=.*$/m, `WALLET_ADDRESS=${walletAddress}`);
          changed = true;
        }
        
        if (changed) {
          fs.writeFileSync(envPath, envContent);
          console.log('\n[Agent] Configuration updated from dashboard. Restarting to apply changes...\n');
          process.exit(0); // PM2 will automatically restart it and read new .env
        }
      }
    }

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
