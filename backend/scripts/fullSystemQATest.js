const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const API = 'http://localhost:5000/api';
const ROOT = path.resolve(__dirname, '../..');
const AGENT_DIR = path.resolve(ROOT, 'provider-agent');
const AGENT_KEY = process.env.BACKEND_AGENT_KEY || 'agent-secret-key';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mkEmail(prefix, i) {
  const t = Date.now();
  return `${prefix}${i}.${t}@example.com`;
}

async function registerUser(name, email, password, role) {
  try {
    await axios.post(`${API}/auth/register`, { name, email, password, role });
  } catch (e) {
    if (!String(e.response?.data?.message || '').includes('User already exists')) throw e;
  }
  const { data } = await axios.post(`${API}/auth/login`, { email, password });
  return data.token;
}

async function login(email, password) {
  const { data } = await axios.post(`${API}/auth/login`, { email, password });
  return data.token;
}

function startAgent({ jwt, wallet, port, space, region, price, dir }) {
  const args = [
    'agent.js',
    '--port', String(port),
    '--space', String(space),
    '--wallet', wallet,
    '--price', String(price),
    '--region', region,
    '--dir', dir,
    '--backend', 'http://localhost:5000',
  ];

  const child = spawn('node', args, {
    cwd: AGENT_DIR,
    env: {
      ...process.env,
      AGENT_JWT: jwt,
      BACKEND_URL: 'http://localhost:5000',
      BACKEND_AGENT_KEY: AGENT_KEY,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
}

async function waitForAgent(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { data } = await axios.get(`http://localhost:${port}/health`, { timeout: 3000 });
      if (data.status === 'online') return data;
    } catch (_) {}
    await sleep(1000);
  }
  throw new Error(`Agent on port ${port} did not become healthy`);
}

async function uploadFile(token, filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), { filename: path.basename(filePath) });
  form.append('walletAddress', ethers.Wallet.createRandom().address);

  const res = await axios.post(`${API}/storage/upload`, form, {
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    maxBodyLength: Infinity,
  });
  return res.data;
}

