# StoraChain — Three-VPS Provider Deployment Guide

This document describes how to set up the three VPS provider nodes required for a
full StoraChain integration test demonstrating genuine physical decentralisation.

---

## Prerequisites

| Item | Value |
|------|-------|
| VPS count | 3 (e.g. Oracle Cloud Free Tier ARM or DigitalOcean $4/mo Droplets) |
| OS | Ubuntu 22.04 LTS (recommended) |
| Node.js | 18.x |
| Port to open | **3001** inbound TCP in each VPS firewall/security group |
| StoraChain backend | Running and publicly accessible (e.g. your dev machine via ngrok, or a deployed backend) |

---

## Step-by-Step for Each VPS

### 1. Run the setup script

SSH into the VPS and run:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/StoraChain/main/provider-agent/scripts/vps-setup.sh | sudo bash
```

Or manually:

```bash
sudo apt-get update -y && sudo apt-get upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git
git clone https://github.com/YOUR_USERNAME/StoraChain.git /opt/storachain
cd /opt/storachain/provider-agent && npm install --production
```

### 2. Open firewall port 3001

**Oracle Cloud (Security List / NSG):**
1. Compute → Instance → Virtual Cloud Network → Security List
2. Add Ingress Rule: Source CIDR `0.0.0.0/0`, Protocol TCP, Destination Port `3001`

Also run on the VPS:
```bash
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

**DigitalOcean (Cloud Firewall):**
1. Networking → Firewalls → Create Firewall (or edit existing)
2. Inbound Rules → Add Rule: TCP, Port `3001`, Sources `All IPv4`

**ufw (alternative):**
```bash
sudo ufw allow 3001/tcp && sudo ufw reload
```

### 3. Register a provider account

For each VPS, create a **separate StoraChain account** with role `provider` via the
web frontend (or via curl):

```bash
curl -X POST https://YOUR_BACKEND_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Provider EU","email":"provider-eu@example.com","password":"SecurePass123","role":"provider"}'
```

Then log in to get the JWT:

```bash
curl -X POST https://YOUR_BACKEND_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"provider-eu@example.com","password":"SecurePass123"}'
```

Copy the `token` field from the response — this is the `AGENT_JWT`.

### 4. Generate a wallet for each VPS

Each provider needs a unique Ethereum wallet address to receive SCT rewards (no ETH
needed for ERC-20 receive). Generate one quickly:

```bash
node -e "const {ethers}=require('ethers'); const w=ethers.Wallet.createRandom(); console.log('address:',w.address,'\nprivate:',w.privateKey)"
```

Store the private key securely offline — the agent only needs the address.

### 5. Create the .env file

```bash
cd /opt/storachain/provider-agent
cp .env.example .env
nano .env
```

Set the following for each VPS (values differ per node):

| Variable | VPS 1 | VPS 2 | VPS 3 |
|----------|-------|-------|-------|
| `WALLET_ADDRESS` | `0xAAA...` | `0xBBB...` | `0xCCC...` |
| `AGENT_JWT` | EU provider JWT | US provider JWT | AP provider JWT |
| `BACKEND_URL` | `https://your-backend.example.com` | same | same |
| `BACKEND_AGENT_KEY` | `agent-secret-key` (match backend .env) | same | same |
| `STORAGE_DIR` | `/opt/storachain-data` | `/opt/storachain-data` | `/opt/storachain-data` |
| `REGION` | `eu-central` | `us-east` | `ap-southeast` |

### 6. Start the agent

**Foreground (for testing):**
```bash
cd /opt/storachain/provider-agent
node agent.js --space 20 --port 3001 --wallet 0xYourAddress
```

**Auto-restart with systemd (recommended for demos):**
```bash
sudo cp /opt/storachain/provider-agent/scripts/storachain-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable storachain-agent
sudo systemctl start storachain-agent
sudo systemctl status storachain-agent
```

### 7. Verify the agent is live

From your local machine:
```bash
curl http://VPS_PUBLIC_IP:3001/health
```

Expected response:
```json
{
  "status": "online",
  "usedBytes": 0,
  "availableBytes": 21474836480,
  "maxBytes": 21474836480
}
```

---

## Integration Test Sequence

Run all six tests in order after all three agents are online.

### Test 1 — Full Upload with Three Providers

