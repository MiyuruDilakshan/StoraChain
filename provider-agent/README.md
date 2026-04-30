# StoraChain Provider Agent

A lightweight Node.js daemon that runs on a provider's machine, reserves local disk space, and earns **SCT tokens** by hosting file shards for StoraChain seekers.

---

## Quick Start

### 1. Install dependencies
```bash
cd provider-agent
npm install
```

### 2. Configure your wallet
```bash
cp .env.example .env
# Edit .env and set WALLET_ADDRESS to your Ethereum address
```

### 3. Get your JWT (for auto-registration)
Log in to StoraChain and copy your JWT token. Add it to `.env`:
```
AGENT_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Start the agent
```bash
# Offer 20 GB at 2 SCT/GB from region EU on port 3001:
node agent.js --space 20 --price 2 --region EU --port 3001 --wallet 0xYourAddress

# Or simply (reads from .env):
npm start -- --space 20 --wallet 0xYourAddress
```

### 5. Verify it's running
```bash
curl http://localhost:3001/health
```
Expected response:
```json
{
  "status": "online",
  "usedBytes": 0,
  "availableBytes": 21474836480,
  "maxBytes": 21474836480,
  "usedGB": 0,
  "availableGB": 20,
  "maxGB": 20,
  "chunkCount": 0,
  "timestamp": "2026-04-27T10:00:00.000Z"
}
```

---

## CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--space <GB>` | Storage capacity to offer | 10 |
| `--port <number>` | HTTP server port | 3001 |
| `--wallet <address>` | Your Ethereum wallet (**required**) | — |
| `--price <SCT>` | Price per GB per day in SCT | 1 |
| `--region <label>` | Geographic region (e.g. EU, US-East) | local |
| `--dir <path>` | Directory to store chunks | `./storachain-storage` |
| `--backend <url>` | Backend server URL | `http://localhost:5000` |
| `--help` | Show help | — |

---

## How It Works

```
1. Agent starts → reserves ./storachain-storage/ folder on disk
2. Agent registers with StoraChain backend (POST /api/providers/register)
3. Backend shows this node to seekers as an available storage provider
4. When a seeker uploads a file:
   └─ Backend shards the file into 2-3 chunks
   └─ Backend sends each chunk: POST http://localhost:3001/chunk
   └─ Agent stores the chunk as a .chunk binary file on disk
5. When a seeker downloads a file:
   └─ Backend requests chunk: GET http://localhost:3001/chunk/:chunkId
   └─ Agent reads the file from disk and returns the binary data
6. Agent sends heartbeat every 30 seconds to report disk usage
7. Provider earns SCT tokens automatically via smart contract

The agent stores shards in a hidden vault under the chosen storage path, keeps opaque chunk filenames, and maintains a reserve file so the provider's selected capacity is actually consumed on disk until the service releases it.
```

---

## Security

- All backend → agent requests are authenticated with a shared `BACKEND_AGENT_KEY`
- The `/health` endpoint is public (no key required) — used for uptime monitoring
- The agent never contacts external services; only the StoraChain backend
- Chunks are encrypted before they ever reach the agent; the node only stores opaque encrypted bytes
- The agent can be uninstalled with `node agent.js --uninstall --dir <path>`, which deletes local chunks, releases reserved capacity, and deactivates the provider listing

---

## File Structure

```
provider-agent/
├── agent.js          ← CLI entry point
├── src/
│   ├── storage.js    ← Disk management (save/read/delete chunks)
│   ├── server.js     ← Express HTTP server (chunk endpoints)
│   └── registry.js   ← Registration + heartbeat with backend
├── .env.example      ← Environment variable template
├── .env              ← Your config (not committed to git)
└── package.json
```

---

## Running Multiple Agents

To simulate multiple providers (for testing), run on different ports:
```bash
# Terminal 1
node agent.js --port 3001 --space 10 --wallet 0xProvider1 --region EU

# Terminal 2
node agent.js --port 3002 --space 15 --wallet 0xProvider2 --region US-East
```
