# StoraChain — Full Implementation Plan
**Student:** Wettasingha L Wettasingha | Plymouth 10952709
**Degree:** BSc (Hons) Software Engineering
**Supervisor:** Mr. Gayan Perera
**Plan Period:** April 28 – May 5, 2026
**Deadline:** May 5, 2026

---

## Project Vision

StoraChain is a hybrid decentralised cloud storage marketplace governed by blockchain and powered by artificial intelligence. Two types of users interact with the platform: storage seekers who upload files and want them stored securely and reliably, and storage providers who contribute unused disk space from their VPS servers and earn SCT tokens as compensation. The system achieves genuine decentralisation by encrypting every uploaded file with AES-256-GCM, splitting the encrypted data into chunks, and distributing those chunks across multiple real provider nodes that run the StoraChain Provider Agent daemon. Providers do not set their own prices or earnings — the platform's AI-driven tokenomics engine analyses each provider's real performance metrics and automatically computes fair SCT rewards. A smart contract layer on the Sepolia Ethereum testnet records every file upload, provider assignment, download event, and token distribution immutably on-chain.

The system implements four-tier reliability. The primary storage tier is the provider nodes themselves — real VPS machines running the agent software. The second tier is chunk replication, where every chunk is mirrored to at least one secondary provider node so that if the primary goes offline, the replica serves the data immediately. The third tier is Pinata/IPFS, where the full encrypted file is pinned as a content-addressed backup accessible from any IPFS gateway. The fourth tier is a cloud disaster-recovery backup stored in AWS S3 or Google Drive. When a seeker downloads a file, retrieval always tries the providers first, then replicas, then IPFS, then the cloud backup — falling through each tier only on confirmed failure. This stratified approach demonstrates distributed systems engineering, fault tolerance, cryptographic security, AI integration, blockchain governance, and production-level deployment practices appropriate for a final-year BSc dissertation.

---

## System Architecture

### Core Components

The **Backend API** (Node.js/Express) is the central orchestration layer. It handles authentication, file encryption and decryption, chunking and reassembly, AI-powered provider selection, concurrent chunk distribution to provider agents, backup coordination across Pinata and cloud storage, blockchain transaction submission, scheduled reward distribution via node-cron, and all data persistence in MongoDB. The backend is the only component that ever holds the file encryption keys. Those keys are stored in MongoDB attached to the FileRecord — never in logs, never in API responses.

The **Provider Agent Daemon** (Node.js/Express) runs on each provider's machine. For this project, three independent VPS instances each run their own agent instance with a unique wallet address and provider account. The agent stores binary chunk files to a designated folder on its local disk, reports health metrics every 30 seconds to the backend, accepts new chunks via authenticated POST requests using a shared BACKEND_AGENT_KEY secret, and serves stored chunks back on authenticated GET requests. The agent treats all incoming data as opaque binary blobs — it has no knowledge of encryption, file structure, or chunk purpose. Since chunks arrive as encrypted binary data, the agent is already compatible with the new encryption layer without any changes to its core logic.

The **AI Matchmaking and Reward Service** (Python Flask) is a standalone microservice in the ai-service/ directory. It exposes two endpoints: one to score and rank providers for a new upload, and one to compute per-provider SCT reward amounts for the billing cycle. The backend always calls this service first and falls back to an identical in-Node.js formula if the service is unavailable. This separation means the AI logic can be upgraded, retrained, or replaced independently of the backend.

The **Smart Contracts** (Solidity on Sepolia) consist of two contracts: StoraToken.sol, an ERC-20 token with mint and burn restricted to the platform owner wallet (used to pay providers), and StoraChainStorage.sol, which records file uploads, provider assignments, download events, and reward distributions as immutable blockchain events.

The **React Frontend** serves seekers, providers, and admins through a consistent dark-themed interface with a left sidebar. It communicates with the backend via REST API and submits transactions directly to Ethereum via MetaMask for file registration and marketplace purchases.

The **Admin Dashboard** is a protected section of the frontend accessible only to admin-role users, providing full platform oversight, provider management, reward cycle controls, and real-time system health.

The **Expo Mobile App** (React Native) covers the core seeker and provider workflows on iOS and Android using the same backend API.

### Storage and Distribution Flow

When a seeker uploads a file, the backend computes a SHA-256 hash of the raw file bytes for later integrity verification. It then encrypts the raw bytes with AES-256-GCM (randomly generated 256-bit key and 96-bit IV, authentication tag included for integrity). The encrypted ciphertext is split into N chunks: N=2 for files under 5 MB, N=3 for 5–25 MB, N=4 for larger files. The backend calls the AI matchmaking service to rank all active providers. For each chunk, a primary provider is assigned from the top of the ranked list (cycling through to ensure even distribution) and a separate replica provider is assigned from a different entry further down the list. All chunks are distributed to their primary and replica providers concurrently using Promise.allSettled so that individual provider failures do not crash the full upload. The FileRecord is saved to MongoDB after a majority of distributions succeed.

After provider distribution is confirmed, the backend asynchronously pins the full encrypted file to Pinata/IPFS (off the critical response path, updates the FileRecord when done). In parallel, it also uploads the encrypted bytes to AWS S3 or Google Drive as disaster recovery (also asynchronous and non-blocking). Finally, the backend submits a transaction to StoraChainStorage.sol recording the file's SHA-256 hash, IPFS CID, seeker wallet address, provider wallet addresses, and file size. All of these results — the IPFS CID, the S3 path, the Ethereum tx hash — are stored in the FileRecord once available.

### Retrieval and Fallback Priority

When a seeker requests a download, the backend loads the FileRecord and attempts to fetch all chunks in parallel. For each chunk it first tries the primary provider URL with a 3-second timeout. On failure it immediately tries the replica provider URL. If both provider attempts fail for a chunk, the system fetches the entire encrypted file from Pinata/IPFS using the stored CID (one IPFS fetch covers all failed chunks). If IPFS fails, the system fetches from the cloud backup path. Once all chunk buffers are available (from whatever combination of tiers served them), the backend concatenates them in index order, decrypts using the stored key and IV, verifies the SHA-256 hash to confirm data integrity, then streams the decrypted original file to the seeker. The download event is asynchronously recorded on the StoraChainStorage contract.

### Tokenomics and Provider Rewards

Providers never set their own price. The platform's automated AI reward system exclusively determines SCT earnings. The reward engine runs on a 24-hour cron schedule. It collects each provider's performance data for the period: total storage-hours (GB × hours), download bandwidth served, uptime percentage from heartbeat logs, average chunk retrieval latency versus the network average, the redundancy value of chunks held (chunks with fewer healthy replicas are weighted higher to incentivise covering gaps), and days of continuous active operation. These inputs are sent to the Flask service's reward-computation endpoint which applies a weighted non-linear formula — high-uptime long-duration providers earn disproportionately more than brief high-bandwidth ones, incentivising reliability. The backend receives the SCT amounts, calls StoraToken.mint() for each provider, logs every mint transaction hash in the Transaction model, updates the provider's totalEarnings, and sets lastRewardedAt to prevent double payment. The entire reward cycle is visible in the admin dashboard showing each provider's metrics breakdown and computed reward.