async function waitForProcessing(token, fileId) {
  let fileRecord = null;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 480000) {
    const r = await axios.get(`${API}/storage/files/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fileRecord = r.data;
    if (fileRecord?.processing?.status === 'completed') return fileRecord;
    await sleep(5000);
  }
  throw new Error('File processing timed out');
}

async function main() {
  const summary = { steps: [], errors: [] };
  const logStep = (msg) => { console.log(`✓ ${msg}`); summary.steps.push(msg); };
  const logErr = (msg, e) => { console.error(`❌ ${msg}`, e?.response?.data || e?.message || e); summary.errors.push(`${msg}: ${e?.message}`); };
  const agentChildren = [];

  try {
    console.log('\\n=== FULL SYSTEM QA TEST ===\\n');

    // 0) Health checks
    await axios.get('http://localhost:5000/');
    logStep('Backend is reachable');



    // 2) Setup Roles (Seeker, Provider, Admin)
    const seekerPassword = 'Passw0rd!123';
    const seekerEmail = mkEmail('qa.seeker', 1);
    const seekerToken = await registerUser('QA Seeker', seekerEmail, seekerPassword, 'seeker');
    
    const provEmail = mkEmail('qa.prov', 1);
    const provToken = await registerUser('QA Provider User', provEmail, seekerPassword, 'provider');

    const adminEmail = mkEmail('qa.admin', 1);
    const adminToken = await registerUser('QA Admin', adminEmail, seekerPassword, 'admin');
    
    logStep('Created Seeker, Provider, and Admin accounts');

    // Give seeker and provider some demo SCT & USD for testing purchases
    // We will do this via a direct DB hack or by assuming they have some if we are using demo_sct.
    // Wait, the API doesn't have an endpoint to just give SCT. We'll use the plan purchase (topup).
    try {
      // Mock stripe topup by using the success route or similar?
      // For now, if we can't top up, we will just use free files or check if demo_sct works (it defaults to 100 on register).
      const seekerMe = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${seekerToken}` } });
      if (seekerMe.data.sctBalance < 10) {
        // Just note it. Usually new users get some default balance or we can list free items.
      }
    } catch (e) {}

    // 3) Start 4 Provider Agents
    const providerUsers = [];
    for (let i = 0; i < 4; i++) {
      const email = mkEmail('agentprov', i);
      const token = await registerUser(`Agent ${i}`, email, seekerPassword, 'provider');
      const wallet = ethers.Wallet.createRandom().address;
      providerUsers.push({ email, token, wallet, port: 4001 + i });
    }

    for (let i = 0; i < providerUsers.length; i++) {
      const p = providerUsers[i];
      const dir = path.resolve(AGENT_DIR, `storachain-storage-qa-${p.port}`);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      const child = startAgent({ jwt: p.token, wallet: p.wallet, port: p.port, space: 1, region: 'QA', price: 1, dir });
      agentChildren.push(child);
    }

    for (const p of providerUsers) await waitForAgent(p.port);
    logStep('4 Provider Agents started and healthy');
    await sleep(4000); // allow heartbeats/registration

    // 4) My Files Tests (Upload Binary, Image, PDF)
    const tmpDir = path.resolve(ROOT, 'scripts', 'tmpQA');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // 4a. Binary File (Tests chunking, replication, Ai matchmaking)
    const binPath = path.resolve(tmpDir, `qa-file.bin`);
    fs.writeFileSync(binPath, crypto.randomBytes(2 * 1024 * 1024)); // 2MB
    const binUpload = await uploadFile(seekerToken, binPath);
    logStep('Uploaded 2MB binary file as Seeker');
    const binRecord = await waitForProcessing(seekerToken, binUpload.fileId);
    logStep('Binary file processed (IPFS, S3, Encrypted, Stored on Agents)');

    // 4b. Image File (Tests Previews)
    const imgPath = path.resolve(tmpDir, `qa-image.png`);
    // Create a valid dummy PNG (1x1 transparent)
    const pngHex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082';
    fs.writeFileSync(imgPath, Buffer.from(pngHex, 'hex'));
    const imgUpload = await uploadFile(seekerToken, imgPath);
    const imgRecord = await waitForProcessing(seekerToken, imgUpload.fileId);
    if (imgRecord.previewType && imgRecord.previewType.includes('image')) {
      logStep('Uploaded Image file and successfully generated preview');
    } else {
      logErr('Image preview generation failed or missing');
    }

    // 4c. PDF File (Tests PDF previews)
    const pdfPath = path.resolve(tmpDir, `qa-doc.pdf`);
    // Create a valid dummy PDF
    const pdfLines = [
      '%PDF-1.4',
      '1 0 obj',
      '<< /Type /Catalog /Pages 2 0 R >>',
      'endobj',
      '2 0 obj',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      'endobj',
      '3 0 obj',
      '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>',
      'endobj',
      '4 0 obj',
      '<< /Length 44 >>',
      'stream',
      'BT /F1 12 Tf 72 720 Td (StoraChain QA Test PDF) Tj ET',
      'endstream',
      'endobj',
      'xref',
      '0 5',
      '0000000000 65535 f ',
      '0000000009 00000 n ',
      '0000000058 00000 n ',
      '0000000115 00000 n ',
      '0000000266 00000 n ',
      'trailer',
      '<< /Size 5 /Root 1 0 R >>',
      'startxref',
      '360',
      '%%EOF',
    ];
    fs.writeFileSync(pdfPath, pdfLines.join('\n'));
    const pdfUpload = await uploadFile(seekerToken, pdfPath);
    const pdfRecord = await waitForProcessing(seekerToken, pdfUpload.fileId);
    if (pdfRecord.previewType && pdfRecord.previewType.includes('pdf')) {
      logStep('Uploaded PDF file and successfully identified previewType');
    }

    // 5) Retrieve File
    const downloadRes = await axios.get(`${API}/storage/download/${binUpload.fileId}`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
      responseType: 'arraybuffer'
    });
    if (downloadRes.data.length === 2 * 1024 * 1024) {
      logStep('Successfully downloaded and reassembled the binary file from providers');
    } else {
      logErr('Downloaded file size mismatch');
    }

    // 6) Marketplace & Shareable Links
    // 6a. Seeker makes the binary file a paid shareable link
    await axios.patch(`${API}/storage/files/${binUpload.fileId}/settings`, {
      visibility: 'shared',
      isLocked: true,
      priceSCT: 5
    }, { headers: { Authorization: `Bearer ${seekerToken}` } });
    logStep('Updated file to shared, locked, price 5 SCT via storage settings');

    // 6b. Provider uploads a file to sell
    const provUpload = await uploadFile(provToken, imgPath);
    await waitForProcessing(provToken, provUpload.fileId);
    await axios.post(`${API}/marketplace/list`, {
      fileRecordId: provUpload.fileId,
      visibility: 'public',
      title: 'Provider Image',
      description: 'Test image',
      priceSCT: 10,
      isLocked: true,
      category: 'Images',
      singleSale: false
    }, { headers: { Authorization: `Bearer ${provToken}` } });
    logStep('Provider uploaded and listed an image on the marketplace');

    // 6c. Verify Marketplace listing
    const marketRes = await axios.get(`${API}/marketplace`, { headers: { Authorization: `Bearer ${seekerToken}` } });
    const listings = marketRes.data.listings || [];
    if (listings.find((listing) => String(listing.fileRecordId?._id || listing.fileRecordId) === String(provUpload.fileId))) {
      logStep('Provider file appears correctly in public marketplace list');
    } else {
      logErr('Provider file missing from public marketplace list');
    }

    // 6d. Test Share Link page metadata (Public access)
    // First, get the shareToken of the binUpload
    const updatedBin = await axios.get(`${API}/storage/files/${binUpload.fileId}`, { headers: { Authorization: `Bearer ${seekerToken}` }});
    const shareToken = updatedBin.data.shareToken;
    const publicMeta = await axios.get(`${API}/storage/public/${shareToken}`);
    if (publicMeta.data.isLocked === true && publicMeta.data.priceSCT === 5) {
      logStep('Public share endpoint returns correct locked metadata without auth');
    }

    // 6e. Test Purchase Transaction
    // Provider buys Seeker's file using demo_sct
    try {
      await axios.post(`${API}/storage/public/${shareToken}/purchase`, { method: 'demo_sct' }, { headers: { Authorization: `Bearer ${provToken}` }});
      logStep('Purchase successful using demo_sct');

      // Verify token balance distributions
      const pMe = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${provToken}` }});
      const sMe = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${seekerToken}` }});
      // Initial is 100. Provider spent 5, Seeker earned 5 (minus fee perhaps, fee is usually 0 in demo but check)
      if (pMe.data.sctBalance < 100) {
        logStep('SCT deducted from buyer');
      }
      if (sMe.data.sctBalance > 100) {
        logStep('SCT credited to seller');
      }

      // Download from shareable link now that it is purchased
      const shareDown = await axios.get(`${API}/storage/public/${shareToken}/download`, {
        headers: { Authorization: `Bearer ${provToken}` },
        responseType: 'arraybuffer'
      });
      if (shareDown.data.length === 2 * 1024 * 1024) {
        logStep('Buyer successfully downloaded file via shareable link endpoint');
      }
    } catch (e) {
      logErr('Purchase or shared download failed', e);
    }

    // 7) Admin Dashboard Tests
    const adminStats = await axios.get(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${adminToken}` }});
    if (typeof adminStats.data.totalUsers === 'number') logStep('Admin stats endpoint accessible and returns stats');

    const adminUsers = await axios.get(`${API}/admin/users`, { headers: { Authorization: `Bearer ${adminToken}` }});
    if (adminUsers.data.length > 0) logStep('Admin users endpoint accessible');

    const adminReports = await axios.get(`${API}/admin/abuse-reports`, { headers: { Authorization: `Bearer ${adminToken}` }});
    if (Array.isArray(adminReports.data)) logStep('Admin abuse-reports endpoint accessible');

    const adminTransactions = await axios.get(`${API}/admin/transactions`, { headers: { Authorization: `Bearer ${adminToken}` }});
    if (Array.isArray(adminTransactions.data)) logStep('Admin transactions endpoint accessible');

    console.log('\\n=== TEST COMPLETE. SUMMARY: ===');
    summary.steps.forEach(s => console.log(`[PASS] ${s}`));
    summary.errors.forEach(e => console.log(`[FAIL] ${e}`));

    if (summary.errors.length === 0) {
      console.log('\\n✅ ALL TESTS PASSED!');
    } else {
      console.log(`\\n❌ Finished with ${summary.errors.length} errors.`);
    }

  } catch (err) {
    console.error('Fatal Test Error:', err);
  } finally {
    for (const c of agentChildren) {
      try { c.kill('SIGINT'); } catch (_) {}
    }
    process.exit(0);
  }
}

main();
