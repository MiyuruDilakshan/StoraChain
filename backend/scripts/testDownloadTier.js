/**
 * testDownloadTier.js - Verifies the 4-tier retrieval pipeline is working correctly.
 * Run: node backend/scripts/testDownloadTier.js
 */
const axios = require('axios');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const API = 'http://localhost:5000/api';

async function tryLogin(email, password) {
  try {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    return res.data.token;
  } catch {
    return null;
  }
}

async function run() {
  console.log('\n=== StoraChain Retrieval Tier Test ===\n');

  // Try common seeker accounts
  const candidates = [
    ['testseeker1@storachain.io', 'Test1234!'],
    ['testseeker3@storachain.io', 'Test1234!'],
    ['testseeker2@storachain.io', 'Test1234!'],
  ];

  let token = null;
  for (const [email, pw] of candidates) {
    token = await tryLogin(email, pw);
    if (token) { console.log(`Logged in as ${email}`); break; }
  }

  if (!token) {
    console.error('Could not log in with any known seeker account. Register a seeker first.');
    process.exit(1);
  }

  const filesRes = await axios.get(`${API}/storage/files`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const files = filesRes.data;
  console.log(`Files found: ${files.length}`);

  if (files.length === 0) {
    console.log('No files to test. Upload a file first.');
    process.exit(0);
  }

  for (const file of files.slice(0, 3)) {
    console.log(`\n--- Testing: ${file.fileName} (${(file.fileSize/1024).toFixed(1)} KB, chunks: ${file.chunks?.length ?? 'unknown'}) ---`);

    const t0 = Date.now();
    try {
      const dlRes = await axios.get(`${API}/storage/download/${file._id}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer',
      });
      const elapsed = Date.now() - t0;
      const tier = dlRes.headers['x-storage-tier'] || 'unknown';
      const received = dlRes.data.byteLength;
      const match = received === file.fileSize;

      console.log(`  ✅ Download SUCCESS in ${elapsed}ms`);
      console.log(`  📦 Tier used       : ${tier}`);
      console.log(`  📏 Size received   : ${received} bytes (expected: ${file.fileSize}) ${match ? '✓ match' : '✗ MISMATCH'}`);
    } catch (e) {
      console.log(`  ❌ Download FAILED in ${Date.now()-t0}ms: ${e.response?.data?.message || e.message}`);
    }
  }

  console.log('\n=== Test Complete ===\n');
  console.log('Check the backend console for detailed per-chunk tier logs showing:');
  console.log('  [Download][filename] Chunk N ← Tier-1 provider (url) in Xms');
  console.log('  [Download][filename] Chunk N ← Tier-2 REPLICA (url) in Xms');
  console.log('  [Download][filename] ✅ SHA-256 integrity verified');
}

run().catch(e => {
  console.error('Fatal:', e.response?.data || e.message);
  process.exit(1);
});