---

## Complete Feature List

**User Authentication and Roles:** Register and login with JWT. Three roles: seeker (uploads and retrieves files), provider (runs nodes and earns tokens), admin (manages the platform). Role-based sidebar navigation and protected route guards throughout the frontend.

**AES-256-GCM File Encryption:** Every uploaded file is encrypted on the backend before any chunk or backup is created. A fresh 256-bit key and 96-bit IV are generated per file. The key and IV are stored in the FileRecord in base64. Decryption happens only in the backend's download route, never exposing the key externally. An authentication tag is included in the ciphertext, providing integrity verification in addition to confidentiality.

**File Integrity Hashing:** The SHA-256 hash of the original unencrypted file is computed before encryption and stored in the FileRecord. After reassembly and decryption on download, the hash is recomputed and compared. If they do not match, the download returns a 422 Unprocessable Entity error indicating data corruption.

**Intelligent Chunking and Multi-Provider Distribution:** Files are split into sized chunks after encryption, with chunk count proportional to file size. The AI service ranks providers and the backend assigns primary and replica targets for each chunk. Distribution is concurrent across all chunks and all providers simultaneously, with partial-failure tolerance via Promise.allSettled.

**Chunk Replication:** Every chunk is held by at least two distinct providers simultaneously. A background hourly replication monitor checks each chunk's health across both its primary and replica assignments, and re-replicates to a healthy provider if either copy is found missing or unreachable.

**Pinata/IPFS Secondary Backup:** The full encrypted file is pinned to Pinata after provider distribution. The CID is stored in the FileRecord. This is a fallback and backup layer, not primary storage.

**AWS S3 or Google Drive Disaster Backup:** After IPFS pinning, the encrypted file is uploaded asynchronously to AWS S3 (or Google Drive) as a last-resort disaster recovery layer. Non-blocking and best-effort.

**Four-Tier Retrieval Priority:** Provider first, replica second, IPFS third, cloud backup fourth. Fallback is automatic and transparent to the seeker. Mixed-tier reassembly is supported (some chunks from providers, others from IPFS/cloud).

**Provider Agent Daemon:** Already built. Stores binary chunk blobs to disk, reports health via heartbeat and GET /health, serves chunks on request. Needs only minor health payload enhancements — no core changes required.

**AI Provider Matchmaking (Python Flask):** Flask microservice in ai-service/ that scores and ranks active providers for each upload using uptime (30% weight), available capacity (25%), latency (20%), reputation (15%), and regional diversity bonus (10%). Returns sorted provider list. Node.js fallback formula uses identical weights inline if Flask is unavailable.

**AI Reward Computation:** Second Flask endpoint computes per-provider SCT reward amounts from performance reports. Uses a non-linear weighted formula favoring reliability and long-duration storage. Called by the backend's scheduled reward distribution job.

**StoraToken ERC-20 Contract:** Deployed to Sepolia. Owner-only mint and burn. 100 million SCT max supply. Backend deployer wallet is the owner. Frontend uses this contract for balance queries and marketplace purchase transactions.

**StoraChainStorage Smart Contract:** Records file uploads (hash, CID, seeker wallet, provider wallets, file size), download events, and reward distribution events on-chain. Deployed to Sepolia. Both contracts verified on Etherscan.

**On-Chain File Registration:** Backend submits a StoraChainStorage.storeFile transaction after every successful upload. Tx hash stored in FileRecord and shown in the frontend with an Etherscan link. Optionally the seeker's MetaMask also submits this transaction directly so ownership comes from the user's own wallet.

**On-Chain Download Recording:** Every successful file download triggers an asynchronous blockchain event via StoraChainStorage.recordDownload, creating an auditable access trail.

**Automated Token Reward Distribution:** node-cron job every 24 hours. Collects provider performance data, calls Flask reward endpoint, mints SCT to provider wallets, logs all transactions, prevents double payment with lastRewardedAt timestamps.

**Provider Dashboard Page:** Real-time stats: active chunks stored, storage used vs capacity, uptime percentage, SCT earned today / this week / all time, average latency, node online/offline status, and controls to activate or deactivate the node.

**Seeker Dashboard Page:** Files uploaded count, total storage used, SCT balance (from blockchain), spending history, and recent activity feed.

**My Files Page:** Lists all uploaded files with name, size, date, chunk health badge (green/yellow/red), blockchain status badge (Etherscan link), IPFS CID link, download button, delete button, and quick-share action. Two tabs: My Uploads and Shared With Me.

**Upload File Page:** Drag-and-drop interface with five distinct stage indicators: Encrypting → Chunking → Distributing to providers → Backing up to IPFS → Recording on blockchain. Success card shows CID, Etherscan tx, provider count, and replication status.

**File Sharing Marketplace:** Seekers publicly list files at an SCT price. Buyers pay SCT from MetaMask, the backend creates a FileAccess record, and the file is added to the buyer's library. Private zero-cost sharing to one specific wallet address also supported. Marketplace page has search, filter by file type, and sort by price/date.

**Admin Dashboard:** Protected /admin route, admin-role only. Stats overview cards, providers table with approve/suspend/ban controls, files table with per-chunk health indicators, transactions ledger, replication health logs, reward cycle history with per-provider metrics breakdowns, and a manual "Run Reward Cycle Now" control.

**Provider Monetization — AI-Determined Rewards Only:** Providers never set prices. All SCT earnings are calculated and distributed automatically by the AI reward engine. The admin can adjust global reward multipliers but cannot override per-provider selections — the formula runs on real metrics only.

**Withdrawal Page:** Providers see pending SCT balance (earnings minus withdrawn), enter a withdrawal amount, and submit. Backend calls StoraToken.transfer from the platform wallet to the provider's wallet. Tx hash returned and shown.

**Analytics Page:** Charts powered by recharts. Seekers see: uploads per day (line chart), storage by file type (donut), total storage used. Providers see: storage utilisation over time, downloads served per day, SCT earnings per day, uptime sparkline, lifetime earnings total.

**Profile Page:** Edit display name, email, bio, wallet address, and profile picture. Show role, join date, and recent activity.

**Providers List Page:** Browse all active provider nodes with region, uptime, capacity bar, latency, and reputation score. Demonstrates AI-driven transparency — seekers can see why providers were or were not selected.

**My Storage Node Page:** Provider's live agent health data fetched via backend proxy. Shows online/offline, storage bar, chunk count, uptime, latency, and earnings breakdown.

