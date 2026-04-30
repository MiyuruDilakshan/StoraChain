import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVIDER_HOME = path.join(os.homedir(), '.storachain-provider');
const CONFIG_FILE = path.join(PROVIDER_HOME, 'config.json');
const PORT = process.env.PROVIDER_PORT || 3002;

const app = express();
app.use(express.json());

let providerConfig = null;

async function getDiskStats(targetPath) {
  const stats = await fs.statfs(targetPath);
  const blockSize = Number(stats.bsize || 0);
  const freeBlocks = Number(stats.bavail || stats.bfree || 0);
  const totalBlocks = Number(stats.blocks || 0);
  const total = blockSize * totalBlocks;
  const available = blockSize * freeBlocks;
  const used = Math.max(0, total - available);
  return { total, available, used };
}

// Load Config
async function loadConfig() {
  try {
    providerConfig = await fs.readJSON(CONFIG_FILE);
    console.log('✓ Config loaded');
  } catch (error) {
    console.error('Failed to load config:', error.message);
    process.exit(1);
  }
}

// Heartbeat - Send status to backend every 30 seconds
setInterval(async () => {
  if (!providerConfig) return;

  try {
    const hddStats = await getDiskStats(providerConfig.hdd.path);
    const status = {
      providerId: providerConfig.providerId,
      machineId: providerConfig.machineId,
      status: providerConfig.status,
      hdd: {
        totalGB: providerConfig.hdd.totalGB,
        freeGB: Math.floor(hddStats.available / (1024 ** 3)),
        usedGB: Math.floor(hddStats.used / (1024 ** 3)),
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    await axios.post(`${providerConfig.backendUrl}/api/providers/cli/heartbeat`, status);
  } catch (error) {
    console.error('[Heartbeat] Error:', error.message);
  }
}, 30000);

// Local API - Get Provider Status
app.get('/status', async (req, res) => {
  try {
    if (!providerConfig) {
      return res.status(400).json({ error: 'Not configured' });
    }

    const hddStats = await getDiskStats(providerConfig.hdd.path);
    return res.json({
      providerId: providerConfig.providerId,
      email: providerConfig.email,
      walletAddress: providerConfig.walletAddress,
      status: providerConfig.status,
      hdd: {
        path: providerConfig.hdd.path,
        totalGB: providerConfig.hdd.totalGB,
        freeGB: Math.floor(hddStats.available / (1024 ** 3)),
        usedGB: Math.floor(hddStats.used / (1024 ** 3)),
        percentFull: Math.round((hddStats.used / hddStats.total) * 100),
      },
      device: {
        hostname: os.hostname(),
        platform: process.platform,
        cpus: os.cpus().length,
        memory: {
          totalMB: Math.round(os.totalmem() / (1024 ** 2)),
          freeMB: Math.round(os.freemem() / (1024 ** 2)),
        },
        ip: getLocalIP(),
      },
      uptime: Math.round(process.uptime()),
      createdAt: providerConfig.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Go Online - Push provider status to "online"
app.post('/go-online', async (req, res) => {
  try {
    if (!providerConfig) {
      return res.status(400).json({ error: 'Not configured' });
    }

    // Notify backend
    const response = await axios.post(`${providerConfig.backendUrl}/api/providers/cli/${providerConfig.providerId}/go-online`, {
      hddTotalGB: providerConfig.hdd.totalGB,
      walletAddress: providerConfig.walletAddress,
    });

    // Update local config
    providerConfig.status = 'online';
    await fs.writeJSON(CONFIG_FILE, providerConfig, { spaces: 2 });

    res.json({ success: true, message: 'Provider is now online', data: response.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Go Offline
app.post('/go-offline', async (req, res) => {
  try {
    providerConfig.status = 'offline';
    await fs.writeJSON(CONFIG_FILE, providerConfig, { spaces: 2 });

    await axios.post(`${providerConfig.backendUrl}/api/providers/cli/${providerConfig.providerId}/go-offline`);

    res.json({ success: true, message: 'Provider is now offline' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Start Server
async function start() {
  await loadConfig();

  app.listen(PORT, () => {
    console.log(`📡 StoraChain Provider Service running on port ${PORT}`);
    console.log(`📍 Provider Home: ${PROVIDER_HOME}`);
    console.log(`🔗 Backend: ${providerConfig.backendUrl}`);
  });
}

start().catch(error => {
  console.error('Failed to start service:', error.message);
  process.exit(1);
});
