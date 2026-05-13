const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const axios = require('axios');
const authMiddleware = require('../middleware/authMiddleware');
const FileRecord = require('../models/FileRecord');
const StorageListing = require('../models/StorageListing');
const User = require('../models/User');
const FileAccess = require('../models/FileAccess');
const PendingChunk = require('../models/PendingChunk');
const { shardBuffer, reassembleChunks } = require('../services/fileService');
const { pinBuffer } = require('../services/pinataService');
const { rewardProvider } = require('../services/tokenService');
const Transaction = require('../models/Transaction');
const { logActivity } = require('../services/activityLogger');
const encryptionService = require('../services/encryptionService');
const scoringService = require('../services/scoringService');
const cloudBackupService = require('../services/cloudBackupService');
const blockchainService = require('../services/blockchainService');
const previewService   = require('../services/previewService');
const { estimateSystemPricePerGB } = require('../services/pricingService');

function buildProcessing(stage, progressPct, detail = '', status = 'processing', error = '') {
  return {
    stage,
    progressPct,
    detail,
    status,
    error,
    updatedAt: new Date(),
  };
}

async function updateFileProcessing(fileId, stage, progressPct, detail = '', status = 'processing', error = '') {
  await FileRecord.findByIdAndUpdate(fileId, {
    processing: buildProcessing(stage, progressPct, detail, status, error),
  });
}

// No file size limit — chunked streaming handles large files
const upload = multer({
  storage: multer.memoryStorage(),
});

const AGENT_KEY = process.env.BACKEND_AGENT_KEY || 'agent-secret-key';