**Provider Instructions Page:** Animated setup guide already implemented.

**MetaMask / Wallet Integration:** Frontend uses ethers.js BrowserProvider to connect MetaMask. Upload page and marketplace purchase page both trigger wallet transactions. Balance is readable from the token contract. Network guard prompts switch to Sepolia if on wrong network.

**Mobile App (Expo):** Login/register, home dashboard with stats, file upload with device picker, my files with detail and download, marketplace browsing, provider node stats. Built with Expo managed workflow and React Navigation bottom tabs.

**VPS Three-Provider Deployment:** Three VPS instances each run the provider agent with separate wallet addresses, separate StoraChain provider accounts, and distinct declared regions. Real chunks are distributed to these machines over the internet, demonstrating genuine physical decentralisation.

**Replication Monitor:** Hourly background job. Pings all chunk primary and replica providers, logs results to ReplicationLog model, re-replicates any failed copies to a healthy provider, and updates FileRecord accordingly.

---

## What Is Already Built (Preserve and Extend)

The backend structure, MongoDB connection, rate limiter, CORS, and auth routes are complete. All six Mongoose models (User, StorageListing, FileRecord, MarketplaceListing, Transaction, Withdrawal) are implemented. All eight route groups are registered and functional. The fileService, pinataService (REST-based, falls back to mock CID if PINATA_JWT is unset), and tokenService (needs update from transfer to mint) are in place. The upload and download routes in storageRoutes.js exist and work but do not yet encrypt files, do not replicate chunks, and do not fall back gracefully — these are upgraded on April 28. The provider agent daemon (agent.js, src/storage.js, src/server.js, src/registry.js) is fully built. All ten React frontend pages exist with the correct design system. The sidebar, AppLayout authentication wrapper, and axios client with JWT interceptor are all complete. StoraChainStorage.sol is deployed. StoraToken.sol is designed but not yet deployed — first task on April 29.

---

## Daily Implementation Schedule

### April 28 — Storage Core Redesign: Encryption, Chunking, Replication, Priority Retrieval

The entire upload and download pipeline must be rebuilt around AES-256-GCM encryption today. This is the most architecturally significant day of the project.

An encryption service must be created in backend/services/encryptionService.js. The encrypt function accepts a Node.js Buffer and returns an object containing the encrypted Buffer (ciphertext with authentication tag appended), the base64-encoded 256-bit key, and the base64-encoded 96-bit IV. It uses Node.js's built-in crypto module with createCipheriv using the aes-256-gcm algorithm. The authentication tag (16 bytes) must be included in the ciphertext output so that the decrypt function can verify integrity. The decrypt function accepts the ciphertext Buffer, base64 key, and base64 IV, uses createDecipheriv with aes-256-gcm, sets the expected authentication tag, and returns the original plaintext Buffer. If the authentication tag does not match, it throws an error indicating tampering or corruption. This service must be independently testable by encrypting a known string and confirming the decrypted output matches exactly.

The FileRecord Mongoose schema must be extended with the following fields: encryptedKey (String, base64), iv (String, base64), isEncrypted (Boolean, default false), sha256Hash (String), ipfsCid (String), cloudBackupPath (String), onChainTxHash (String). The existing chunks array sub-schema must add a replicaProviderUrl field (String) to each chunk entry alongside the existing providerUrl. The FileRecord model file must be updated and the MongoDB collection will automatically accommodate the new fields.

The upload route in storageRoutes.js must be completely rewritten. The new flow is: receive the multipart file upload via multer, compute the SHA-256 hex hash of req.file.buffer using crypto.createHash, call encryptionService.encrypt to encrypt the buffer, determine chunk count based on raw file size, call the provider scoring function to get a ranked list from AI service (with fallback), shard the encrypted ciphertext into N chunks using the existing shardBuffer utility, assign each chunk a primary provider and a distinct replica provider from the ranked list, distribute chunks to all providers concurrently (Promise.allSettled), build chunk metadata entries including both providerUrl and replicaProviderUrl, initiate Pinata pin and cloud backup asynchronously in the background (do not await them), save the FileRecord to MongoDB with all chunk assignments, initiate the on-chain registration transaction asynchronously in the background (do not await it), respond to the client with HTTP 201 and the FileRecord summary including file ID, file name, file size, chunk count, and provider distribution results showing which chunks went to which provider URLs. The response must arrive within a few seconds regardless of how long Pinata, S3, and the blockchain take, because those are all background operations.

Background completion handlers must update the FileRecord once each async task completes: when Pinata returns a CID, update the FileRecord with ipfsCid; when S3 returns an object key, update with cloudBackupPath; when the blockchain tx is broadcast, update with onChainTxHash. These secondary updates use a separate MongoDB findByIdAndUpdate call in background promise chains with proper error catching — failure of any one background task must be logged but must not propagate an error to the already-completed upload response.

The download route must implement the four-tier retrieval chain. For each chunk (sorted by chunkIndex), attempt the primary provider HTTP GET with a 3-second AbortController timeout. On network error or timeout, immediately attempt the replica provider HTTP GET with the same timeout. If both fail for that chunk, set a flag indicating IPFS fallback is needed. After all parallel chunk attempts complete, if any chunk needed IPFS fallback AND an ipfsCid is available on the FileRecord, fetch the full encrypted file from the Pinata gateway URL, use that as the combined buffer (bypassing the per-chunk assembly for that file) and break out of the chunk loop. If IPFS also fails and a cloudBackupPath is present, fetch the full file from S3 using the AWS SDK's GetObjectCommand. Once all piece buffers are available, concatenate them in index order to form the full encrypted ciphertext, call encryptionService.decrypt, recompute the SHA-256 hash of the decrypted output, compare it to the stored sha256Hash field — if they do not match return HTTP 422 with a data integrity error, if they match set the Content-Disposition and Content-Type headers and send the buffer. Trigger a background async call to record the download event on the blockchain.

A ReplicationLog Mongoose model must be created with fields: fileId (ObjectId ref FileRecord), chunkId (String), primaryStatus (String: 'ok' or 'failed'), replicaStatus (String: 'ok' or 'failed'), replicaUpdated (Boolean), newReplicaUrl (String), checkedAt (Date). A replication monitor background job must be created in backend/jobs/replicationMonitor.js. This job is registered with node-cron in server.js to run every hour. It queries all FileRecords where isDeleted is false. For each record's chunks array, it calls HEAD or GET /chunk/:chunkId on both the primary and the replica provider. If the primary is healthy but the replica is down, it selects an alternative active provider (from StorageListing where isActive is true, not already assigned to this chunk), fetches the chunk from the primary, posts it to the new provider, and updates the FileRecord's chunk entry with the new replicaProviderUrl. It writes a ReplicationLog entry for every chunk checked. If both primary and replica are down, it marks the chunk as at-risk in the log and attempts to restore from IPFS/cloud if a CID is available. The job must handle all errors per-chunk without crashing the overall run — each chunk check is inside a try/catch.