1. Register a new **seeker** account in the web frontend.
2. Upload a **3–5 MB file** via the Upload page.
3. Verify in MongoDB:
   ```js
   db.filerecords.findOne({}, {chunks:1, ipfsCid:1, onChainTxHash:1})
   // chunks array should have entries with distinct providerUrl values
   // pointing to different VPS IPs
   ```
4. Verify each VPS agent health endpoint shows increased `usedBytes`.
5. Verify the Pinata CID is accessible:
   `https://gateway.pinata.cloud/ipfs/<ipfsCid>`
6. Verify the `onChainTxHash` appears on Sepolia Etherscan with a `FileStored` event.

### Test 2 — Fallback Download with One Agent Down

1. SSH into one VPS and kill the agent process:
   ```bash
   sudo systemctl stop storachain-agent
   # or: pkill -f agent.js
   ```
2. Download the uploaded file from the web frontend.
3. Verify the download **succeeds** (replica coverage).
4. Check backend logs for: `[Storage] primary fetch failed, trying replica...`

### Test 3 — Replication Monitor Self-Heals

1. With the agent still stopped, trigger the replication monitor manually from the
   admin dashboard → "Run Replication Check" (or wait up to 60 min for the cron).
2. Verify a `ReplicationLog` entry is created in MongoDB:
   ```js
   db.replicationlogs.find().sort({checkedAt:-1}).limit(5).pretty()
   ```
3. The log should show `replicaStatus: 'failed'` and `replicaUpdated: true` with a
   `newReplicaUrl` pointing to one of the two remaining live agents.

### Test 4 — Agent Re-registration After Restart

1. Restart the stopped VPS agent:
   ```bash
   sudo systemctl start storachain-agent
   ```
2. Within 60 seconds the agent sends a heartbeat to the backend.
3. Verify `StorageListing.isActive` becomes `true` again for that provider in MongoDB.

### Test 5 — Reward Cycle Mints SCT

1. In the admin dashboard, click **"Run Reward Cycle Now"**.
2. The cycle computes and mints SCT to all three VPS wallet addresses.
3. Check each wallet on Sepolia Etherscan → Token Transfers tab; SCT token transfers
   should appear from the platform deployer wallet.

### Test 6 — Marketplace Round-Trip

1. As the seeker (from Test 1), navigate to Marketplace → **List a File**.
2. Select the uploaded file, set price `5 SCT`, click **List**.
3. Log in as a **second seeker** account.
4. Find the listing on the Marketplace page and click **Buy Access**.
5. Verify the SCT transfer tx on Sepolia Etherscan.
6. Verify the file appears in the second seeker's **Shared With Me** tab.
7. Click **Download** and verify the file content is intact.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` on chunk upload | VPS firewall — open port 3001 inbound |
| Chunk upload times out | Already set to 10 s in `storageRoutes.js`; increase `timeout` if VPS latency is extreme |
| JWT expired mid-upload | Backend JWT expiry is set to `7d` in `authRoutes.js` |
| MetaMask on wrong network | Frontend now auto-prompts to switch to Sepolia (chainId 0xaa36a7) |
| S3 backup fails silently | Expected when `AWS_S3_BUCKET` is not set; `cloudBackupPath` remains `null`, no crash |
| recharts crash on empty data | All chart data arrays are guarded with `?.length > 0` checks |
| Agent re-registers as duplicate | Each provider must use a **unique email** and its own `AGENT_JWT` |

---

## Environment Variables Summary

### backend/.env

```
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-jwt-secret
BACKEND_AGENT_KEY=agent-secret-key
PINATA_JWT=eyJhbGci...
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=0xdeployer_private_key
TOKEN_CONTRACT_ADDRESS=0x...
STORAGE_CONTRACT_ADDRESS=0x...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=storachain-backups
AWS_REGION=us-east-1
AI_SERVICE_URL=http://localhost:5001
ADMIN_WALLET_ADDRESS=0x...
NODE_ENV=development
```

### provider-agent/.env (one per VPS, values differ)

```
WALLET_ADDRESS=0x...
AGENT_JWT=eyJhbGci...
BACKEND_URL=https://your-backend.example.com
BACKEND_AGENT_KEY=agent-secret-key
STORAGE_DIR=/opt/storachain-data
REGION=eu-central
PRICE_PER_GB=1
```
