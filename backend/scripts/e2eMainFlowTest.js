const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const API = 'http://localhost:5000/api';
const ROOT = path.resolve(__dirname, '../..');
const AGENT_DIR = path.resolve(ROOT, 'provider-agent');
const AGENT_KEY = process.env.BACKEND_AGENT_KEY || 'agent-secret-key';
const TOKEN_ADDR = process.env.TOKEN_CONTRACT_ADDRESS;
const RPC_URL = process.env.SEPOLIA_RPC_URL;

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

  child.stdout.on('data', (d) => process.stdout.write(`[agent:${port}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[agent:${port}:err] ${d}`));
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

async function main() {
  const storageOnly = process.argv.includes('--storage-only');
  const summary = {
    cliProviders: [],
    storageProviders: [],
    seeker: null,
    ai: null,
    upload: null,
    retrieval: null,
    replication: null,
    backups: null,
    tokenBalances: null,
  };

  const agentChildren = [];

  try {
    console.log('\n=== E2E MAIN FLOW TEST START ===\n');

    // 0) Health checks
    await axios.get('http://localhost:5000/');
    await axios.get('http://127.0.0.1:5001/health');
    console.log('✓ Backend and AI services are reachable');

    // 1) New Provider flow (CLI model): register + go-online + reward check
    const cliWallets = [
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
    ];
    if (!storageOnly) {
      for (let i = 0; i < 4; i++) {
        const email = mkEmail('cliprovider', i + 1);
        const machineId = `machine-${Date.now()}-${i + 1}`;
        const password = 'Passw0rd!123';

        const reg = await axios.post(`${API}/providers/cli/register`, {
          email,
          password,
          machineId,
          deviceName: `cli-node-${i + 1}`,
        });
        const providerId = reg.data.providerId;

        const online = await axios.post(`${API}/providers/cli/${providerId}/go-online`, {
          hddTotalGB: 100 + i * 50,
          walletAddress: cliWallets[i],
        });

        const dash = await axios.get(`${API}/providers/cli/${providerId}/dashboard`);

        summary.cliProviders.push({
          providerId,
          email,
          wallet: cliWallets[i],
          status: dash.data.provider?.status,
          totalEarnings: dash.data.earnings?.total,
          bonusMessage: online.data?.bonus,
        });
      }
      console.log('✓ CLI provider flow complete for 4 providers (register + online + dashboard earnings)');
    } else {
      console.log('• Storage-only mode: skipped CLI provider registration flow');
    }

    // 2) Classic provider users + 4 real provider-agent nodes (for shard replication)
    const providerUsers = [];
    for (let i = 0; i < 4; i++) {
      const email = mkEmail('provider', i + 1);
      const password = 'Passw0rd!123';
      const wallet = ethers.Wallet.createRandom().address;
      await registerUser(`Provider ${i + 1}`, email, password, 'provider');
      const token = await login(email, password);
      providerUsers.push({ email, password, token, wallet, port: 3001 + i });
    }

    for (let i = 0; i < providerUsers.length; i++) {
      const p = providerUsers[i];
      const dir = path.resolve(AGENT_DIR, `storachain-storage-${p.port}`);
      const child = startAgent({
        jwt: p.token,
        wallet: p.wallet,
        port: p.port,
        space: 0.08 + i * 0.02,
        region: ['EU', 'US-East', 'Asia', 'EU-West'][i],
        price: 1 + i,
        dir,
      });
      agentChildren.push(child);
    }

    for (const p of providerUsers) {
      await waitForAgent(p.port);
    }
    console.log('✓ 4 provider-agent nodes are online and healthy');

    // let registration + heartbeats settle
    await sleep(5000);

    // 3) Register seeker + upload real 5MB file
    const seekerEmail = mkEmail('seeker', 1);
    const seekerPassword = 'Passw0rd!123';
    await registerUser('Storage Seeker', seekerEmail, seekerPassword, 'seeker');
    const seekerToken = await login(seekerEmail, seekerPassword);
    summary.seeker = { email: seekerEmail };

    // ensure providers visible from backend
    const providersList = await axios.get(`${API}/providers`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
    });
    summary.storageProviders = providersList.data.map((p) => ({
      id: p._id,
      agentUrl: p.agentUrl,
      wallet: p.walletAddress,
      pricePerGB: p.pricePerGB,
      systemPricePerGB: p.systemPricePerGB,
      capacityGB: p.capacityGB,
      region: p.region,
      isActive: p.isActive,
    }));

    const aiMatchPayload = summary.storageProviders.map((p) => ({
      id: p.id,
      uptime: 99,
      capacityGB: p.capacityGB,
      latencyMs: 40,
      reputationScore: 90,
      region: p.region || 'local',
    }));
    const aiMatchRes = await axios.post(`${API}/ai/match`, { providers: aiMatchPayload }, {
      headers: { Authorization: `Bearer ${seekerToken}` },
      timeout: 15000,
    });
    summary.ai = {
      rankedCount: Array.isArray(aiMatchRes.data?.ranked) ? aiMatchRes.data.ranked.length : 0,
      topScore: aiMatchRes.data?.ranked?.[0]?.score || null,
    };

    // create 10MB binary file
    const tmpDir = path.resolve(ROOT, 'scripts', 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.resolve(tmpDir, `real-5mb-${Date.now()}.bin`);
    const fileBuffer = crypto.randomBytes(5 * 1024 * 1024);
    fs.writeFileSync(filePath, fileBuffer);
    const expectedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), { filename: path.basename(filePath) });
    form.append('walletAddress', ethers.Wallet.createRandom().address);

    const uploadRes = await axios.post(`${API}/storage/upload`, form, {
      headers: {
        Authorization: `Bearer ${seekerToken}`,
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      timeout: 180000,
    });

    const fileId = uploadRes.data.fileId;
    summary.upload = {
      fileId,
      fileName: uploadRes.data.fileName,
      fileSize: uploadRes.data.fileSize,
      sha256Hash: uploadRes.data.sha256Hash,
      shardCount: uploadRes.data.shardCount,
    };
    console.log('✓ Seeker uploaded real 5MB file');

    // 4) Poll file record for async tasks (pinata, s3, onchain)
    let fileRecord = null;
    const pollStart = Date.now();
    while (Date.now() - pollStart < 480000) {
      const r = await axios.get(`${API}/storage/files/${fileId}`, {
        headers: { Authorization: `Bearer ${seekerToken}` },
      });
      fileRecord = r.data;

      const ready = fileRecord?.processing?.status === 'completed';
      if (ready) break;
      await sleep(5000);
    }

    summary.backups = {
      ipfsCid: fileRecord?.ipfsCid || null,
      cloudBackupPath: fileRecord?.cloudBackupPath || null,
      onChainTxHash: fileRecord?.onChainTxHash || fileRecord?.txHash || null,
      isEncrypted: !!fileRecord?.isEncrypted,
      ivPresent: !!fileRecord?.iv,
      encryptedKeyPresent: !!fileRecord?.encryptedKey,
      processingStage: fileRecord?.processing?.stage || null,
      processingStatus: fileRecord?.processing?.status || null,
    };

    // metadata/preview layer check
    const listRes = await axios.get(`${API}/storage/files`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
      timeout: 15000,
    });
    const listItem = (listRes.data || []).find((f) => String(f._id) === String(fileId));
    if (fileRecord?.previewType) {
      await axios.get(`${API}/storage/files/${fileId}/preview`, {
        headers: { Authorization: `Bearer ${seekerToken}` },
        responseType: 'arraybuffer',
        timeout: 20000,
      });
    }

    // 5) Replication verification from file chunks and live agent chunk lists
    const chunks = fileRecord?.chunks || [];
    const agentChunkMaps = {};
    for (const p of providerUsers) {
      try {
        const { data } = await axios.get(`http://localhost:${p.port}/chunks`, {
          headers: { 'x-agent-key': AGENT_KEY },
          timeout: 10000,
        });
        agentChunkMaps[`http://localhost:${p.port}`] = data.chunks || [];
      } catch {
        agentChunkMaps[`http://localhost:${p.port}`] = [];
      }
    }

    const replicationChecks = chunks.map((c) => {
      const primaryList = agentChunkMaps[c.providerUrl] || [];
      const replicaList = agentChunkMaps[c.replicaProviderUrl] || [];
      return {
        chunkId: c.chunkId,
        primary: c.providerUrl,
        replica: c.replicaProviderUrl,
        primaryHasChunk: primaryList.includes(c.chunkId),
        replicaHasChunk: c.replicaProviderUrl ? replicaList.includes(c.chunkId) : false,
      };
    });

    summary.replication = {
      chunkCount: chunks.length,
      checks: replicationChecks,
      allPrimaryStored: replicationChecks.every((x) => x.primaryHasChunk),
      allReplicaStored: replicationChecks.every((x) => x.replicaHasChunk),
    };

    // 6) Retrieval + integrity verification
    const downloadRes = await axios.get(`${API}/storage/download/${fileId}`, {
      headers: { Authorization: `Bearer ${seekerToken}` },
      responseType: 'arraybuffer',
      timeout: 180000,
    });
    const downloaded = Buffer.from(downloadRes.data);
    const downloadedHash = crypto.createHash('sha256').update(downloaded).digest('hex');
    summary.retrieval = {
      bytes: downloaded.length,
      expectedBytes: fileBuffer.length,
      expectedSha256: expectedHash,
      downloadedSha256: downloadedHash,
      hashMatch: expectedHash === downloadedHash,
      metadataLayerVisible: !!listItem,
      previewLayerAvailable: !!fileRecord?.previewType,
      matchmakingSource: fileRecord?.matchmaking?.source || null,
      matchmakingCandidates: fileRecord?.matchmaking?.candidates?.length || 0,
    };

    // 7) Provider reward/token verification (wallet balances)
    if (TOKEN_ADDR && RPC_URL) {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const abi = [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
      ];
      const token = new ethers.Contract(TOKEN_ADDR, abi, provider);
      const decimals = await token.decimals();

      const walletChecks = [];
      for (const w of [...cliWallets, ...providerUsers.map((x) => x.wallet)]) {
        const bal = await token.balanceOf(w);
        walletChecks.push({ wallet: w, sctBalance: ethers.formatUnits(bal, decimals) });
      }
      summary.tokenBalances = walletChecks;
    }

    console.log('\n=== E2E FLOW SUMMARY (REAL RUN) ===');
    console.log(JSON.stringify(summary, null, 2));

    // lightweight pass/fail markers
    const hardChecks = {
      fourCliProvidersOnline: summary.cliProviders.filter((p) => p.status === 'online').length === 4,
      cliRewardsRecorded: summary.cliProviders.every((p) => Number(p.totalEarnings || 0) >= 0.3),
      fourStorageProvidersVisible: summary.storageProviders.length >= 4,
      real5MBUploaded: Number(summary.upload?.fileSize) === 5 * 1024 * 1024,
      encryptionApplied: summary.backups?.isEncrypted && summary.backups?.ivPresent && summary.backups?.encryptedKeyPresent,
      pinataBackedUp: !!summary.backups?.ipfsCid,
      s3BackedUp: !!summary.backups?.cloudBackupPath,
      onChainStored: !!summary.backups?.onChainTxHash,
      primaryReplicationOk: !!summary.replication?.allPrimaryStored,
      replicaReplicationOk: !!summary.replication?.allReplicaStored,
      retrievalIntegrityOk: !!summary.retrieval?.hashMatch,
      aiScoringOk: (summary.ai?.rankedCount || 0) >= 4,
      matchmakingReturned: (summary.retrieval?.matchmakingCandidates || 0) > 0,
    };

    console.log('\n=== CHECKS ===');
    console.log(JSON.stringify(hardChecks, null, 2));

  } catch (err) {
    console.error('\nE2E FLOW FAILED');
    console.error(err.response?.data || err.message);
    process.exitCode = 1;
  } finally {
    for (const c of agentChildren) {
      try {
        c.kill('SIGINT');
      } catch (_) {}
    }
    await sleep(1000);
    console.log('\n=== E2E MAIN FLOW TEST END ===\n');
  }
}

main();