A provider scoring fallback must exist directly in storageRoutes.js (or in a separate scoringService.js) for when the Python Flask AI service is not running. The fallback function receives the array of active StorageListing records and sorts them by a composite score: (uptimePct × 0.30) + (availableGB_normalised × 0.25) + (latency_inverted_normalised × 0.20) + (reputationScore_normalised × 0.15) + (regionDiversityBonus × 0.10). Normalisation is against the min/max across the input array. This formula must produce identical qualitative results to the Flask service so the two are interchangeable for testing purposes.

For testing on April 28, run three local provider agent instances on ports 3001, 3002, and 3003. Upload a test file, confirm the FileRecord in MongoDB shows primary and replica assignments for each chunk with distinct providerUrl and replicaProviderUrl values, confirm all three agents received chunks (via their /chunks endpoint), take one agent offline and confirm the download succeeds using replicas, restart the agent and confirm the replication monitor eventually updates the replica assignment, and confirm the SHA-256 integrity check passes on the decrypted download output.

---

### April 29 — StoraToken Deployment, Blockchain Deep Integration, AI Flask Service

Today deploys the StoraToken ERC-20 contract, connects all system events to the blockchain, and builds the Python AI matchmaking and reward service.

StoraToken.sol must be deployed to Sepolia testnet as the very first task today. After deployment, the contract address goes into backend/.env as TOKEN_CONTRACT_ADDRESS. The contract ABI must be copied to both backend/abi/StoraToken.json and frontend/src/abi/StoraToken.json. The existing tokenService.js must be updated: it currently calls the ERC-20 transfer function, which requires the sender to hold tokens. The correct approach is to call the mint function since the backend is the contract owner. The updated tokenService must expose a mintTokens(walletAddress, amountSCT) function that calls StoraToken.mint using the ethers.js Contract instance with the deployer wallet as signer, with error handling that logs failures without propagating them to the caller.

The StoraChainStorage.sol contract must be reviewed to confirm it supports: a storeFile function accepting file hash (bytes32), CID string, seeker wallet address, provider wallet address array, and file size uint256; a FileStored event emitted on each call; a recordDownload function accepting file hash and downloader wallet and emitting a FileDownloaded event; and a recordReward event emitted when reward distribution cycles complete. If the current contract supports these, update the backend ABI reference file. If it does not, update the contract source, recompile, redeploy to Sepolia, copy the new ABI to backend/abi/StoraChainStorage.json and to frontend/src/abi/, and update the STORAGE_CONTRACT_ADDRESS in backend/.env. The Hardhat config must already have the Sepolia network and Infura RPC configured.

The upload route from April 28 must now call the on-chain registration as a background async task. The task uses the deployer wallet to call StoraChainStorage.storeFile with the SHA-256 hash converted to bytes32 using ethers.utils.id or similar, the Pinata CID string, the seeker's wallet address from their user profile, and the array of provider wallet addresses collected from the StorageListing records matched to the selected providers. The returned tx.hash is stored in the FileRecord's onChainTxHash field. The download route must call StoraChainStorage.recordDownload asynchronously after a successful file reassembly and decryption.

The frontend UploadFile page must be updated to show the Etherscan tx hash and link in the success card. It should poll the FileRecord periodically (every 5 seconds, up to 60 seconds) after upload to check when onChainTxHash is populated, then display it with a "View on Etherscan Sepolia" link. Additionally the page must add a MetaMask transaction step: after the backend upload succeeds and returns a tx hash, the frontend calls StoraChainStorage.storeFile from the seeker's own wallet using ethers.js BrowserProvider. This makes the seeker themselves the transaction submitter, creating undeniable proof of ownership from their wallet. The frontend must use the StoraChainStorage ABI from frontend/src/abi/ and the contract address from environment configuration. If MetaMask is not available or the user declines the transaction, this step is skipped gracefully with a notice that on-chain ownership was recorded by the backend only.

The Python Flask AI service must be created in the ai-service/ directory. The directory contains app.py, requirements.txt, and a README. The requirements.txt lists flask, flask-cors, and numpy. The app.py defines two blueprint routes. The first, POST /score-providers, accepts a JSON body with a providers array where each element has id, uptimePct, availableGB, latencyMs, region, totalJobsCompleted, and reputationScore fields. The function normalises each metric across the input set, applies the weights (uptime 30%, capacity 25%, latency inverted 20%, reputation 15%, region diversity 10%), computes a total score per provider, sorts descending, and returns the full array with an added score field. An empty providers array returns an empty array with HTTP 200. The second, POST /compute-rewards, accepts a rewardReports array where each element has providerId, storageHoursGB, downloadsBandwidthGB, uptimePct, avgLatencyMs, replicasHeld, and daysActive fields. The formula is: base_score = (storageHoursGB × 0.35) + (downloadsBandwidthGB × 0.20) + (uptimePct/100 × 0.25) + (replicasHeld × 0.10) + (daysActive_normalised × 0.10), with a modifier that applies a 1.5× bonus multiplier for providers above 99% uptime and a 0.7× penalty for providers below 80% uptime. The raw score is then multiplied by a global SCT_PER_POINT constant (e.g., 5.0) to convert to token amounts. The response is a JSON object mapping providerId to rewardSCT rounded to 2 decimal places. Both endpoints log their inputs and outputs at INFO level. The Flask app runs on port 5001 by default. The backend Node.js code must call these endpoints via axios and have complete try/catch fallbacks using the same formulas implemented directly in JavaScript.

For testing on April 29, verify StoraToken is visible on Sepolia Etherscan with the correct name and symbol, call tokenService.mintTokens with a test wallet and confirm the mint tx hash appears on Etherscan, upload a file and confirm a StoraChainStorage.storeFile tx appears on Etherscan with provider addresses in the event log, start the Flask service and call both endpoints with mock data and confirm sensible ranked results, and trigger a MetaMask transaction from the frontend after a test upload.

---

### April 30 — AWS S3 Cloud Backup, Admin Backend APIs, Marketplace Purchase Completion

Today completes the cloud backup infrastructure, builds all admin-facing backend routes, and finishes the marketplace purchase flow.

