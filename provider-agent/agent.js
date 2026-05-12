#!/usr/bin/env node
'use strict';
require('dotenv').config();

const StorageManager                  = require('./src/storage');
const IntegrityMonitor                = require('./src/integrity');
const createAgentServer               = require('./src/server');
const { registerWithBackend, sendHeartbeat, deactivateWithBackend, pollChunkQueue } = require('./src/registry');

// ── Argument parsing ──────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(flag, defaultVal) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : defaultVal;
}

function getFlag(flag) {
  return args.includes(flag);
}

if (getFlag('--help') || getFlag('-h')) {
  console.log(`
StoraChain Provider Agent v1.1.0

Usage:
  node agent.js [options]

Options:
  --port    <number>   Port for the agent HTTP server         (default: 3001)
  --space   <number>   Storage capacity to offer in GB        (default: 10)
  --wallet  <address>  Your Ethereum wallet address           (optional)
  --price   <number>   Price per GB per day in SCT tokens     (default: 1)
  --region  <string>   Geographic region label e.g. EU, US   (default: local)
  --dir     <path>     Directory to store chunks              (default: ./storachain-storage)
  --backend <url>      StoraChain backend URL                 (default: https://api.storachain.miyuru.dev)
  --uninstall          Delete local chunks and deactivate provider
  --help               Show this help message
  `);
  process.exit(0);
}

// ── Configuration ──────────────────────────────────────────────────
const PORT         = parseInt(getArg('--port',    '0'));
const SPACE_GB     = parseFloat(getArg('--space', process.env.SPACE_GB || '10'));
const WALLET       = getArg('--wallet',   null) || process.env.WALLET_ADDRESS || '';
const PRICE_PER_GB = parseFloat(getArg('--price', process.env.PRICE_PER_GB || '1'));
const REGION       = getArg('--region',   process.env.REGION       || 'local');
const BACKEND_URL  = getArg('--backend',  process.env.BACKEND_URL  || 'https://api.storachain.miyuru.dev');
const AGENT_JWT    = process.env.AGENT_JWT || '';
const AGENT_KEY    = process.env.BACKEND_AGENT_KEY || 'agent-secret-key';
const STORAGE_DIR  = getArg('--dir', process.env.STORAGE_DIR || './storachain-storage');
const SHOULD_UNINSTALL = getFlag('--uninstall');

if (isNaN(PORT) || PORT < 0 || PORT > 65535) {
  console.error(`[Agent] ERROR: Invalid port ${PORT}. Must be between 0-65535.`);
  process.exit(1);
}

if (SPACE_GB < 0) {
  console.error('[Agent] ERROR: --space cannot be negative');
  process.exit(1);
}

// ── Dynamic port finder ───────────────────────────────────────────
const net = require('net');
function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', () => resolve(findAvailablePort(startPort + 1)));
  });
}

// ── Banner ────────────────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║       StoraChain Provider Agent          ║');
console.log('║              v1.1.0                      ║');
console.log('╚══════════════════════════════════════════╝');
console.log(`  Port     : ${PORT === 0 ? 'Dynamic (starting at 3001)' : PORT}`);
console.log(`  Space    : ${SPACE_GB} GB`);
console.log(`  Price    : ${PRICE_PER_GB} SCT/GB`);
console.log(`  Wallet   : ${WALLET || '(not set)'}`);
console.log(`  Region   : ${REGION}`);
console.log(`  Backend  : ${BACKEND_URL}`);
console.log(`  Storage  : ${STORAGE_DIR}`);
console.log(`  Auth     : ${AGENT_JWT ? '✓ JWT present — will auto-register' : '✗ No JWT (registration skipped)'}`);
console.log('');

// ── Init storage + integrity monitor ──────────────────────────────
const storage   = new StorageManager(STORAGE_DIR, SPACE_GB);
const integrity = new IntegrityMonitor(storage);

// Wire integrity monitor into StorageManager so checksum is recorded on every chunk write
StorageManager.setIntegrityMonitor(integrity);

storage.init();

// Load persisted chunk checksums (so reboots don't lose them)
integrity.loadCacheFromDisk();

