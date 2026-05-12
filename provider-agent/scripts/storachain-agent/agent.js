#!/usr/bin/env node
'use strict';
require('dotenv').config();

const StorageManager                  = require('./src/storage');
const createAgentServer               = require('./src/server');
const { registerWithBackend, sendHeartbeat, deactivateWithBackend } = require('./src/registry');

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
StoraChain Provider Agent v1.0.0

Usage:
  node agent.js [options]

Options:
  --port    <number>   Port for the agent HTTP server         (default: 3001)
  --space   <number>   Storage capacity to offer in GB        (default: 10)
  --wallet  <address>  Your Ethereum wallet address           (required)
  --price   <number>   Price per GB per day in SCT tokens     (default: 1)
  --region  <string>   Geographic region label e.g. EU, US   (default: local)
  --dir     <path>     Directory to store chunks              (default: ./storachain-storage)
  --backend <url>      StoraChain backend URL                 (default: https://api.storachain.miyuru.dev)
  --uninstall          Delete local chunks, release reserved space, and deactivate provider
  --help               Show this help message

Environment variables (.env):
  WALLET_ADDRESS      Your Ethereum wallet address
  AGENT_JWT           JWT token from your StoraChain login (for auto-register)
  BACKEND_URL         StoraChain backend URL
  BACKEND_AGENT_KEY   Shared secret key for backend→agent authentication
  PRICE_PER_GB        Default price per GB in SCT

Example:
  node agent.js --space 20 --port 3001 --wallet 0xYourAddress --region EU
  `);
  process.exit(0);
}

// ── Configuration ──────────────────────────────────────────────────
const PORT         = parseInt(getArg('--port',    '3001'));
const SPACE_GB     = parseFloat(getArg('--space', '10'));
const WALLET       = getArg('--wallet',   null) || process.env.WALLET_ADDRESS || '';
const PRICE_PER_GB = parseFloat(getArg('--price', process.env.PRICE_PER_GB || '1'));
const REGION       = getArg('--region',   process.env.REGION       || 'local');
const BACKEND_URL  = getArg('--backend',  process.env.BACKEND_URL  || 'https://api.storachain.miyuru.dev');
const AGENT_JWT    = process.env.AGENT_JWT || '';
const AGENT_KEY    = process.env.BACKEND_AGENT_KEY || 'agent-secret-key';
const STORAGE_DIR  = getArg('--dir', process.env.STORAGE_DIR || './storachain-storage');
const SHOULD_UNINSTALL = getFlag('--uninstall');

// ── Validate required args ────────────────────────────────────────
if (!WALLET && !SHOULD_UNINSTALL) {
  console.error('\n[Agent] ERROR: Wallet address is required.');
  console.error('[Agent] Usage: node agent.js --wallet 0xYourAddress --space 20\n');
  process.exit(1);
}

if (isNaN(PORT) || PORT < 1024 || PORT > 65535) {
  console.error(`[Agent] ERROR: Invalid port ${PORT}. Must be between 1024-65535.`);
  process.exit(1);
}

if (SPACE_GB <= 0) {
  console.error('[Agent] ERROR: --space must be greater than 0');
  process.exit(1);
}

// ── Banner ────────────────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║       StoraChain Provider Agent          ║');
console.log('║              v1.0.0                      ║');
console.log('╚══════════════════════════════════════════╝');
console.log(`  Port     : ${PORT}`);
console.log(`  Space    : ${SPACE_GB} GB`);
console.log(`  Price    : ${PRICE_PER_GB} SCT/GB`);
console.log(`  Wallet   : ${WALLET}`);
console.log(`  Region   : ${REGION}`);
console.log(`  Backend  : ${BACKEND_URL}`);
console.log(`  Storage  : ${STORAGE_DIR}`);
console.log(`  Auth key : ${AGENT_JWT ? '✓ JWT present' : '✗ No JWT (registration skipped)'}`);
console.log('');

// ── Init storage ──────────────────────────────────────────────────
const storage = new StorageManager(STORAGE_DIR, SPACE_GB);
storage.init();

async function runUninstall() {
  console.log('[Agent] Uninstall mode: deleting local chunks and releasing reserved space...');
  storage.wipeAllChunks();
  storage.releaseReservation();
  if (AGENT_JWT) {
    await deactivateWithBackend({ backendUrl: BACKEND_URL, jwt: AGENT_JWT });
  }
  console.log('[Agent] Uninstall complete. Reserved space released.');
  process.exit(0);
}

if (SHOULD_UNINSTALL) {
  runUninstall().catch((err) => {
    console.error('[Agent] Uninstall failed:', err.message);
    process.exit(1);
  });
}

// ── Uptime tracking ───────────────────────────────────────────────
const startTime = Date.now();
let totalTicks   = 0;
let onlineTicks  = 0;

function uptimePct() {
  if (totalTicks === 0) return 100;
  return parseFloat(((onlineTicks / totalTicks) * 100).toFixed(1));
}

// ── Start HTTP server ─────────────────────────────────────────────
const app = createAgentServer(storage, AGENT_KEY);

const httpServer = app.listen(PORT, async () => {
  console.log(`[Agent] HTTP server listening on port ${PORT}`);
  console.log(`[Agent] Health check: http://localhost:${PORT}/health`);
  console.log('');

  // Register with backend if JWT is available
  if (AGENT_JWT) {
    const ok = await registerWithBackend({
      backendUrl:    BACKEND_URL,
      jwt:           AGENT_JWT,
      walletAddress: WALLET,
      agentPort:     PORT,
      capacityGB:    SPACE_GB,
      pricePerGB:    PRICE_PER_GB,
      region:        REGION,
      storageDir:    STORAGE_DIR,
    });

    if (ok) {
      console.log('[Agent] Auto-registration succeeded. Starting heartbeat (every 30s)...');
      onlineTicks++;
      totalTicks++;

      // Periodic heartbeat
      setInterval(() => {
        onlineTicks++;
        totalTicks++;
        sendHeartbeat({
          backendUrl:     BACKEND_URL,
          jwt:            AGENT_JWT,
          storageManager: storage,
          uptimePct:      uptimePct(),
        });
      }, 30_000);
    } else {
      console.log('[Agent] Registration failed. Agent still serving chunks directly.');
    }
  } else {
    console.log('[Agent] AGENT_JWT not set in .env — skipping auto-registration.');
    console.log('[Agent] To register, add AGENT_JWT=<your-jwt> to provider-agent/.env');
    console.log('[Agent] You can get your JWT by logging in at https://storachain.miyuru.dev/login');
  }

  console.log('[Agent] Ready. Press Ctrl+C to stop.\n');
});

let shuttingDown = false;

async function shutdown(signalName) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[Agent] Received ${signalName} — shutting down gracefully...`);

  if (AGENT_JWT) {
    await deactivateWithBackend({ backendUrl: BACKEND_URL, jwt: AGENT_JWT });
  }

  httpServer.close(() => {
    console.log('[Agent] Server closed. Goodbye.');
    process.exit(0);
  });
}

// ── Graceful shutdown ────────────────────────────────────────────
process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('uncaughtException', (err) => {
  console.error('[Agent] Uncaught exception:', err.message);
  // Keep running — don't crash on recoverable errors
});