A cloud backup service must be created in backend/services/cloudBackupService.js. The primary implementation uses AWS S3. The service exports an async uploadToCloud(buffer, originalName, fileId) function. It constructs an S3 object key from the fileId and a sanitised version of the original name (e.g., files/fileId/filename.ext). It uses the AWS SDK v3 S3Client and PutObjectCommand with the buffer as the Body. On success it returns the object key string. On failure it catches the error, logs it, and returns null — S3 failure must never throw into the calling upload route. The AWS credentials AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, and AWS_REGION must be added to backend/.env. If the student does not have an AWS account, the Google Drive API is an equally valid substitute: use the googleapis npm package with a service account JSON key file, upload the buffer as a file to a designated Drive folder, and return the Drive file ID as the path. The service interface (same function signature, returns string or null) is identical regardless of which cloud provider is used. The storageRoutes upload handler calls this service asynchronously after initiating the Pinata pin, running both in the background without blocking the response.

The admin backend routes must all be implemented in a new file backend/routes/adminRoutes.js. Every route in this file checks both that req.user exists (via authMiddleware) and that req.user.role === 'admin', returning HTTP 403 if either check fails. The required routes are: GET /api/admin/stats returns a JSON object with totalUsers, totalProviders, activeProviders, totalFiles, totalStorageGB (sum of all StorageListing.usedGB fields), totalSCTMinted (sum of all Transaction records with type 'reward'), and platformDaysOnline. GET /api/admin/users returns all User documents excluding the password field. GET /api/admin/providers returns all StorageListing documents with their associated User populated (alias, email, joinDate). GET /api/admin/files returns all FileRecord documents with a computed chunkHealth field derived by checking the ReplicationLog for the most recent entry per chunk — if the most recent log shows both primary and replica healthy the health is 'healthy', if one is failed it is 'degraded', if both are failed it is 'critical'. GET /api/admin/transactions returns the 100 most recent Transaction records sorted by createdAt descending. GET /api/admin/replication-logs returns the 200 most recent ReplicationLog entries. POST /api/admin/reward-cycle triggers the reward distribution job immediately, runs it synchronously for this one call (rather than the background schedule), and returns the full results including each provider, their computed score, and the SCT amount minted. PUT /api/admin/providers/:id/status accepts body.status as 'active', 'suspended', or 'banned', updates the StorageListing's isActive field accordingly (true for active, false for suspended or banned), and returns the updated listing. The adminRoutes file must be registered in server.js as app.use('/api/admin', require('./routes/adminRoutes')).

The marketplace purchase flow must be completed in marketplaceRoutes.js. A new FileAccess Mongoose model must be created in backend/models/FileAccess.js with fields: buyerUserId (ObjectId ref User), sellerUserId (ObjectId ref User), fileRecordId (ObjectId ref FileRecord), listingId (ObjectId ref MarketplaceListing), grantedAt (Date), txHash (String), accessType (String: 'purchase' or 'share'), isActive (Boolean). The POST /api/marketplace/purchase route must: validate that the listingId exists and the listing is active; verify the buyer is not the file owner; check the buyer's SCT token balance by calling StoraToken.balanceOf using ethers.js and comparing to the listing price; if balance is sufficient, call StoraToken.transferFrom or have the buyer sign an approval and then the backend calls transferFrom to move SCT from buyer to seller minus a 5% platform fee to the admin wallet; create a FileAccess record granting the buyer access; update the Transaction model with the purchase record; mark the listing as sold if it is single-sale; return HTTP 200 with the purchase summary and tx hash. For private sharing (zero-cost), the POST /api/marketplace/share route accepts a targetWalletAddress and fileRecordId, looks up the target user by wallet address, and creates a FileAccess record with accessType 'share' and no SCT transaction. The download route in storageRoutes.js must be updated to check FileAccess records: the file can be downloaded if req.user.id matches the file's userId OR if a FileAccess record exists where buyerUserId matches req.user.id, fileRecordId matches the requested file, and isActive is true.

For testing on April 30, upload a file and verify a cloud backup URL appears in the FileRecord, the admin stats route returns correct aggregated numbers, the admin files route shows chunk health indicators derived from real replication logs, the marketplace purchase creates a FileAccess record that allows a second user to download the file, and private sharing grants access to the target wallet's user account.

---

### May 1 — Admin Dashboard Frontend, Provider Monetization Completion, Withdrawal, Analytics

Today builds the admin frontend interface and completes the provider economics experience.

A new page component must be created at frontend/src/pages/admin/AdminDashboard.js. A new route /admin must be added to App.js protected by a guard that redirects non-admin users to /app/dashboard. The admin dashboard layout has a top row of six metric cards showing total users, total providers, total files, total storage (formatted as GB or TB), total SCT minted, and platform days online — all fetched from GET /api/admin/stats. Below the metrics is a tab bar with five tabs: Overview, Providers, Files, Transactions, and Reward Cycles.

The Overview tab contains two panels. The first is a Reward Controls card showing the timestamp of the last reward cycle, a countdown label indicating when the next scheduled cycle will run, and a "Run Reward Cycle Now" button. Clicking this button calls POST /api/admin/reward-cycle and shows a loading spinner. When the response returns, it switches to the Reward Cycles tab and shows the freshest cycle results. The second panel is a Replication Health summary showing counts from the most recent replication log run: chunks healthy, chunks with degraded replicas, and chunks in critical status.

The Providers tab renders a table with columns: alias/name, email, region, storage used / total as both text and a progress bar, uptime percentage, last heartbeat timestamp (formatted as "X minutes ago"), total earned SCT, and a status badge. Each row has an action dropdown with Approve, Suspend, and Ban options. Selecting an option shows a confirmation dialog, calls PUT /api/admin/providers/:id/status, and refreshes the table row. Clicking on a provider row expands a detail panel showing all available metrics from the StorageListing and the last 10 replication log entries for that provider's chunks.

The Files tab renders a table with columns: file name (truncated), owner alias, file size, upload date, an IPFS CID badge (clickable), an Etherscan tx badge (clickable), and a chunk health dot (green for all healthy, yellow for degraded, red for critical). A red dot in the chunk health column means the file is at risk and should be investigated. The table must have pagination since in production there could be many records.

The Transactions tab shows the 100 most recent Transaction records with columns: type (reward/purchase/withdrawal), provider/user alias, amount in SCT, tx hash (truncated, clickable link to Etherscan), and timestamp.

The Reward Cycles tab lists all past reward cycle runs. Each row shows the run timestamp, total providers paid, total SCT minted, and a "Details" expand button. Expanding shows a sub-table with each provider, their storageHoursGB, downloadsBandwidthGB, uptimePct, computed score, and rewardSCT for that cycle. This sub-table is the primary academic demonstration of the AI-driven fair reward distribution system — examiners can see every provider's real performance metrics and the resulting token allocation.