// ─── POST /api/storage/upload ──────────────────────────────────────────────
// Encrypt → shard → distribute to primary + replica agents → respond immediately
// Background: IPFS pin, S3 backup, on-chain record
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file provided' });

  let fileRecord = null;

  try {
    const { buffer, originalname, size, mimetype } = req.file;
    const walletAddress = req.body.walletAddress || '';

    // Quota enforcement for seekers
    if (req.user.role === 'seeker') {
      const seeker = await User.findById(req.user.id).select('plan storageQuotaGB usedStorageGB');
      const quotaGB = seeker?.storageQuotaGB ?? 2;
      const usedGB  = seeker?.usedStorageGB  ?? 0;
      const fileGB  = size / (1024 ** 3);
      if (usedGB + fileGB > quotaGB) {
        return res.status(507).json({
          message: `Storage quota exceeded. Used ${usedGB.toFixed(2)} GB of ${quotaGB} GB. Upgrade your plan to upload more.`,
          usedGB,
          quotaGB,
          plan: seeker?.plan || 'free',
        });
      }
      const { PLANS } = require('../config/plans');
      const plan = PLANS[seeker?.plan || 'free'];
      const maxUploadBytes = (plan?.maxUploadMB ?? 100) * 1024 * 1024;
      if (size > maxUploadBytes) {
        return res.status(413).json({
          message: `File too large for your ${plan?.name || 'Free'} plan. Max upload size is ${plan?.maxUploadMB ?? 100} MB. Upgrade to upload larger files.`,
          maxUploadMB: plan?.maxUploadMB ?? 100,
          plan: seeker?.plan || 'free',
        });
      }
    }

    // 1. SHA-256 integrity hash of the original plaintext
    const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

    logActivity('upload', `📁 Upload started: "${originalname}"`, {
      fileId: null, fileName: originalname,
      fileSize: `${(size / 1024).toFixed(1)} KB`,
      mimeType: mimetype,
      user: req.user.email || req.user.id,
    });

    fileRecord = await FileRecord.create({
      userId:       req.user.id,
      walletAddress,
      fileName:     originalname,
      fileSize:     size,
      mimeType:     mimetype,
      sha256Hash,
      processing:   buildProcessing('encrypting', 12, 'Encrypting the file before any storage writes'),
    });

    // 1.5. Generate preview BEFORE encryption — thumbnail / text snippet from plaintext
    //      This runs on the original bytes; after encryption it would be impossible.
    let previewData = null;
    try {
      previewData = await previewService.generatePreview(buffer, mimetype);
    } catch (e) {
      console.warn('[Storage] Preview generation skipped:', e.message);
    }

    // 2. Encrypt with AES-256-GCM
    logActivity('encrypt', `🔐 AES-256-GCM encryption started for "${originalname}"`, {
      fileId: fileRecord._id.toString(), fileSize: `${(size / 1024).toFixed(1)} KB`,
    });
    const { encryptedBuffer, encryptedKey, iv } = encryptionService.encrypt(buffer);
    logActivity('encrypt', `✅ AES-256-GCM encryption complete — encrypted size: ${(encryptedBuffer.length / 1024).toFixed(1)} KB`, {
      fileId: fileRecord._id.toString(), encryptedSize: `${(encryptedBuffer.length / 1024).toFixed(1)} KB`,
    });
    await FileRecord.findByIdAndUpdate(fileRecord._id, {
      isEncrypted: true,
      encryptedKey,
      iv,
      previewType: previewData?.previewType ?? null,
      thumbnailDataUrl: previewData?.thumbnailDataUrl ?? null,
      previewText: previewData?.previewText ?? null,
      processing: buildProcessing('matchmaking', 28, 'AI matchmaking is selecting the best storage providers'),
    });

    // 3. Score and rank active, non-paused, non-suspended providers
    logActivity('matchmake', `🤖 AI matchmaking — scanning active providers...`, { fileId: fileRecord._id.toString() });
    const rawProviders = await StorageListing.find({ isActive: true, isSuspended: { $ne: true } });
    const rankedProviders = await scoringService.rankProviders(rawProviders);
    const uniqueByAgent = new Map();
    for (const provider of rankedProviders) {
      const key = String(provider.agentUrl || '').trim();
      if (!key) continue;
      if (!uniqueByAgent.has(key)) {
        uniqueByAgent.set(key, provider);
      }
    }
    const providers = [...uniqueByAgent.values()];

    logActivity('matchmake', `✅ AI matchmaking complete — ${providers.length} provider(s) ranked and selected`, {
      fileId: fileRecord._id.toString(),
      topProvider: providers[0]?.agentUrl,
      topScore: providers[0]?.matchScore,
      totalCandidates: providers.length,
    });

    if (providers.length === 0) {
      await updateFileProcessing(fileRecord._id, 'failed', 100, 'No storage providers are currently available', 'failed', 'No storage providers available');
      return res.status(503).json({ message: 'No storage providers available' });
    }

    const matchmakingCandidates = providers.slice(0, Math.min(5, providers.length)).map((provider) => ({
      agentUrl: provider.agentUrl,
      walletAddress: provider.walletAddress || '',
      region: provider.region || 'local',
      systemPricePerGB: provider.systemPricePerGB || estimateSystemPricePerGB(provider),
      score: Number((provider.matchScore ?? scoringService.scoreLocally(provider)).toFixed(4)),
      selectedRole: '',
      source: provider.matchSource || 'local',
    }));

    await FileRecord.findByIdAndUpdate(fileRecord._id, {
      matchmaking: {
        source: providers[0]?.matchSource || 'local',
        summary: `Matched ${providers.length} active providers and selected the best nodes for encrypted chunk placement`,
        candidates: matchmakingCandidates,
        selectedCount: 0,
      },
      processing: buildProcessing('splitting', 42, 'Splitting the encrypted file into provider chunks'),
    });

    // 4. Shard the encrypted buffer (up to 2 shards with at least 2 providers)
    const numShards = providers.length >= 2 ? 2 : 1;
    const chunks = shardBuffer(encryptedBuffer, numShards);
    logActivity('chunk', `✂️ File split into ${chunks.length} encrypted chunk${chunks.length !== 1 ? 's' : ''}`, {
      fileId: fileRecord._id.toString(),
      chunkCount: chunks.length,
      chunkIds: chunks.map(c => c.chunkId.slice(0, 8) + '…'),
      totalEncryptedSize: `${(encryptedBuffer.length / 1024).toFixed(1)} KB`,
    });
    await updateFileProcessing(fileRecord._id, 'storing', 58, `Uploading ${chunks.length} encrypted shard${chunks.length !== 1 ? 's' : ''} to provider storage`);

    // 5. Upload each chunk to primary + replica agent
    //    Selection strategy: spread across MAX unique providers.
    //    For N chunks: primary[i] = providers[i], replica[i] = providers[N + i]
    //    This ensures no provider holds two different roles for different chunks
    //    (with 6 providers + 2 chunks: p0→chunk0-primary, p1→chunk1-primary,
    //     p2→chunk0-replica, p3→chunk1-replica — 4 unique providers used).
    const chunkMeta = [];
    for (let i = 0; i < chunks.length; i++) {
      const { chunkId, buffer: chunkBuffer } = chunks[i];
      const primary = providers[i % providers.length];

      // Pick replica from a DIFFERENT pool (offset by numShards) so primaries and replicas never overlap
      let replica = null;
      for (let offset = 1; offset <= providers.length; offset++) {
        const candidate = providers[(i + offset) % providers.length];
        if (candidate.agentUrl !== primary.agentUrl) {
          // Also avoid re-using any provider already assigned as a primary in this batch
          const alreadyPrimary = chunkMeta.some(cm => cm.providerUrl === candidate.agentUrl);
          if (!alreadyPrimary || providers.length <= chunks.length) {
            replica = candidate;
            break;
          }
        }
      }

      logActivity('provider', `📤 Uploading chunk ${i + 1}/${chunks.length} → Provider: ${primary.agentUrl.replace(/https?:\/\//, '')}`, {
        fileId: fileRecord._id.toString(),
        chunkId: chunkId.slice(0, 12) + '…',
        chunkIndex: i,
        providerUrl: primary.agentUrl,
        chunkSize: `${(chunkBuffer.length / 1024).toFixed(1)} KB`,
        replicaUrl: replica?.agentUrl || 'none',
      });

      const primaryUpload = axios.post(`${primary.agentUrl}/chunk`, chunkBuffer, {
        headers: {
          'x-chunk-id':   chunkId,
          'x-agent-key':  AGENT_KEY,
          'Content-Type': 'application/octet-stream',
        },
        timeout: 10000,
      });

      const replicaUpload = replica
        ? axios.post(`${replica.agentUrl}/chunk`, chunkBuffer, {
            headers: {
              'x-chunk-id':   chunkId,
              'x-agent-key':  AGENT_KEY,
              'Content-Type': 'application/octet-stream',
            },
            timeout: 10000,
          })
        : Promise.resolve();

      const [primaryResult, replicaResult] = await Promise.allSettled([primaryUpload, replicaUpload]);

      const primaryOk = primaryResult.status === 'fulfilled';
      const replicaOk = replica && replicaResult.status === 'fulfilled';

      if (primaryOk) {
        logActivity('provider', `✅ Chunk ${i + 1} stored on primary provider (${primary.agentUrl.replace(/https?:\/\//, '')})`, {
          chunkId: chunkId.slice(0, 12) + '…', providerUrl: primary.agentUrl, role: 'primary',
        });
      } else {
        logActivity('error', `⚠️ Primary upload failed for chunk ${i + 1} — queued for pull`, {
          chunkId: chunkId.slice(0, 12) + '…', providerUrl: primary.agentUrl,
          error: primaryResult.reason?.message,
        });
      }
      if (replicaOk) {
        logActivity('replica', `🔁 Chunk ${i + 1} replicated → ${replica.agentUrl.replace(/https?:\/\//, '')}`, {
          chunkId: chunkId.slice(0, 12) + '…', replicaUrl: replica.agentUrl, role: 'replica',
        });
      }

      if (!primaryOk) {
        console.warn(`[Storage] Primary upload failed for chunk ${chunkId}: ${primaryResult.reason?.message}`);
        // Queue for agent to pull (handles home-PC NAT / firewall)
        try {
          await PendingChunk.create({ chunkId, providerId: primary.providerId, data: chunkBuffer });
          console.log(`[Storage] Chunk ${chunkId} queued for provider pull (${primary.providerId})`);
        } catch (qErr) {
          console.warn(`[Storage] Failed to queue chunk ${chunkId}:`, qErr.message);
        }
      }

      // Reward providers non-blocking — mint SCT + record Transaction so earnings show in analytics
      if (primaryOk && primary.walletAddress) {
        rewardProvider(primary.walletAddress, 10)
          .then(txHash => {
            logActivity('reward', `🪙 10 SCT reward sent to primary provider`, {
              wallet: primary.walletAddress.slice(0, 10) + '…',
              amount: '10 SCT', role: 'primary', txHash: txHash ? txHash.slice(0, 16) + '…' : '',
            });
            Transaction.create({
              type: 'reward', paymentMethod: 'reward', status: 'completed',
              providerId:    primary.providerId,
              providerWallet: primary.walletAddress,
              amountSCT: 10, txHash: txHash || '',
            }).catch(() => {});
            StorageListing.findByIdAndUpdate(primary._id, { $inc: { totalEarnings: 10 } }).catch(() => {});
          }).catch(() => {});
      }
      if (replicaOk && replica.walletAddress) {
        rewardProvider(replica.walletAddress, 5)
          .then(txHash => {
            logActivity('reward', `🪙 5 SCT reward sent to replica provider`, {
              wallet: replica.walletAddress.slice(0, 10) + '…',
              amount: '5 SCT', role: 'replica', txHash: txHash ? txHash.slice(0, 16) + '…' : '',
            });
            Transaction.create({
              type: 'reward', paymentMethod: 'reward', status: 'completed',
              providerId:    replica.providerId,
              providerWallet: replica.walletAddress,
              amountSCT: 5, txHash: txHash || '',
            }).catch(() => {});
            StorageListing.findByIdAndUpdate(replica._id, { $inc: { totalEarnings: 5 } }).catch(() => {});
          }).catch(() => {});
      }

      chunkMeta.push({
        chunkId,
        chunkIndex:        i,
        providerUrl:       primary.agentUrl,
        replicaProviderUrl: replicaOk ? replica.agentUrl : '',
        providerWalletAddress: primary.walletAddress || '',
        replicaWalletAddress: replicaOk ? (replica.walletAddress || '') : '',
        providerRegion: primary.region || 'local',
        replicaRegion: replicaOk ? (replica.region || 'local') : '',
        providerScore: Number((primary.matchScore ?? scoringService.scoreLocally(primary)).toFixed(4)),
        replicaScore: replicaOk ? Number((replica.matchScore ?? scoringService.scoreLocally(replica)).toFixed(4)) : 0,
        size:              chunkBuffer.length,
        ipfsCid: '',  // filled in background after per-chunk IPFS pin
      });

      console.log(`[Storage] Chunk ${i} → primary=${primary.agentUrl} replica=${replicaOk ? replica.agentUrl : 'none'} (${(chunkBuffer.length/1024).toFixed(0)} KB)`);

      await updateFileProcessing(
        fileRecord._id,
        'storing',
        58 + Math.round(((i + 1) / chunks.length) * 10),
        `Stored shard ${i + 1}/${chunks.length}${replicaOk ? ' with replication' : ''}`,
      );
    }

    const selectedAgentUrls = new Set(chunkMeta.flatMap((chunk) => [chunk.providerUrl, chunk.replicaProviderUrl].filter(Boolean)));
    const candidateRoles = matchmakingCandidates.map((candidate) => ({
      ...candidate,
      selectedRole: selectedAgentUrls.has(candidate.agentUrl) ? 'selected' : 'candidate',
    }));

    // 6. Persist file record immediately
    fileRecord = await FileRecord.findByIdAndUpdate(fileRecord._id, {
      chunks:          chunkMeta,
      matchmaking: {
        source: providers[0]?.matchSource || 'local',
        summary: `AI matchmaking selected ${selectedAgentUrls.size} provider endpoint${selectedAgentUrls.size !== 1 ? 's' : ''} for encrypted storage and replication`,
        candidates: candidateRoles,
        selectedCount: selectedAgentUrls.size,
      },
      processing: buildProcessing('provider_storage_complete', 70, 'Encrypted shards stored on providers; backup replication is continuing'),
    }, { new: true });

    // Increment seeker's used storage quota
    if (req.user.role === 'seeker') {
      const fileGB = size / (1024 ** 3);
      User.findByIdAndUpdate(req.user.id, { $inc: { usedStorageGB: fileGB } }).catch(() => {});
    }

    // 7. Respond to client without waiting for background tasks
    res.status(201).json({
      message:    'File uploaded successfully',
      fileId:     fileRecord._id,
      fileName:   originalname,
      fileSize:   size,
      sha256Hash,
      shardCount: chunkMeta.length,
      processing: fileRecord.processing,
      matchmaking: fileRecord.matchmaking,
    });

    // 8. Background: IPFS pin → cloud backup → on-chain registration
    setImmediate(async () => {
      // Look up seeker's wallet from their User profile
      let seekerWallet = walletAddress;
      if (!seekerWallet) {
        try {
          const user = await User.findById(req.user.id).select('walletAddress');
          seekerWallet = user?.walletAddress || '';
        } catch { /* ignore */ }
      }

      // Collect provider wallet addresses for the chunks we distributed
      const providerWallets = [];
      for (const chunk of chunkMeta) {
        try {
          const listing = await StorageListing.findOne({ agentUrl: chunk.providerUrl }).select('walletAddress');
          if (listing?.walletAddress) providerWallets.push(listing.walletAddress);
        } catch { /* ignore */ }
      }

      // IPFS pin — full encrypted file (Tier-3 fallback for download)
      let finalCid = '';
      try {
        logActivity('ipfs', `📌 Pinning full encrypted file to Pinata/IPFS...`, {
          fileId: fileRecord._id.toString(), fileName: originalname,
        });
        await updateFileProcessing(fileRecord._id, 'pinata_backup', 78, 'Backing up the encrypted full file to Pinata');
        finalCid = await pinBuffer(encryptedBuffer, originalname + '.enc');
        await FileRecord.findByIdAndUpdate(fileRecord._id, { ipfsCid: finalCid });
        logActivity('ipfs', `✅ Full file pinned to IPFS — CID: ${finalCid.slice(0, 20)}…`, {
          fileId: fileRecord._id.toString(), cid: finalCid,
        });
        console.log(`[Storage] IPFS full-file backup complete: ${finalCid}`);
      } catch (e) {
        console.warn('[Storage] IPFS full-file pin failed:', e.message);
      }

      // Pin each individual chunk to IPFS for per-chunk Tier-3 recovery
      // This enables: if 1 provider + its replica are both offline, only THAT chunk
      // is fetched from IPFS (not the whole file), saving bandwidth.
      try {
        const updatedChunks = [...chunkMeta];
        for (let ci = 0; ci < chunks.length; ci++) {
          try {
            const chunkCid = await pinBuffer(chunks[ci].buffer, `chunk_${chunkMeta[ci].chunkId}.enc`);
            updatedChunks[ci] = { ...updatedChunks[ci], ipfsCid: chunkCid };
            logActivity('ipfs', `📌 Chunk ${ci + 1} pinned to IPFS — CID: ${chunkCid.slice(0, 16)}…`, {
              chunkIndex: ci, chunkId: chunkMeta[ci].chunkId.slice(0, 12) + '…', cid: chunkCid,
            });
            console.log(`[Storage] Chunk ${ci} pinned to IPFS: ${chunkCid}`);
          } catch (e2) {
            console.warn(`[Storage] Chunk ${ci} IPFS pin failed (non-critical):`, e2.message);
          }
        }
        await FileRecord.findByIdAndUpdate(fileRecord._id, { chunks: updatedChunks });
      } catch (e) {
        console.warn('[Storage] Per-chunk IPFS pin step failed:', e.message);
      }

      // Pin preview thumbnail to Pinata (unencrypted — it is not sensitive)
      if (previewData?.thumbnailBuffer) {
        try {
          const previewCid = await pinBuffer(previewData.thumbnailBuffer, `preview_${originalname}.jpg`);
          await FileRecord.findByIdAndUpdate(fileRecord._id, { previewCid });
          console.log(`[Storage] Thumbnail pinned: ${previewCid}`);
        } catch (e) {
          console.warn('[Storage] Thumbnail pin failed (non-critical):', e.message);
        }
      }

      // Cloud backup (stub — no-op until April 30)
      try {
        logActivity('s3', `☁️ Writing encrypted disaster-recovery backup to AWS S3...`, {
          fileId: fileRecord._id.toString(), fileName: originalname,
        });
        await updateFileProcessing(fileRecord._id, 'cloud_backup', 88, 'Writing encrypted disaster-recovery backup to S3');
        const cloudPath = await cloudBackupService.upload(encryptedBuffer, fileRecord.fileName || originalname, fileRecord._id.toString());
        if (cloudPath) {
          await FileRecord.findByIdAndUpdate(fileRecord._id, { cloudBackupPath: cloudPath });
          logActivity('s3', `✅ AWS S3 backup complete`, { fileId: fileRecord._id.toString(), path: cloudPath });
          console.log(`[Storage] Cloud backup complete: ${cloudPath}`);
        }
      } catch (e) {
        console.warn('[Storage] Cloud backup failed:', e.message);
      }

      // On-chain registration via StoraChainStorage.storeFile
      try {
        logActivity('chain', `⛓️ Recording file metadata on Sepolia blockchain...`, {
          fileId: fileRecord._id.toString(), sha256: sha256Hash.slice(0, 16) + '…',
          seekerWallet: seekerWallet ? seekerWallet.slice(0, 10) + '…' : 'none',
          providerCount: providerWallets.length,
        });
        await updateFileProcessing(fileRecord._id, 'blockchain', 96, 'Recording storage placement and backup metadata on-chain');
        const txHash = await blockchainService.storeFile(
          sha256Hash,
          finalCid,
          seekerWallet,
          providerWallets,
          size,
        );
        if (txHash) {
          await FileRecord.findByIdAndUpdate(fileRecord._id, { onChainTxHash: txHash, txHash });
          logActivity('chain', `✅ On-chain registration confirmed — TX: ${txHash.slice(0, 18)}…`, {
            fileId: fileRecord._id.toString(), txHash, network: 'Sepolia',
          });
          console.log(`[Blockchain] File registered on-chain: ${txHash}`);
        }
      } catch (e) {
        console.warn('[Blockchain] On-chain registration failed:', e.message);
      }

      await updateFileProcessing(fileRecord._id, 'completed', 100, 'Upload completed. Retrieval will prefer providers, then replica, then Pinata, then S3.', 'completed');
      logActivity('upload', `🎉 Upload pipeline complete for "${originalname}"`, {
        fileId: fileRecord._id.toString(),
        fileName: originalname,
        stages: 'encrypt → shard → provider → replica → IPFS → S3 → blockchain',
      });
    });

  } catch (err) {
    console.error('[Storage] Upload error:', err.message);
    if (fileRecord?._id) {
      await updateFileProcessing(fileRecord._id, 'failed', 100, 'Upload failed before storage completed', 'failed', err.message);
    }
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

// ─── GET /api/storage/files/:fileId/preview ─────────────────────────────
// Returns thumbnail image (JPEG) for image files, or JSON text snippet for PDF/text.
// Served with Cache-Control so browsers cache the thumbnail.
// Must be registered BEFORE /files/:fileId to avoid route conflicts.
router.get('/files/:fileId/preview', authMiddleware, async (req, res) => {
  try {
    const file = await FileRecord.findOne({ _id: req.params.fileId, isDeleted: false });
    if (!file) return res.status(404).json({ message: 'File not found' });

    // Access check: file owner OR FileAccess grant
    const isOwner = file.userId.toString() === req.user.id;
    if (!isOwner) {
      const access = await FileAccess.findOne({
        buyerUserId:  req.user.id,
        fileRecordId: file._id,
        isActive:     true,
      });
      if (!access) return res.status(403).json({ message: 'Access denied' });
    }

    // Serve thumbnail from DB base64 (fastest — no extra network hop)
    if (file.thumbnailDataUrl) {
      const b64  = file.thumbnailDataUrl.split(',')[1];
      const data = Buffer.from(b64, 'base64');
      res.set('Content-Type',  'image/jpeg');
      res.set('Cache-Control', 'private, max-age=86400');
      return res.send(data);
    }

    // Redirect to Pinata CDN if thumbnail was pinned there
    if (file.previewCid && file.previewType === 'image-thumb') {
      return res.redirect(`https://gateway.pinata.cloud/ipfs/${file.previewCid}`);
    }

    // Text / PDF snippet
    if (file.previewText) {
      return res.json({
        previewType: file.previewType,
        previewText: file.previewText,
        fileName:    file.fileName,
        fileSize:    file.fileSize,
      });
    }

    res.status(404).json({ message: 'No preview available for this file type' });
  } catch (err) {
    console.error('[Storage] Preview error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/storage/files ────────────────────────────────────────────────
// Return all non-deleted file records for the authenticated user.
// thumbnailDataUrl is excluded from the list for performance; use /preview endpoint.
router.get('/files', authMiddleware, async (req, res) => {
  try {
    const files = await FileRecord.find({ userId: req.user.id, isDeleted: false })
      .select('-thumbnailDataUrl')   // omit base64 thumbnail from list (use /preview)
      .sort({ createdAt: -1 });
    res.json(files);
  } catch (err) {
    console.error('[Storage] List error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/storage/files/:fileId ──────────────────────────────────────
// Return a single file record (used by frontend to poll for onChainTxHash)
router.get('/files/:fileId', authMiddleware, async (req, res) => {
  try {
    const file = await FileRecord.findOne({ _id: req.params.fileId, userId: req.user.id, isDeleted: false });
    if (!file) return res.status(404).json({ message: 'File not found' });
    res.json(file);
  } catch (err) {
    console.error('[Storage] File fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/storage/download/:fileId ────────────────────────────────────
// 4-tier retrieval: primary agent → replica agent → IPFS → S3
// Decrypts and verifies SHA-256 integrity before returning file
router.get('/download/:fileId', authMiddleware, async (req, res) => {
  try {
    const fileRecord = await FileRecord.findOne({
      _id:       req.params.fileId,
      isDeleted: false,
    });
    if (!fileRecord) return res.status(404).json({ message: 'File not found' });

    // Access check: file owner OR FileAccess grant
    const isOwner = fileRecord.userId.toString() === req.user.id;
    if (!isOwner) {
      const access = await FileAccess.findOne({
        buyerUserId:  req.user.id,
        fileRecordId: fileRecord._id,
        isActive:     true,
      });
      if (!access) return res.status(403).json({ message: 'Access denied' });
    }

    const sortedChunks = [...fileRecord.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const fileLabel = `[Download][${fileRecord.fileName}]`;
    logActivity('download', `⬇️ Download requested: "${fileRecord.fileName}"`, {
      fileId: fileRecord._id.toString(),
      fileName: fileRecord.fileName,
      fileSize: `${(fileRecord.fileSize / 1024).toFixed(1)} KB`,
      user: req.user.email || req.user.id,
      chunkCount: sortedChunks.length,
    });
    console.log(`${fileLabel} Starting retrieval. Chunks: ${sortedChunks.length}, Tiers: provider → replica → chunk-IPFS → full-IPFS → S3`);

    // ── Tier 1, 2 & 3(per-chunk): fetch each chunk independently ─────────
    let tierUsed = 'provider';
    const chunkBuffers = await Promise.all(sortedChunks.map(async (chunk, idx) => {
      // Tier 1: primary provider
      if (chunk.providerUrl) {
        try {
          const t0 = Date.now();
          const r = await axios.get(`${chunk.providerUrl}/chunk/${chunk.chunkId}`, {
            headers:      { 'x-agent-key': AGENT_KEY },
            responseType: 'arraybuffer',
            timeout:      15000,
          });
          console.log(`${fileLabel} Chunk ${idx} ← Tier-1 provider (${chunk.providerUrl}) in ${Date.now()-t0}ms`);
          return Buffer.from(r.data);
        } catch (e) {
          console.warn(`${fileLabel} Chunk ${idx} Tier-1 FAILED (${chunk.providerUrl}): ${e.message}`);
        }
      }

      // Tier 2: replica provider
      if (chunk.replicaProviderUrl) {
        try {
          const t0 = Date.now();
          const r = await axios.get(`${chunk.replicaProviderUrl}/chunk/${chunk.chunkId}`, {
            headers:      { 'x-agent-key': AGENT_KEY },
            responseType: 'arraybuffer',
            timeout:      15000,
          });
          console.log(`${fileLabel} Chunk ${idx} ← Tier-2 REPLICA (${chunk.replicaProviderUrl}) in ${Date.now()-t0}ms`);
          tierUsed = 'replica';
          return Buffer.from(r.data);
        } catch (e) {
          console.warn(`${fileLabel} Chunk ${idx} Tier-2 FAILED (${chunk.replicaProviderUrl}): ${e.message}`);
        }
      }

      // Tier 3a: per-chunk IPFS CID (most efficient — only fetches this one chunk)
      if (chunk.ipfsCid) {
        try {
          const t0 = Date.now();
          const r = await axios.get(`https://gateway.pinata.cloud/ipfs/${chunk.ipfsCid}`, {
            responseType: 'arraybuffer', timeout: 30000,
          });
          console.log(`${fileLabel} Chunk ${idx} ← Tier-3a chunk-IPFS (${chunk.ipfsCid}) in ${Date.now()-t0}ms`);
          tierUsed = 'IPFS-chunk';
          return Buffer.from(r.data);
        } catch (e) {
          console.warn(`${fileLabel} Chunk ${idx} Tier-3a chunk-IPFS FAILED: ${e.message}`);
        }
      }

      return null; // will trigger full-file fallback
    }));

    let encryptedBuffer = null;

    if (chunkBuffers.every(b => b !== null)) {
      // All chunks retrieved from provider/replica agents — reassemble
      encryptedBuffer = chunkBuffers.length === 1
        ? chunkBuffers[0]
        : reassembleChunks(chunkBuffers);
      logActivity('download', `✅ ${chunkBuffers.length} chunk(s) retrieved via ${tierUsed} — reassembling...`, {
        chunkCount: chunkBuffers.length, tier: tierUsed,
        totalSize: `${(encryptedBuffer.length / 1024).toFixed(1)} KB`,
      });
      console.log(`${fileLabel} ✅ Reassembled ${chunkBuffers.length} chunk(s) from ${tierUsed} tier. Size: ${encryptedBuffer.length} bytes`);
    } else {
      const failedCount = chunkBuffers.filter(b => b === null).length;
      console.warn(`${fileLabel} ⚠️  ${failedCount}/${sortedChunks.length} chunks unavailable from providers/replicas/chunk-IPFS. Falling back to full-file...`);

      // Tier 3b: full-file IPFS fallback (when per-chunk IPFS also failed / not yet pinned)
      if (fileRecord.ipfsCid) {
        try {
          const t0 = Date.now();
          console.log(`${fileLabel} Tier-3b: fetching full encrypted file from IPFS CID ${fileRecord.ipfsCid}`);
          const ipfsRes = await axios.get(
            `https://gateway.pinata.cloud/ipfs/${fileRecord.ipfsCid}`,
            { responseType: 'arraybuffer', timeout: 60000 }
          );
          encryptedBuffer = Buffer.from(ipfsRes.data);
          tierUsed = 'IPFS-full';
          console.log(`${fileLabel} ✅ Tier-3b IPFS full-file succeeded in ${Date.now()-t0}ms. Size: ${encryptedBuffer.length} bytes`);
        } catch (e) {
          console.warn(`${fileLabel} Tier-3b IPFS full-file FAILED: ${e.message}`);
        }
      }

      // Tier 4: cloud S3 fallback
      if (!encryptedBuffer && fileRecord.cloudBackupPath) {
        const t0 = Date.now();
        console.log(`${fileLabel} Tier-4: fetching full encrypted file from S3 backup ${fileRecord.cloudBackupPath}`);
        encryptedBuffer = await cloudBackupService.download(fileRecord.cloudBackupPath);
        tierUsed = 'S3';
        console.log(`${fileLabel} ✅ Tier-4 S3 succeeded in ${Date.now()-t0}ms. Size: ${encryptedBuffer?.length} bytes`);
      }

      if (!encryptedBuffer) {
        console.error(`${fileLabel} ❌ All 4 tiers exhausted — file unavailable.`);
        return res.status(503).json({ message: 'File unavailable — all storage tiers failed' });
      }
    }

    // ── Decrypt ────────────────────────────────────────────────────────────
    let outputBuffer = encryptedBuffer;
    if (fileRecord.isEncrypted && fileRecord.encryptedKey && fileRecord.iv) {
      try {
        const t0 = Date.now();
        outputBuffer = encryptionService.decrypt(encryptedBuffer, fileRecord.encryptedKey, fileRecord.iv);
        console.log(`${fileLabel} Decrypted in ${Date.now()-t0}ms. Plain size: ${outputBuffer.length} bytes`);
      } catch (e) {
        console.error(`${fileLabel} ❌ Decryption failed: ${e.message}`);
        return res.status(500).json({ message: 'Decryption failed — file may be corrupted' });
      }
    }

    // ── SHA-256 integrity verification ────────────────────────────────────
    if (fileRecord.sha256Hash) {
      const t0 = Date.now();
      const actualHash = crypto.createHash('sha256').update(outputBuffer).digest('hex');
      if (actualHash !== fileRecord.sha256Hash) {
        logActivity('error', `❌ SHA-256 integrity check FAILED for "${fileRecord.fileName}"`, {
          fileId: fileRecord._id.toString(), expected: fileRecord.sha256Hash.slice(0, 16) + '…',
          actual: actualHash.slice(0, 16) + '…',
        });
        console.error(`${fileLabel} ❌ Integrity check FAILED — hash mismatch (tier: ${tierUsed})`);
        return res.status(500).json({ message: 'File integrity check failed — data may be corrupted' });
      }
      logActivity('download', `✅ SHA-256 integrity verified — serving "${fileRecord.fileName}" to user`, {
        fileId: fileRecord._id.toString(), tier: tierUsed,
        plainSize: `${(outputBuffer.length / 1024).toFixed(1)} KB`,
      });
      console.log(`${fileLabel} ✅ SHA-256 integrity verified in ${Date.now()-t0}ms (tier: ${tierUsed})`);
    }

    console.log(`${fileLabel} ✅ Serving ${outputBuffer.length} bytes via ${tierUsed} tier`);
    res.set('Content-Disposition', `attachment; filename="${fileRecord.fileName}"`);
    res.set('Content-Type', fileRecord.mimeType);
    res.set('X-Storage-Tier', tierUsed); // header so frontend can show which tier served the file
    res.send(outputBuffer);

    // Fire-and-forget: record download on-chain
    if (fileRecord.sha256Hash) {
      (async () => {
        try {
          const downloaderUser = await User.findById(req.user.id).select('walletAddress');
          const downloaderWallet = downloaderUser?.walletAddress || '';
          await blockchainService.recordDownload(fileRecord.sha256Hash, downloaderWallet);
        } catch { /* non-critical */ }
      })();
    }
  } catch (err) {
    console.error('[Storage] Download error:', err.message);
    res.status(500).json({ message: 'Download failed', error: err.message });
  }
});

// ─── DELETE /api/storage/files/:fileId ────────────────────────────────────
// Soft-delete a file record (chunk data remains on agents until cleanup)
router.delete('/files/:fileId', authMiddleware, async (req, res) => {
  try {
    const file = await FileRecord.findOne({ _id: req.params.fileId, userId: req.user.id });
    if (!file) return res.status(404).json({ message: 'File not found' });
    file.isDeleted = true;
    await file.save();
    res.json({ message: 'File deleted' });
  } catch (err) {
    console.error('[Storage] Delete error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUT /api/storage/files/:fileId/txhash ───────────────────────────────
router.put('/files/:fileId/txhash', authMiddleware, async (req, res) => {
  const { txHash } = req.body;
  if (!txHash) return res.status(400).json({ message: 'txHash is required' });
  try {
    const file = await FileRecord.findOne({ _id: req.params.fileId, userId: req.user.id });
    if (!file) return res.status(404).json({ message: 'File not found' });
    file.onChainTxHash = txHash;
    file.txHash = txHash;
    await file.save();
    res.json({ message: 'Transaction hash saved', txHash });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PATCH /api/storage/files/:fileId/settings ───────────────────────────
router.patch('/files/:fileId/settings', authMiddleware, async (req, res) => {
  try {
    const { visibility, isLocked, priceUSD, priceSCT,
            marketplaceTitle, marketplaceDesc, marketplaceCategory } = req.body;

    const file = await FileRecord.findOne({ _id: req.params.fileId, userId: req.user.id, isDeleted: false });
    if (!file) return res.status(404).json({ message: 'File not found' });

    if (visibility && ['private','public','shared'].includes(visibility)) file.visibility = visibility;
    if (typeof isLocked === 'boolean') file.isLocked = isLocked;
    if (typeof priceUSD === 'number')  file.priceUSD = Math.max(0, priceUSD);
    if (typeof priceSCT === 'number')  file.priceSCT = Math.max(0, priceSCT);
    if (marketplaceTitle    !== undefined) file.marketplaceTitle    = marketplaceTitle;
    if (marketplaceDesc     !== undefined) file.marketplaceDesc     = marketplaceDesc;
    if (marketplaceCategory !== undefined) file.marketplaceCategory = marketplaceCategory;

    await file.save(); // pre-save hook sets shareToken if missing

    const origin = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.json({
      message:    'Settings updated',
      shareToken: file.shareToken,
      shareUrl:   `${origin}/share/${file.shareToken}`,
      visibility: file.visibility,
      isLocked:   file.isLocked,
    });
  } catch (err) {
    console.error('[Storage] Settings error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/storage/public/:shareToken ─────────────────────────────────
router.get('/public/:shareToken', async (req, res) => {
  try {
    const file = await FileRecord.findOne({ shareToken: req.params.shareToken, isDeleted: false })
      .populate('userId', 'name avatarColor');
    if (!file) return res.status(404).json({ error: 'File not found' });

    let requesterId = null;
    const ah = req.headers.authorization;
    if (ah?.startsWith('Bearer ')) {
      try { requesterId = require('jsonwebtoken').verify(ah.split(' ')[1], process.env.JWT_SECRET).id; } catch (_) {}
    }

    const isOwner = requesterId && requesterId === file.userId._id.toString();
    if (file.visibility === 'private' && !isOwner) {
      return res.status(403).json({ error: 'This file is private' });
    }

    let alreadyPurchased = false;
    if (!isOwner && file.isLocked && requesterId) {
      const access = await FileAccess.findOne({ buyerUserId: requesterId, fileRecordId: file._id, isActive: true });
      alreadyPurchased = !!access || file.purchasedBy.map(id => id.toString()).includes(requesterId);
    }

    res.json({
      _id: file._id, fileName: file.fileName, fileSize: file.fileSize, mimeType: file.mimeType,
      visibility: file.visibility, isLocked: file.isLocked,
      priceUSD: file.priceUSD || 0, priceSCT: file.priceSCT || 0,
      downloadCount: file.downloadCount || 0,
      marketplaceTitle: file.marketplaceTitle || '', marketplaceDesc: file.marketplaceDesc || '',
      marketplaceCategory: file.marketplaceCategory || '',
      previewCid: file.previewCid || null, previewType: file.previewType || null,
      ownerName: file.userId?.name || 'Unknown', shareToken: file.shareToken, createdAt: file.createdAt,
      isOwner: !!isOwner, alreadyPurchased,
    });
  } catch (err) {
    console.error('[Storage] Public metadata error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/storage/public/:shareToken/download ────────────────────────
router.get('/public/:shareToken/download', async (req, res) => {
  try {
    const file = await FileRecord.findOne({ shareToken: req.params.shareToken, isDeleted: false });
    if (!file) return res.status(404).json({ error: 'File not found' });

    let requesterId = null;
    const ah = req.headers.authorization;
    if (ah?.startsWith('Bearer ')) {
      try { requesterId = require('jsonwebtoken').verify(ah.split(' ')[1], process.env.JWT_SECRET).id; } catch (_) {}
    }

    const isOwner = requesterId && requesterId === file.userId.toString();

    if (file.visibility === 'private' && !isOwner) {
      return res.status(403).json({ error: 'This file is private' });
    }
    if (file.isLocked && !isOwner) {
      if (!requesterId) return res.status(401).json({ error: 'Login required' });
      const access = await FileAccess.findOne({ buyerUserId: requesterId, fileRecordId: file._id, isActive: true });
      const hasPurchased = !!access || file.purchasedBy.map(id => id.toString()).includes(requesterId);
      if (!hasPurchased) return res.status(403).json({ error: 'Purchase required to download this file' });
    }

    const sortedChunks = [...file.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const fileLabel = `[PublicDownload][${file.fileName}]`;
    console.log(`${fileLabel} Starting retrieval. Chunks: ${sortedChunks.length}`);

    let tierUsed = 'provider';
    const chunkBuffers = await Promise.all(sortedChunks.map(async (chunk, idx) => {
      // Tier 1: primary provider
      if (chunk.providerUrl) {
        try {
          const t0 = Date.now();
          const r = await axios.get(`${chunk.providerUrl}/chunk/${chunk.chunkId}`,
            { headers: { 'x-agent-key': AGENT_KEY }, responseType: 'arraybuffer', timeout: 15000 });
          console.log(`${fileLabel} Chunk ${idx} ← Tier-1 provider in ${Date.now()-t0}ms`);
          return Buffer.from(r.data);
        } catch (e) {
          console.warn(`${fileLabel} Chunk ${idx} Tier-1 FAILED: ${e.message}`);
        }
      }
      // Tier 2: replica
      if (chunk.replicaProviderUrl) {
        try {
          const t0 = Date.now();
          const r = await axios.get(`${chunk.replicaProviderUrl}/chunk/${chunk.chunkId}`,
            { headers: { 'x-agent-key': AGENT_KEY }, responseType: 'arraybuffer', timeout: 15000 });
          console.log(`${fileLabel} Chunk ${idx} ← Tier-2 REPLICA in ${Date.now()-t0}ms`);
          tierUsed = 'replica';
          return Buffer.from(r.data);
        } catch (e) {
          console.warn(`${fileLabel} Chunk ${idx} Tier-2 FAILED: ${e.message}`);
        }
      }
      return null;
    }));

    let encryptedBuffer = null;
    if (chunkBuffers.length > 0 && chunkBuffers.every(b => b !== null)) {
      encryptedBuffer = chunkBuffers.length === 1 ? chunkBuffers[0] : reassembleChunks(chunkBuffers);
      console.log(`${fileLabel} ✅ Reassembled from ${tierUsed} tier. Size: ${encryptedBuffer.length} bytes`);
    }

    // Tier 3: IPFS
    if (!encryptedBuffer && file.ipfsCid) {
      try {
        const t0 = Date.now();
        console.log(`${fileLabel} Tier-3: fetching from IPFS ${file.ipfsCid}`);
        const r = await axios.get(`https://gateway.pinata.cloud/ipfs/${file.ipfsCid}`,
          { responseType: 'arraybuffer', timeout: 60000 });
        encryptedBuffer = Buffer.from(r.data);
        tierUsed = 'IPFS';
        console.log(`${fileLabel} ✅ Tier-3 IPFS succeeded in ${Date.now()-t0}ms`);
      } catch (e) {
        console.warn(`${fileLabel} Tier-3 IPFS FAILED: ${e.message}`);
      }
    }

    // Tier 4: S3
    if (!encryptedBuffer && file.cloudBackupPath) {
      const t0 = Date.now();
      console.log(`${fileLabel} Tier-4: fetching from S3 ${file.cloudBackupPath}`);
      encryptedBuffer = await cloudBackupService.download(file.cloudBackupPath);
      tierUsed = 'S3';
      console.log(`${fileLabel} ✅ Tier-4 S3 succeeded in ${Date.now()-t0}ms`);
    }

    if (!encryptedBuffer) {
      console.error(`${fileLabel} ❌ All tiers exhausted.`);
      return res.status(503).json({ error: 'File unavailable — all storage tiers failed' });
    }

    // Decrypt
    let outputBuffer = encryptedBuffer;
    if (file.isEncrypted && file.encryptedKey && file.iv) {
      try {
        const t0 = Date.now();
        outputBuffer = encryptionService.decrypt(encryptedBuffer, file.encryptedKey, file.iv);
        console.log(`${fileLabel} Decrypted in ${Date.now()-t0}ms`);
      } catch (_) {
        return res.status(500).json({ error: 'Decryption failed' });
      }
    }

    // SHA-256 integrity check (also applies to public downloads)
    if (file.sha256Hash) {
      const actualHash = crypto.createHash('sha256').update(outputBuffer).digest('hex');
      if (actualHash !== file.sha256Hash) {
        console.error(`${fileLabel} ❌ Integrity check FAILED (tier: ${tierUsed})`);
        return res.status(500).json({ error: 'File integrity check failed' });
      }
      console.log(`${fileLabel} ✅ SHA-256 integrity verified (tier: ${tierUsed})`);
    }

    FileRecord.findByIdAndUpdate(file._id, { $inc: { downloadCount: 1 } }).catch(() => {});

    console.log(`${fileLabel} ✅ Serving ${outputBuffer.length} bytes via ${tierUsed} tier`);
    res.set('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.set('Content-Type', file.mimeType || 'application/octet-stream');
    res.set('X-Storage-Tier', tierUsed);
    res.send(outputBuffer);
  } catch (err) {
    console.error('[Storage] Public download error:', err.message);
    res.status(500).json({ error: 'Download failed' });
  }
});

// ─── POST /api/storage/public/:shareToken/purchase ───────────────────────
router.post('/public/:shareToken/purchase', async (req, res) => {
  try {
    const { method } = req.body || {};
    const ah = req.headers.authorization;
    if (!ah?.startsWith('Bearer ')) return res.status(401).json({ error: 'Login required to purchase' });

    let buyerId;
    try { buyerId = require('jsonwebtoken').verify(ah.split(' ')[1], process.env.JWT_SECRET).id; }
    catch (_) { return res.status(401).json({ error: 'Invalid session' }); }

    const file = await FileRecord.findOne({ shareToken: req.params.shareToken, isDeleted: false });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (!file.isLocked)                     return res.status(400).json({ error: 'File is not locked' });
    if (file.userId.toString() === buyerId) return res.status(400).json({ error: 'You own this file' });

    const existingAccess = await FileAccess.findOne({ buyerUserId: buyerId, fileRecordId: file._id, isActive: true });
    if (existingAccess || file.purchasedBy.map(id => id.toString()).includes(buyerId)) {
      return res.status(400).json({ error: 'Already purchased' });
    }

    const buyer  = await User.findById(buyerId);
    const seller = await User.findById(file.userId);

    if (method === 'demo_sct') {
      if (!file.priceSCT || file.priceSCT <= 0) return res.status(400).json({ error: 'No SCT price set' });
      if ((buyer.sctBalance || 0) < file.priceSCT) return res.status(402).json({ error: `Need ${file.priceSCT} SCT, have ${buyer.sctBalance || 0}` });
      buyer.sctBalance -= file.priceSCT;
      await buyer.save();
      if (seller) { seller.sctBalance = (seller.sctBalance || 0) + Math.floor(file.priceSCT * 0.9); await seller.save(); }

    } else if (method === 'demo_usd') {
      if (!file.priceUSD || file.priceUSD <= 0) return res.status(400).json({ error: 'No USD price set' });
      if ((buyer.demoUSD || 0) < file.priceUSD) return res.status(402).json({ error: `Need $${file.priceUSD}, have $${(buyer.demoUSD || 0).toFixed(2)}` });
      buyer.demoUSD -= file.priceUSD;
      await buyer.save();
      if (seller) { seller.demoUSD = (seller.demoUSD || 0) + file.priceUSD * 0.9; await seller.save(); }

    } else if (method === 'stripe') {
      if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Stripe not configured' });
      if (!file.priceUSD || file.priceUSD <= 0) return res.status(400).json({ error: 'No USD price for Stripe' });
      const pi = await require('stripe')(process.env.STRIPE_SECRET_KEY).paymentIntents.create({
        amount: Math.round(file.priceUSD * 100), currency: 'usd',
        metadata: { fileId: file._id.toString(), buyerId, shareToken: req.params.shareToken },
      });
      return res.json({ clientSecret: pi.client_secret });
    } else {
      return res.status(400).json({ error: 'Invalid method. Use demo_sct, demo_usd, or stripe.' });
    }

    await FileAccess.create({ buyerUserId: buyerId, sellerUserId: file.userId, fileRecordId: file._id, grantedAt: new Date(), accessType: 'purchase', isActive: true });
    await FileRecord.findByIdAndUpdate(file._id, {
      $addToSet: { purchasedBy: buyerId },
      $inc: {
        totalRevenueSCT: method === 'demo_sct' ? (file.priceSCT || 0) : 0,
        totalRevenueUSD: method === 'demo_usd' ? (file.priceUSD || 0) : 0,
      },
    });

    res.json({ message: 'Purchase successful', fileId: file._id });
  } catch (err) {
    console.error('[Storage] Public purchase error:', err.message);
    res.status(500).json({ error: 'Purchase failed', detail: err.message });
  }
});

module.exports = router;