// ── Uninstall mode ────────────────────────────────────────────────
async function runUninstall() {
  console.log('[Agent] Uninstall mode: deleting local chunks and releasing reserved space...');
  try { storage.wipeAllChunks(); } catch (e) { console.warn('[Agent] wipeAllChunks:', e.message); }
  try { storage.releaseReservation(); } catch (e) { console.warn('[Agent] releaseReservation:', e.message); }
  if (AGENT_JWT) {
    console.log('[Agent] Deactivating listing on backend...');
    await deactivateWithBackend({ backendUrl: BACKEND_URL, jwt: AGENT_JWT });
  }
  console.log('[Agent] ✓ Uninstall complete. Reserved space released.');
  process.exit(0);
}

if (SHOULD_UNINSTALL) {
  runUninstall().catch((err) => {
    console.error('[Agent] Uninstall failed:', err.message);
    process.exit(1);
  });
  return; // stop here in uninstall mode
}

// ── Uptime tracking ───────────────────────────────────────────────
let totalTicks  = 0;
let onlineTicks = 0;
function uptimePct() {
  if (totalTicks === 0) return 100;
  return parseFloat(((onlineTicks / totalTicks) * 100).toFixed(1));
}

// ── Main start ────────────────────────────────────────────────────
async function start() {
  // Pick port dynamically if PORT === 0
  const finalPort = PORT === 0 ? await findAvailablePort(3001) : PORT;
  if (PORT === 0) console.log(`[Agent] Dynamic port selected: ${finalPort}`);

  const server = createAgentServer(storage, AGENT_KEY);

  server.listen(finalPort, async () => {
    console.log(`[Agent] HTTP Server listening on port ${finalPort}`);

    // ── Auto-register with backend if JWT is present ──
    if (AGENT_JWT) {
      console.log('[Agent] Auto-registering with backend...');
      try {
        const result = await registerWithBackend({
          backendUrl:    BACKEND_URL,
          jwt:           AGENT_JWT,
          agentPort:     finalPort,
          capacityGB:    SPACE_GB,
          region:        REGION,
          walletAddress: WALLET,
          storageDir:    STORAGE_DIR,
        });
        if (result) {
          console.log('[Agent] ✓ Registered with backend successfully!');
        } else {
          console.warn('[Agent] ✗ Registration returned false — check backend logs.');
        }
      } catch (err) {
        console.error('[Agent] ✗ Registration error:', err.message);
      }

      // ── Start periodic heartbeats every 30s with integrity check ──
      setInterval(async () => {
        totalTicks++;
        try {
          await sendHeartbeat({
            backendUrl:       BACKEND_URL,
            jwt:              AGENT_JWT,
            storageManager:   storage,
            integrityMonitor: integrity,
            uptimePct:        uptimePct(),
          });
          onlineTicks++;
        } catch (_) { /* heartbeat failure is non-critical */ }
      }, 30000);

      // ── Poll chunk queue every 5s (NAT bypass for home-PC providers) ──
      setInterval(() => {
        pollChunkQueue({ backendUrl: BACKEND_URL, jwt: AGENT_JWT, storageManager: storage });
      }, 5000);

    } else {
      console.log('[Agent] No JWT found — running in standalone mode (no backend registration).');
      console.log('[Agent] To register, set AGENT_JWT in .env and restart.');
    }

    console.log('[Agent] ✓ Ready. Integrity monitoring active.\n');
  });
}

start().catch(err => {
  console.error('[Agent] FATAL ERROR:', err.message);
  process.exit(1);
});

// ── Graceful shutdown ────────────────────────────────────────────
let shuttingDown = false;
async function shutdown(signalName) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[Agent] Received ${signalName} — shutting down gracefully...`);
  if (AGENT_JWT) {
    try {
      await deactivateWithBackend({ backendUrl: BACKEND_URL, jwt: AGENT_JWT });
      console.log('[Agent] ✓ Deactivated listing on backend.');
    } catch (e) {
      console.error('[Agent] Deactivation failed during shutdown:', e.message);
    }
  }
  console.log('[Agent] Goodbye.');
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[Agent] Uncaught exception:', err.message);
});