The automated reward distribution backend job in backend/jobs/rewardDistributionJob.js must be fully completed and registered with node-cron in server.js to run at midnight UTC every day. The job queries all active StorageListing records, aggregates each provider's 24-hour performance data from heartbeat log entries in the database (heartbeats should have been accumulated by the heartbeat route already — a HeartbeatLog model may need to be added with fields providerId, usedGB, latencyMs, uptimePct, timestamp, or the heartbeat values can be aggregated from the existing StorageListing rolling fields), constructs the rewardReports array, calls the Flask /compute-rewards endpoint, receives the SCT amounts, and for each provider calls tokenService.mintTokens. Each mint creates a Transaction record with type 'reward', the providerId, providerWallet, amountSCT, the billing period as an ISO date string (today's date), and the tx hash from the mint transaction. The job updates StorageListing.totalEarnings and lastRewardedAt for each provider. If any individual provider's mint fails, the job catches that error, logs it, and continues to the next provider rather than aborting the cycle. The job must save a RewardCycleLog record at the end summarising all results — a new RewardCycleLog Mongoose model with fields runAt, providersProcessed, totalSCTMinted, results (array of per-provider breakdowns), and status ('completed' or 'partial').

The Withdraw page (frontend/src/pages/app/Withdraw.js) must be completed. It fetches the provider's total earned SCT from GET /api/providers/me (the StorageListing.totalEarnings field), fetches their total withdrawn amount from GET /api/withdraw (the sum of completed Withdrawal records), computes the pending balance, and displays it prominently. The form has a numeric input pre-validated to not exceed pending balance, a read-only wallet address field from the user's profile, and a Submit Withdrawal button. On submission the backend's POST /api/withdraw route must call StoraToken.transfer using the platform's wallet (which holds minted tokens designated for withdrawals) to transfer the requested amount to the provider's wallet address, mark the Withdrawal document as completed with the tx hash, and return the tx hash. The frontend shows the tx hash with an Etherscan link.

The Analytics page (frontend/src/pages/app/Analytics.js) must be completed with real charts using recharts. If recharts is not currently in frontend/package.json it must be installed. For seekers: a LineChart showing files uploaded per day over 30 days, a PieChart showing storage used by MIME type category (images, videos, documents, other), and a stat card showing total storage used. For providers: a BarChart showing downloads served per day, a LineChart showing SCT earnings per day, a LineChart showing storage utilisation (usedGB) over time, and a stat card showing total lifetime earnings. All chart data comes from the analytics backend route which must be updated to return time-series arrays in the format recharts expects.

For testing on May 1, the admin dashboard must show accurate real data for all five tabs, the manual reward cycle run from the admin page must mint real tokens on Sepolia (verify on Etherscan), a provider must be suspendable from the admin providers table, the withdrawal flow must produce a tx hash, and the analytics charts must render without errors.

---

### May 2 — Marketplace Frontend, File Sharing, My Files Polish, Full Frontend Completeness

Today completes all frontend pages and finalises the marketplace and file sharing experience.

The Marketplace page (frontend/src/pages/app/Marketplace.js) already exists and must be brought to full functional state. The main view is a responsive card grid. Each card shows a file type icon derived from the MIME type, the file name truncated to 25 characters, the uploader's display name (not email), the file size formatted, the listing date formatted as relative time, the price in SCT with the token symbol, and a "Buy Access" button. Filter controls above the grid allow filtering by category (images, documents, video, audio, other) and sorting by price ascending, price descending, or newest first. A search input filters by file name in real time. Clicking "Buy Access" opens a confirmation modal with the purchase summary — file name, seller name, price, platform fee displayed separately, totalling the SCT cost — and a Confirm button. While processing, the modal shows sequential status messages: Checking balance... Transferring SCT... Granting access... When complete, the modal transitions to a success state showing the transaction hash and a "Download Now" button. The "List a File" button in the page header opens a slide-in panel allowing the seeker to select one of their uploaded files from a searchable dropdown (populated with GET /api/storage/files), enter a short description, enter an SCT price (minimum zero for free sharing), optionally restrict to a single wallet address for private sharing (switching the listing type from Public to Private), and submit via POST /api/marketplace/list or POST /api/marketplace/share depending on type.

The My Files page must be updated to have two tabs built into the existing component. The "My Uploads" tab shows the existing file list. The "Shared With Me" tab fetches and renders files accessible via FileAccess records using GET /api/marketplace/purchases or a new dedicated GET /api/files/shared-with-me route. Each row in the Shared With Me tab shows the original uploader's alias, file name, access type badge (Purchased or Shared), the date access was granted, and a download button.

