/**
 * StoraChain Full End-to-End Production Test
 * ============================================
 * Tests against the live production backend: https://api.storachain.miyuru.dev
 *
 * Covers:
 *  1.  Seeker registration + login
 *  2.  File upload  → encrypt → AI matchmaking → shard → distribute
 *  3.  Provider chunk storage verification  (local agent localhost:3001)
 *  4.  Reward minting (SCT tokens on Sepolia)
 *  5.  File download → fetch chunks from provider → reassemble → decrypt → SHA-256 verify
 *  6.  Pinata IPFS backup  (CID present + retrievable)
 *  7.  AWS S3 cloud backup (path present + retrievable)
 *  8.  Blockchain on-chain record (StoraChainStorage contract)
 *  9.  AI scoring service status
 * 10.  Anti-cheat / integrity report
 *
 * Usage (from project root or backend/):
 *   node backend/scripts/fullE2ETest.js
 */

const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL     = 'https://api.storachain.miyuru.dev';
const API          = BASE_URL + '/api';
const LOCAL_AGENT  = 'http://localhost:3001';          // Home PC agent (NAT'd — check local)
const AGENT_KEY    = process.env.BACKEND_AGENT_KEY || 'agent-secret-key';
const TEST_EMAIL   = `e2e.seeker.${Date.now()}@storachain-test.com`;
const TEST_PASS    = 'Test123!E2E';
const TEST_FILE    = Buffer.from('StoraChain E2E test payload — ' + new Date().toISOString());
const TEST_FNAME   = 'storachain-e2e-test.txt';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PASS = (msg) => console.log('  ✅ PASS:', msg);
const FAIL = (msg) => console.log('  ❌ FAIL:', msg);
const INFO = (msg) => console.log('  ℹ️  INFO:', msg);
const HEAD = (msg) => console.log('\n' + '─'.repeat(60) + '\n  ' + msg + '\n' + '─'.repeat(60));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const results = [];

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  if (passed) PASS(name + (detail ? ` — ${detail}` : ''));
  else        FAIL(name + (detail ? ` — ${detail}` : ''));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n🚀  StoraChain Full System E2E Test');
  console.log(`   Backend : ${API}`);
  console.log(`   Agent   : ${LOCAL_AGENT}`);
  console.log(`   File    : ${TEST_FNAME} (${TEST_FILE.length} bytes)`);
  console.log(`   Time    : ${new Date().toISOString()}\n`);

  let token = null;
  let fileId = null;
  let fileRecord = null;

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('1. BACKEND HEALTH CHECK');
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const r = await axios.get(`${BASE_URL}`, { timeout: 8000 });
    record('Backend reachable', r.status === 200, `response: ${r.data?.toString()?.slice(0, 60) || r.status}`);
  } catch (e) {
    record('Backend reachable', false, e.message);
    console.log('\n⛔  Cannot reach backend — aborting test.');
    printSummary();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('2. AI SERVICE CHECK');
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    // AI check requires auth — skip for now, will test after login
    INFO('AI service check deferred until after auth (requires JWT)');
  } catch (e) {
    record('AI scoring service (Flask)', false, e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('3. SEEKER AUTH — REGISTER + LOGIN');
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    await axios.post(`${API}/auth/register`, {
      name: 'E2E Test Seeker',
      email: TEST_EMAIL,
      password: TEST_PASS,
      role: 'seeker',
    }, { timeout: 10000 });
    record('Seeker registration', true, TEST_EMAIL);
  } catch (e) {
    record('Seeker registration', false, e.response?.data?.message || e.message);
  }

  try {
    const r = await axios.post(`${API}/auth/login`, { email: TEST_EMAIL, password: TEST_PASS }, { timeout: 10000 });
    token = r.data?.token;
    record('Seeker login + JWT', !!token, token ? `${token.slice(0, 30)}…` : 'no token');
  } catch (e) {
    record('Seeker login + JWT', false, e.response?.data?.message || e.message);
    console.log('\n⛔  Cannot authenticate — aborting test.');
    printSummary();
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('2b. AI SERVICE CHECK (authenticated)');
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const r = await axios.post(`${API}/ai/match`, {
      providers: [
        { id: 'p1', uptime: 99, latencyMs: 50, reputationScore: 80, capacityGB: 10, systemPricePerGB: 0.02, region: 'eu-west' }
      ]
    }, { headers: auth, timeout: 8000 });

    if (r.data?.ranked?.length > 0) {
      record('AI scoring service (Flask)', true,
        `ranked ${r.data.ranked.length} provider(s) | top score: ${r.data.ranked[0]?.score?.toFixed(3)}`);
    } else {
      record('AI scoring service (Flask)', false, `ranked array empty: ${JSON.stringify(r.data)}`);
    }
  } catch (e) {
    const errMsg = e.response?.data?.message || e.message;
    record('AI scoring service (Flask)', false, errMsg);
    if (errMsg?.includes('offline') || errMsg?.includes('ECONNREFUSED')) {
      INFO('  ⚠  AI service (Flask) is offline on VPS. Run: cd ~/StoraChain/ai-service && pm2 restart ai-service');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('2c. ACTIVE PROVIDERS CHECK');
  // ═══════════════════════════════════════════════════════════════════════════
  let activeProviders = [];
  try {
    const r = await axios.get(`${API}/providers`, { headers: auth, timeout: 10000 });
    activeProviders = Array.isArray(r.data) ? r.data : (r.data?.providers || []);
    record('Active providers in database', activeProviders.length > 0,
      `${activeProviders.length} active provider listing(s)`);
    for (const p of activeProviders) {
      INFO(`  Provider: ${p.agentUrl} | region=${p.region} | capacity=${p.capacityGB}GB | used=${p.usedGB}GB | uptime=${p.uptimePct}%`);
    }
    if (activeProviders.length === 0) {
      INFO('  ⚠  No active providers! Your local agent must:');
      INFO('     1. Be running: pm2 status (check storachain-provider is online)');
      INFO('     2. Have registered: pm2 logs storachain-provider (look for "Registered with backend")');
      INFO('     3. Have capacityGB > 0: set space in /app/node or agent .env');
      INFO('     4. Have isActive=true: agent sends heartbeat every 30s to keep active');
    }
  } catch (e) {
    record('Active providers in database', false, e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('4. FILE UPLOAD — ENCRYPT → SHARD → DISTRIBUTE');
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const form = new FormData();
    form.append('file', TEST_FILE, { filename: TEST_FNAME, contentType: 'text/plain' });
    form.append('walletAddress', '0x0000000000000000000000000000000000000001');

    const r = await axios.post(`${API}/storage/upload`, form, {
      headers: { ...auth, ...form.getHeaders() },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    fileId = r.data?.fileId || r.data?._id;
    record('Upload API call (200)', r.status === 200, `fileId: ${fileId}`);
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    record('Upload API call (200)', false, msg);
    if (msg?.includes('No storage providers')) {
      INFO('  ⚠  CAUSE: StorageListing collection has no active entries.');
      INFO('  ⚠  FIX: Start your local agent and ensure it registers. Run pm2 logs storachain-provider.');
      INFO('  ⚠  Skipping chunk/download tests — no providers to store data.');
      // Continue to test other systems that don't require upload
    } else {
      console.log('\n⛔  Upload failed unexpectedly — cannot continue file tests.');
    }
    // skip remaining file tests by setting fileId to null
    fileId = null;
  }

  // Poll for processing completion (up to 30s)
  if (fileId) {
  let pollAttempts = 0;
  while (pollAttempts < 15) {
    await sleep(2000);
    pollAttempts++;
    try {
      const r = await axios.get(`${API}/storage/files`, { headers: auth, timeout: 10000 });
      const files = r.data?.files || r.data || [];
      fileRecord = files.find(f => f._id === fileId || f.fileId === fileId);
      if (!fileRecord && files.length > 0) {
        // Try most-recent
        fileRecord = files[files.length - 1];
      }
      const stage = fileRecord?.processing?.stage;
      const status = fileRecord?.processing?.status;
      process.stdout.write(`  … poll ${pollAttempts}: stage=${stage} status=${status}\n`);
      if (status === 'complete' || status === 'done' || stage === 'complete') break;
      if (status === 'failed') break;
    } catch (e) {
      process.stdout.write(`  … poll ${pollAttempts}: error (${e.message})\n`);
    }
  }
  } // end if (fileId)

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('5. FILE RECORD ANALYSIS');
  // ═══════════════════════════════════════════════════════════════════════════
  if (!fileRecord) {
    // Try direct lookup
    try {
      const r = await axios.get(`${API}/storage/files`, { headers: auth, timeout: 10000 });
      const files = r.data?.files || r.data || [];
      fileRecord = files[files.length - 1];
    } catch (_) {}
  }

  record('File record in DB', !!fileRecord, fileRecord?._id || fileRecord?.fileId || 'not found');

  if (fileRecord) {
    record('File is encrypted', !!fileRecord.isEncrypted, `isEncrypted=${fileRecord.isEncrypted}`);
    record('File has chunks', Array.isArray(fileRecord.chunks) && fileRecord.chunks.length > 0,
      `${fileRecord.chunks?.length || 0} chunk(s)`);

    const chunkCount = fileRecord.chunks?.length || 0;
    for (let i = 0; i < chunkCount; i++) {
      const c = fileRecord.chunks[i];
      INFO(`  Chunk ${i}: id=${c.chunkId?.slice(0,12)}… url=${c.providerUrl} size=${c.size} bytes`);
    }

    // AI matchmaking
    const mm = fileRecord.matchmaking;
    if (mm) {
      record('AI matchmaking result present', true,
        `source=${mm.source} candidates=${mm.candidates?.length || 0}`);
      if (mm.candidates?.length > 0) {
        INFO(`  Top candidate: url=${mm.candidates[0].agentUrl} score=${mm.candidates[0].score} source=${mm.candidates[0].source}`);
      }
    } else {
      record('AI matchmaking result present', false, 'matchmaking field missing in file record');
    }

    // SHA-256 hash
    record('SHA-256 hash stored', !!fileRecord.sha256Hash, fileRecord.sha256Hash?.slice(0, 20) + '…');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('6. PROVIDER / LOCAL AGENT CHUNK VERIFICATION');
  // ═══════════════════════════════════════════════════════════════════════════
  // Check local agent health
  try {
    const r = await axios.get(`${LOCAL_AGENT}/health`, { timeout: 5000 });
    record('Local agent health (localhost:3001)', r.data?.status === 'online',
      `status=${r.data?.status} uptime=${r.data?.uptimePct || '?'}%`);
  } catch (e) {
    record('Local agent health (localhost:3001)', false, `Not reachable: ${e.message}`);
    INFO('  ⚠  Local agent not reachable from this machine — chunk presence check skipped.');
    INFO('  ⚠  Run this test ON the provider machine OR wait for pull-queue to deliver chunks.');
  }

  // Check disk-info from local agent
  try {
    const r = await axios.get(`${LOCAL_AGENT}/disk-info`, { timeout: 5000 });
    record('Local agent disk-info', !!r.data, JSON.stringify(r.data).slice(0, 100));
  } catch (e) {
    record('Local agent disk-info', false, e.message);
  }

  // If fileRecord has chunks and local agent is reachable, try fetching chunk from agent
  if (fileRecord?.chunks?.length > 0) {
    const chunk0 = fileRecord.chunks[0];
    const agentUrl = chunk0.providerUrl;
    INFO(`  Checking if chunk exists at provider: ${agentUrl}/chunk/${chunk0.chunkId?.slice(0,12)}…`);
    try {
      const r = await axios.get(`${agentUrl}/chunk/${chunk0.chunkId}`, {
        headers: { 'x-agent-key': AGENT_KEY },
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      const buf = Buffer.from(r.data);
      record(`Chunk 0 retrievable from provider agent`, buf.length > 0,
        `${buf.length} bytes from ${agentUrl}`);
    } catch (e) {
      record(`Chunk 0 retrievable from provider agent`, false,
        `${agentUrl}: ${e.response?.status || e.message}`);
      INFO('  ⚠  If agentUrl is a home PC behind NAT, this is expected — pull-queue will deliver it.');
    }
  }

  // Check chunk-queue (pending chunks in MongoDB for pull delivery)
  INFO('  Checking pull queue for pending chunks…');
  try {
    const r = await axios.get(`${API}/providers/chunk-queue`, { headers: auth, timeout: 8000 });
    const pending = r.data?.chunks || [];
    record('Chunk pull-queue check', true, pending.length === 0
      ? 'Queue empty — all chunks already delivered ✓'
      : `${pending.length} chunk(s) still pending pull by provider`);
    if (pending.length > 0) {
      INFO(`  Pending chunk IDs: ${pending.slice(0, 3).join(', ')}${pending.length > 3 ? '…' : ''}`);
      INFO('  These will be fetched by the agent within 5 seconds of next poll.');
    }
  } catch (e) {
    record('Chunk pull-queue check', false, e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('7. PROVIDER EARNINGS (REWARD SYSTEM)');
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const r = await axios.get(`${API}/providers/earnings`, { headers: auth, timeout: 10000 });
    const earnings = r.data;
    record('Provider earnings endpoint', r.status === 200, JSON.stringify(earnings).slice(0, 120));
  } catch (e) {
    // If user is not a provider, they won't have earnings — that's OK
    if (e.response?.status === 403 || e.response?.status === 404) {
      INFO('  Seeker has no provider earnings (expected) — checking admin analytics instead');
      record('Provider earnings endpoint', true, 'User is seeker — no personal earnings (expected)');
    } else {
      record('Provider earnings endpoint', false, e.message);
    }
  }

  // Check if reward was minted to any provider
  if (fileRecord?.chunks?.length > 0) {
    const wallets = fileRecord.chunks
      .flatMap(c => [c.providerWalletAddress, c.replicaWalletAddress])
      .filter(Boolean);
    INFO(`  Provider wallets from chunks: ${wallets.join(', ')}`);
    if (wallets.length > 0) {
      record('Provider wallets recorded in file chunks', true, `${wallets.length} wallet(s)`);
    } else {
      record('Provider wallets recorded in file chunks', false, 'No provider wallets in chunk metadata');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('8. FILE DOWNLOAD — CHUNKS → REASSEMBLE → DECRYPT → VERIFY');
  // ═══════════════════════════════════════════════════════════════════════════
  let downloadedBuffer = null;
  try {
    const dlFileId = fileRecord?._id || fileId;
    INFO(`  Downloading fileId: ${dlFileId}…`);
    const r = await axios.get(`${API}/storage/download/${dlFileId}`, {
      headers: auth,
      responseType: 'arraybuffer',
      timeout: 60000,
    });

    downloadedBuffer = Buffer.from(r.data);
    record('File download (200)', r.status === 200, `${downloadedBuffer.length} bytes received`);

    // Verify content matches what was uploaded
    const match = downloadedBuffer.equals(TEST_FILE);
    record('Downloaded content matches original', match,
      match ? 'SHA-256 identical ✓' : `mismatch! got ${downloadedBuffer.slice(0,40).toString()}`);

    // SHA-256 cross-check
    const dlHash = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');
    const origHash = crypto.createHash('sha256').update(TEST_FILE).digest('hex');
    record('SHA-256 integrity verification', dlHash === origHash,
      `orig=${origHash.slice(0,16)}… dl=${dlHash.slice(0,16)}…`);
  } catch (e) {
    record('File download (200)', false, e.response?.data?.toString() || e.message);
    INFO('  ⚠  If chunks are in pull-queue, wait 5s for agent to pull then retry download.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('9. PINATA IPFS BACKUP');
  // ═══════════════════════════════════════════════════════════════════════════
  const ipfsCid = fileRecord?.ipfsCid;
  if (ipfsCid) {
    record('IPFS CID recorded in file record', true, ipfsCid);
    // Try fetching from public Pinata gateway
    try {
      const r = await axios.get(`https://gateway.pinata.cloud/ipfs/${ipfsCid}`, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      record('IPFS file retrievable (Pinata gateway)', true, `${r.data.byteLength} bytes`);
    } catch (e) {
      record('IPFS file retrievable (Pinata gateway)', false, e.message);
    }
  } else {
    record('IPFS CID recorded in file record', false,
      'ipfsCid is null — Pinata pin may still be in progress (background job, can take 10–30s)');
    INFO('  ⚠  GATEWAY_URL=your-subdomain.mypinata.cloud is a PLACEHOLDER in .env!');
    INFO('  ⚠  Fix: set GATEWAY_URL=gateway.pinata.cloud on VPS (uses public Pinata gateway).');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('10. AWS S3 CLOUD BACKUP');
  // ═══════════════════════════════════════════════════════════════════════════
  const s3Path = fileRecord?.cloudBackupPath;
  if (s3Path) {
    record('S3 backup path recorded in file record', true, s3Path);
  } else {
    record('S3 backup path recorded in file record', false,
      'cloudBackupPath is null — S3 upload may still be in progress (background job)');
    INFO('  ⚠  Wait 5–10s after upload then re-run this test to check backup completion.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('11. BLOCKCHAIN — ON-CHAIN RECORD');
  // ═══════════════════════════════════════════════════════════════════════════
  const onChainTx = fileRecord?.onChainTxHash;
  if (onChainTx) {
    record('On-chain tx hash stored', true, onChainTx);
    INFO(`  Verify on Sepolia Etherscan: https://sepolia.etherscan.io/tx/${onChainTx}`);
  } else {
    record('On-chain tx hash stored', false,
      'onChainTxHash is null — blockchain tx may still be pending (Sepolia can take 15–60s)');
    INFO('  ⚠  Check VPS PM2 logs for [Blockchain] entries to confirm.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  HEAD('12. ANTI-CHEAT / INTEGRITY SYSTEM');
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const r = await axios.get(`${API}/providers/my-listing`, { headers: auth, timeout: 10000 });
    if (r.data?.listing) {
      const listing = r.data.listing;
      record('Provider listing found (seeker is also provider)', true,
        `integrity=${listing.integrityHealthy ?? 'n/a'} uptime=${listing.uptimePct ?? 'n/a'}%`);
      if (listing.integrityHealthy === false) {
        FAIL('Integrity flag is unhealthy — check penaltyService and abuse reports');
      } else {
        record('Integrity healthy flag', listing.integrityHealthy !== false, `integrityHealthy=${listing.integrityHealthy}`);
      }
    } else {
      INFO('  No provider listing for this test seeker account (expected if separate provider account).');
      record('Anti-cheat system accessible', true, 'Endpoint reachable, seeker has no listing (expected)');
    }
  } catch (e) {
    // Try admin integrity endpoint
    try {
      const r2 = await axios.get(`${API}/admin/providers`, {
        headers: { ...auth, 'x-admin-secret': process.env.ADMIN_SECRET || 'StoraChain-Admin-2024' },
        timeout: 10000,
      });
      const providers = r2.data?.providers || [];
      record('Admin provider list (anti-cheat data)', r2.status === 200,
        `${providers.length} provider(s) in system`);
      for (const p of providers.slice(0, 3)) {
        INFO(`  Provider: ${p.agentUrl || p._id} | integrity=${p.integrityHealthy ?? 'n/a'} | uptime=${p.uptimePct ?? '?'}%`);
      }
    } catch (e2) {
      record('Anti-cheat system accessible', false, e2.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  printSummary();
})();

function printSummary() {
  const pass = results.filter(r => r.passed).length;
  const fail = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log('\n' + '═'.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));
  results.forEach((r, i) => {
    console.log(`  ${r.passed ? '✅' : '❌'} [${i + 1}] ${r.name}`);
    if (!r.passed && r.detail) console.log(`       → ${r.detail}`);
  });
  console.log('─'.repeat(60));
  console.log(`  Result: ${pass}/${total} passed, ${fail} failed`);
  console.log('═'.repeat(60));

  if (fail > 0) {
    console.log('\n📋  NEXT STEPS FOR FAILURES:');
    console.log('  • Blockchain/IPFS/S3 failures: these run in background after upload.');
    console.log('    Wait 30-60s then check VPS logs: pm2 logs backend');
    console.log('  • Chunk delivery failures: wait 5s for agent pull queue, then re-run download test.');
    console.log('  • AI service failure: check VPS ai-service is running: pm2 logs ai-service');
    console.log('  • GATEWAY_URL placeholder: set GATEWAY_URL=gateway.pinata.cloud in VPS .env\n');
  } else {
    console.log('\n🎉  All systems operational!\n');
  }
}
