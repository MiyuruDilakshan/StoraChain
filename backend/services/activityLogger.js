/**
 * activityLogger.js — Real-time activity log for StoraChain admin Live View
 *
 * Architecture:
 *  - In-memory circular buffer of the last MAX_LOGS events
 *  - Server-Sent Events (SSE) broadcast to all connected admin clients
 *  - No extra dependencies — pure Node.js + Express
 *
 * Usage in other modules:
 *   const { logActivity } = require('./activityLogger');
 *   logActivity('upload',   '📁 File upload started',    { fileName, fileSize });
 *   logActivity('encrypt',  '🔐 AES-256-GCM encryption', { fileId });
 *   logActivity('chunk',    '🔀 Sharding into chunks',   { count: 2 });
 *   logActivity('provider', '📤 Sent to provider',       { url, chunkId });
 *   logActivity('ipfs',     '📌 Pinned to Pinata/IPFS',  { cid });
 *   logActivity('s3',       '☁️ S3 backup complete',     { path });
 *   logActivity('chain',    '⛓️ On-chain registration',  { txHash });
 *   logActivity('reward',   '🪙 Token reward sent',      { wallet, amount });
 *   logActivity('download', '⬇️ File retrieval started', { fileId });
 *   logActivity('decrypt',  '🔓 Decryption complete',    { fileId });
 *   logActivity('error',    '❌ Error occurred',         { msg });
 */

const MAX_LOGS = 300; // circular buffer size

// ── Circular buffer ───────────────────────────────────────────────────────────
let logId = 0;
const recentLogs = [];   // array of log objects, newest appended at end
let sseClients = [];     // list of { res, id } for active SSE connections

// Type-to-colour + icon mapping (used by frontend but stored here for consistency)
const TYPE_META = {
  upload:    { icon: '📁', color: '#2997ff', label: 'Upload'      },
  encrypt:   { icon: '🔐', color: '#bf5af2', label: 'Encryption'  },
  chunk:     { icon: '✂️', color: '#ff9f0a', label: 'Sharding'    },
  provider:  { icon: '📤', color: '#30d158', label: 'Provider'    },
  replica:   { icon: '🔁', color: '#5ac8fa', label: 'Replication' },
  matchmake: { icon: '🤖', color: '#ff6b35', label: 'AI Match'    },
  ipfs:      { icon: '📌', color: '#a78bfa', label: 'IPFS/Pinata' },
  s3:        { icon: '☁️', color: '#38bdf8', label: 'AWS S3'      },
  chain:     { icon: '⛓️', color: '#facc15', label: 'Blockchain'  },
  reward:    { icon: '🪙', color: '#fbbf24', label: 'Tokens'      },
  download:  { icon: '⬇️', color: '#34d399', label: 'Download'    },
  decrypt:   { icon: '🔓', color: '#6ee7b7', label: 'Decryption'  },
  replication:{ icon: '🔁', color: '#5ac8fa', label: 'Replication'},
  system:    { icon: '⚙️', color: '#9ca3af', label: 'System'      },
  error:     { icon: '❌', color: '#ff375f', label: 'Error'       },
  info:      { icon: 'ℹ️', color: '#6b7280', label: 'Info'        },
};

/**
 * Log an activity event.
 * @param {string} type  — one of the TYPE_META keys
 * @param {string} message — human-readable description
 * @param {object} [meta] — optional structured data (fileId, wallet, txHash, …)
 */
function logActivity(type, message, meta = {}) {
  const entry = {
    id:        ++logId,
    type,
    message,
    meta,
    icon:      (TYPE_META[type] || TYPE_META.info).icon,
    color:     (TYPE_META[type] || TYPE_META.info).color,
    label:     (TYPE_META[type] || TYPE_META.info).label,
    timestamp: new Date().toISOString(),
  };

  // Append to buffer; trim if over limit
  recentLogs.push(entry);
  if (recentLogs.length > MAX_LOGS) recentLogs.shift();

  // Broadcast to all connected SSE clients
  const data = `data: ${JSON.stringify(entry)}\n\n`;
  sseClients = sseClients.filter(client => {
    try {
      client.res.write(data);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Register an admin SSE connection.
 * Sends the last MAX_LOGS logs immediately, then streams new events.
 * Called from the route handler.
 */
function registerSSEClient(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable NGINX buffering
  res.flushHeaders();

  // Send existing logs as a batch init event
  const initPayload = JSON.stringify({ type: '__init__', logs: recentLogs });
  res.write(`data: ${initPayload}\n\n`);

  // Keep-alive ping every 20 s so NGINX / proxies don't close idle connections
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 20000);

  const client = { res, pingInterval: ping };
  sseClients.push(client);

  res.on('close', () => {
    clearInterval(ping);
    sseClients = sseClients.filter(c => c !== client);
  });
}

/**
 * Return recent logs (for initial HTTP fetch fallback).
 */
function getRecentLogs() {
  return recentLogs.slice();
}

module.exports = { logActivity, registerSSEClient, getRecentLogs, TYPE_META };