Every file row in My Uploads must be updated to show three new status badges: a Chunk Health badge (green dot "All Healthy", yellow "Replica Degraded", or red "At Risk" — derived from the FileRecord's chunk replication data), a Chain badge (shows "On Chain" with an Etherscan link if onChainTxHash is set, otherwise "Pending"), and an IPFS badge (shows a truncated CID with a Pinata gateway link if ipfsCid is set, otherwise "Queuing"). These badges make the decentralised storage status visible to seekers, which is a strong academic demonstration point.

The UploadFile page must display all five upload pipeline stages accurately as a vertical stepper. Each stage has three states: pending (grey), active (blue spinner), and complete (green check). The stages are: Encrypting file, Distributing to providers (shows "X of N chunks sent"), Backing up to IPFS (shows "Pinning..."), Uploading cloud backup (shows "AWS S3 / Google Drive"), and Recording on blockchain (shows "Awaiting tx confirmation"). Since the backend responds quickly with an initial result and the background tasks update the FileRecord asynchronously, the frontend must poll GET /api/storage/files/:fileId periodically after upload to update the stage indicators as each field (ipfsCid, cloudBackupPath, onChainTxHash) becomes populated.

A full routing and navigation audit must be completed. Every route in App.js must be verified: all /app/* routes require the user to be authenticated (AppLayout handles this), the /admin route must check role === 'admin', public routes (landing, login, register) must be accessible without auth. All sidebar navigation items must link to existing routes. All pages must have a correct empty state when their data fetch returns an empty array. All pages must have a visible loading spinner or skeleton while data is fetching. Error states must show a descriptive message and a retry button for resolvable errors. All Etherscan links must use the Sepolia explorer URL (https://sepolia.etherscan.io/tx/TXHASH). All IPFS gateway links must use the Pinata gateway URL (https://gateway.pinata.cloud/ipfs/CID).

For testing on May 2, complete the full marketplace round trip: upload a file as user A, list it publicly, log in as user B, purchase it, verify the SCT transaction on Etherscan, download the file and verify content integrity. Complete a private share: user A shares with user B's wallet address at zero cost, user B sees it in Shared With Me tab, user B downloads successfully. Verify all My Files badges update correctly after a complete upload cycle.

---

### May 3 — Mobile App (Expo React Native)

Today builds the cross-platform mobile application. Working features are the priority over visual polish.

The mobile app must be scaffolded in expo-app/ at the project root. The Expo project must be configured with an appropriate app name (StoraChain), slug, icon, and splash screen. The app.json must set the iOS bundleIdentifier and Android package name. The project's package.json must include expo, react-native, @react-navigation/native, @react-navigation/bottom-tabs, @react-navigation/stack, expo-secure-store, expo-document-picker, expo-file-system, expo-sharing, axios, and @expo/vector-icons.

The navigation structure is a root Stack navigator with two branches: the Auth stack (Login and Register screens) and the Main tab navigator (Home, Files, Upload, Marketplace, Profile tabs). On app launch, a SplashScreen or loading component checks Expo SecureStore for a stored JWT. If a valid non-expired JWT exists, navigate directly to the Main tabs. If not, navigate to the Auth stack. The JWT expiry is checked by decoding the token payload and comparing the exp timestamp to the current time.

The Login screen has email and password inputs, a Submit button, and a navigation link to the Register screen. On submit, it calls POST /api/auth/login, stores the returned token in SecureStore under the key 'storachain_jwt', stores the returned user object under 'storachain_user', and navigates to the Main tabs. Error messages from the API (wrong email/password) are displayed inline below the form. The Register screen has name, email, password, and a role picker (Seeker / Provider), calls POST /api/auth/register, and on success navigates to Login with a success message.

The Home tab screen loads the user's profile from GET /api/profile and the provider listing from GET /api/providers/me (if the user is a provider). It displays a greeting with the user's name, three stat cards showing files uploaded (count from GET /api/storage/files), storage used (sum of file sizes formatted), and SCT balance (fetched via a backend endpoint that reads from the token contract, or hardcoded to the totalEarnings field if on-chain reading is not feasible on mobile). For provider-role users, an additional row shows the node status (Online / Offline from the StorageListing.isActive field), chunks stored, and earnings today. A large Upload button navigates to the Upload tab.

The Files tab uses a Stack navigator. The root screen is a FlatList of file cards loaded from GET /api/storage/files. Each card shows the file type icon (from a helper mapping MIME types to icons), file name, size, and formatted date. A search bar at the top filters the list by name in real time. Tapping a card navigates to the File Detail screen. The File Detail screen shows the file name in the header, a large file type icon, size, upload date, the chunk health badge, the IPFS CID (as a tappable link that opens the Pinata gateway in the browser), the blockchain tx hash (tappable link to Sepolia Etherscan in browser), a Delete button with confirmation (calls DELETE /api/storage/files/:fileId), and a Download button. Tapping Download calls GET /api/storage/download/:fileId with axios responseType 'blob' (arraybuffer), writes the file to the device's document directory using Expo FileSystem writeAsStringAsync with base64 encoding, then calls Expo Sharing shareAsync to prompt the user to open or save the file. Show a loading spinner while downloading.

The Upload tab presents a large centered upload area with an icon and the text "Tap to select a file". Tapping it calls Expo DocumentPicker.getDocumentAsync with type set to wildcard. After the user selects a file, show the file name, size, and a "Upload to StoraChain" button. On tap, construct a FormData object (using the Expo file URI, the file name, and the MIME type), POST it to /api/storage/upload with the Authorization header. Show a progress indicator and a stage label during upload. On success display the result CID and tx hash. On error display the error message with a Retry button.

The Marketplace tab fetches listings from GET /api/marketplace and shows them in a FlatList with file type icons, file names, seller names, sizes, and SCT prices. A text input at the top filters listings by name. Tapping a listing opens a modal bottom sheet showing the listing details and a "Purchase for X SCT" button. The purchase calls POST /api/marketplace/purchase, shows a loading state, and on success displays the tx hash and offers navigation to the Files tab where the newly accessible file should appear.

The Profile tab shows the user's display name, email, role badge, and wallet address. A "Log Out" button clears SecureStore tokens and navigates to the Auth stack. For provider-role users, a collapsible "My Node" section shows StorageListing data: status, capacity, used GB, chunks stored, uptime, and total earnings in SCT.

For testing on May 3, the app must run in an iOS or Android simulator, or directly in Expo Go on a physical device connected to the same network as the backend. Login, upload, files list, file detail, download, and marketplace browse must all function correctly.

---

### May 4 — VPS Three-Provider Deployment, Integration Testing, Bug Fixes

Today verifies the system works with real separate provider nodes and fixes all issues found in end-to-end testing.

Three VPS instances are required. Free-tier Oracle Cloud Compute VMs (ARM-based), DigitalOcean Droplets, or any equivalent minimal cloud compute instance are all suitable. On each VPS, Node.js 18 must be installed and the project repository cloned. The provider-agent/ directory is the only part the VPS needs to run. Create a .env file on each VPS with a unique WALLET_ADDRESS (generate a new Ethereum wallet for each — they do not need ETH to hold SCT rewards), set the AGENT_JWT to the JWT obtained by logging in with a unique provider account registered on the StoraChain backend, set BACKEND_URL to the backend's accessible public URL (either a deployed backend or the student's local machine's IP if all VPS are on the same network), set BACKEND_AGENT_KEY to match the backend, set STORAGE_DIR to a path with several GB free, and set REGION to distinct labels such as eu-central, us-east, and ap-southeast. Start the agent with an appropriate --port (3001 on all three since each is on a different machine), --space (10 or more GB), and --wallet matching the .env wallet address. Open port 3001 (or whatever port is used) in each VPS's firewall/security group to accept inbound TCP connections. The public agentUrl for each provider in the StorageListing will be http://VPS_PUBLIC_IP:3001.

After all three VPS agents are running and registered with three separate provider account JWTs, run the following structured integration test sequence. Test 1: Upload a 3–5 MB file through the web frontend as a new seeker account. Verify in the MongoDB FileRecord that three distinct chunk entries exist with different providerUrl and replicaProviderUrl values pointing to at least two different VPS IPs. Verify each VPS's GET /health endpoint shows increased usedBytes. Verify the Pinata CID is live on the Pinata gateway. Verify the StoraChainStorage tx hash appears on Sepolia Etherscan with correct data in the FileStored event logs. Test 2: Stop one VPS agent (kill the process). Download the uploaded file through the web frontend. Verify the download succeeds (the replica covers the failed primary). Verify the backend logs show at least one chunk retrieved from a replica URL rather than a primary URL. Test 3: Wait for or manually trigger the hourly replication monitor. Verify a ReplicationLog entry is created showing a failed primary or replica and the corrective re-replication action taken. Test 4: Restart the stopped VPS agent. Verify it re-registers with the backend via heartbeat. Test 5: From the admin dashboard, click "Run Reward Cycle Now". Verify SCT tokens appear in each of the three VPS provider wallet addresses on Sepolia Etherscan. Test 6: List the uploaded file on the marketplace as the seeker. Log in as a second seeker account and purchase the file. Verify the SCT transfer tx appears on Etherscan. Verify the buying seeker can download the file from their Shared With Me / purchased tab.

Every issue found during these tests must be addressed. Common expected issues to resolve: VPS firewall blocking port 3001 (open inbound TCP); chunk distribution timeout too short for trans-continental VPS latency (increase to 10 seconds); MetaMask wallet not connected or wrong network (add a network check and switch prompt to Sepolia showing chain ID 11155111); JWT expiry during a long upload chain (add token refresh to axios interceptor by detecting 401 responses and refreshing if a refresh token exists, or simply increase JWT expiry to 7 days for the demo period); S3 upload failing silently (acceptable — verify cloudBackupPath remains null for failed S3 uploads and no crash occurs); recharts page crashing on empty analytics data (add null/empty checks before passing data to chart components).

---

### May 5 — Final Polish, Verified Contracts, Demo Data, Submission

Today ensures the system is demo-ready, documented, and polished for submission.

Both smart contracts must be verified on Sepolia Etherscan using Hardhat's built-in verification task. The Hardhat config must have an etherscan API key set as ETHERSCAN_API_KEY in smart-contracts/.env. Running the verify task for both StoraToken and StoraChainStorage will make their source code readable and the ABI visible directly on Etherscan, which is a significant academic credibility factor.

The root README.md must be completely rewritten. It must describe the system architecture in prose, list all five running components (backend, frontend, ai-service, provider-agent, expo-app) with startup instructions, provide the deployed contract addresses with Etherscan links, explain the four-tier storage strategy, describe the three-VPS provider setup and how to replicate it, list all environment variable names for each component (values omitted), and include a Features section listing all implemented capabilities. A Development section explains how to run everything locally with a single provider agent instead of three VPS instances.

Demo data must be real and meaningful. There must be at least three provider accounts with registrations (the three VPS providers), at least five files uploaded by seeker accounts with real IPFS CIDs and blockchain tx hashes, at least two marketplace listings (one publicly purchased by a second seeker account), at least one completed reward cycle run with transaction hashes on Etherscan, and at least two withdrawal requests processed. All this data must be visible in the admin dashboard and in individual user dashboards. For examiners or supervisors accessing the demo, the admin credentials and a seeker demo account login should be documented in the project submission notes (not in the public repository).

A final visual pass must be completed on all frontend pages. Confirm consistent heading sizes, button styles, and colour usage across all ten app pages. Confirm the dark glassmorphism design system is applied uniformly. Confirm all loading states use the same spinner style. Confirm all empty states have helpful messages and call-to-action elements. Confirm the landing page (Landing.js) accurately and compellingly describes the system with real feature bullet points — decentralised VPS storage, AES-256 encryption, AI provider matching, blockchain transparency, four-tier reliability, SCT token economy — to make a strong first impression on any evaluator who views it. Confirm the login and register pages are polished and professionally presented.

A final security audit must be performed. Confirm no .env files, private keys, or JWT secrets are committed to git (check .gitignore). Confirm all API routes that should require auth have authMiddleware applied. Confirm the admin routes all have the role === 'admin' guard. Confirm encryption keys are never present in API responses. Confirm the multer file size limit is enforced at 50 MB. Confirm CORS in server.js only allows known frontend origins in production (not a wildcard). Confirm all MongoDB queries use Mongoose models (no raw string interpolation into queries).

---

## Technology Stack

**Backend:** Node.js 18, Express 5, MongoDB Atlas, Mongoose, JWT (jsonwebtoken), bcryptjs, multer, axios, ethers.js v6, node-cron, AWS SDK v3 (S3), Node.js built-in crypto (AES-256-GCM), form-data, express-rate-limit.

**Frontend:** React 19, React Router 7, ethers.js v6, Framer Motion, Lucide React, Recharts, axios, Stripe.js.

**Mobile:** Expo SDK (managed workflow), React Navigation v6, Expo SecureStore, Expo DocumentPicker, Expo FileSystem, Expo Sharing, axios.

**Smart Contracts:** Solidity 0.8.20, Hardhat, OpenZeppelin Contracts (ERC20, Ownable), Sepolia testnet, Infura RPC, Hardhat Etherscan plugin.

**AI Service:** Python 3.10+, Flask, Flask-CORS, numpy.

**Provider Agent:** Node.js 18, Express 4.x, dotenv, uuid, axios.

**Infrastructure:** MongoDB Atlas, Pinata IPFS, AWS S3 or Google Drive, Sepolia Ethereum testnet, Three VPS provider nodes.

---

## Environment Variables Reference

**backend/.env** — PORT, MONGO_URI, JWT_SECRET, BACKEND_AGENT_KEY, PINATA_JWT, SEPOLIA_RPC_URL, PRIVATE_KEY (deployer wallet private key), TOKEN_CONTRACT_ADDRESS, STORAGE_CONTRACT_ADDRESS, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_REGION, AI_SERVICE_URL (default http://localhost:5001), ADMIN_WALLET_ADDRESS, STRIPE_SECRET_KEY, NODE_ENV.

**provider-agent/.env** — WALLET_ADDRESS, AGENT_JWT, BACKEND_URL, BACKEND_AGENT_KEY, STORAGE_DIR, REGION.

**ai-service/.env** — FLASK_PORT (default 5001).

**smart-contracts/.env** — SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY.

---

## Completed Foundation (Do Not Rebuild)

These components are complete and must only be extended where explicitly described in this plan. Backend server, MongoDB connection, rate limiter, CORS, JWT auth routes and middleware. All Mongoose models (User, StorageListing, FileRecord, MarketplaceListing, Transaction, Withdrawal). All eight route groups compiled in server.js. fileService (shardBuffer, reassembleChunks), pinataService (REST-based with mock CID fallback), tokenService (needs update from transfer to mint). Provider agent daemon (agent.js, storage.js, server.js, registry.js). All ten React frontend app pages, Sidebar, AppLayout, axios client with JWT interceptor. StoraChainStorage.sol deployed. StoraToken.sol designed but not yet deployed.

---

## VPS Provider Deployment Notes

Each of the three VPS provider nodes is treated as an independent participant in the StoraChain marketplace. Each has its own Ethereum wallet address (does not need testnet ETH to receive ERC-20 tokens), its own registered StoraChain provider account, and its own running provider-agent instance. The provider agent's AGENT_JWT is obtained by the student logging into the StoraChain web frontend with each provider account and copying the JWT from the browser's localStorage or from the login response. The three VPS instances should declare distinct regions in their agent configuration (e.g., eu-central, us-east, ap-south) to demonstrate the AI matchmaking's geographic diversity consideration. In the admin dashboard, all three should appear as separate entities with independent uptime, storage, and earnings metrics. This multi-node live deployment is the primary demonstration of StoraChain's decentralisation claim and should be ready and running during the dissertation defence or supervisor demonstration.

