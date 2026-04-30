# 📦 StoraChain Provider System

Complete provider registration, installation, and earnings management system for decentralized storage providers.

---

## 🎯 What is the Provider System?

The Provider System allows anyone to:
1. **Download & Install** a Node.js service on their computer
2. **Register** with an email and password (no blockchain knowledge needed)
3. **Allocate HDD storage** (10 GB - 10 TB)
4. **Go Online** and start earning SCT tokens immediately
5. **Monitor** their device status, earnings, and uptime
6. **Withdraw** tokens to their Ethereum wallet

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Provider's Computer                                        │
│  ───────────────────────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ StoraChain Provider Service (Node.js)               │  │
│  │ ✓ Auto-startup on reboot                            │  │
│  │ ✓ Heartbeat every 30 seconds                        │  │
│  │ ✓ Manages HDD chunks                                │  │
│  │ ✓ Runs on port 3002 (local)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ HTTP                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ~50 GB - 10 TB HDD Storage                           │  │
│  │ └─ .storachain-provider/chunks/                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTPS
                (Heartbeat, Status Updates)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  StoraChain Backend (Node.js + MongoDB)                    │
│  ───────────────────────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Provider API Endpoints                              │  │
│  │ POST   /api/providers/cli/register                  │  │
│  │ POST   /api/providers/cli/heartbeat                 │  │
│  │ POST   /api/providers/cli/:id/go-online             │  │
│  │ GET    /api/providers/cli/:id/dashboard             │  │
│  │ POST   /api/providers/cli/:id/withdraw              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Ethereum Sepolia Integration                        │  │
│  │ ✓ Mint SCT tokens (registration + online bonus)     │  │
│  │ ✓ Transfer tokens (withdrawals)                     │  │
│  │ ✓ Track on-chain to Etherscan                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MongoDB Collections                                 │  │
│  │ • Provider (account info)                           │  │
│  │ • ProviderEarning (transaction history)             │  │
│  │ • ProviderWithdrawal (withdrawal requests)          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↑ HTTPS                ↓ RPC
                   (Web Dashboard)        (Sepolia Testnet)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  React Web Dashboard                  Ethereum Sepolia    │
│  ───────────────────────────────────────────────────────   │
│  ✓ Login with email                   ✓ StoraToken (SCT) │  │
│  ✓ View device info                   ✓ Minting & Transfers│  │
│  ✓ Monitor earnings                   ✓ On-chain tracking │  │
│  ✓ Request withdrawals                ✓ Real transactions  │  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 File Structure

```
StoraChain/
├── provider-installer/                    # ← NEW: CLI installer package
│   ├── package.json
│   ├── src/
│   │   ├── cli.js                        # Interactive setup wizard
│   │   └── service.js                    # Background service (auto-launched)
│
├── backend/
│   ├── models/
│   │   ├── Provider.js                   # ← NEW: Provider account schema
│   │   ├── ProviderEarning.js            # ← NEW: Earning records
│   │   └── ProviderWithdrawal.js         # ← NEW: Withdrawal history
│   │
│   ├── routes/
│   │   └── providerRoutes.js             # ← UPDATED: Added /cli/* endpoints
│   │
│   └── .env.example                      # ← UPDATED: Provider vars
│
├── frontend/
│   └── src/pages/provider/               # ← NEW: Provider UI
│       ├── ProviderSetup.js              # Setup & download guide
│       ├── ProviderSetup.css
│       ├── ProviderDashboard.js          # Main dashboard
│       └── ProviderDashboard.css
│
└── docs/
    └── PROVIDER_SETUP_GUIDE.md           # ← NEW: Complete user guide
```

---

## 🚀 Provider Flow

### 1. Installation

```bash
npm install -g storachain-provider
```

### 2. Interactive Setup

```bash
storachain-provider
```

**Prompts:**
- System check (Node.js, npm, disk)
- Enter email & password
- Ethereum wallet address
- HDD allocation size & path

**Output:**
- Config file: `~/.storachain-provider/config.json`
- Service: Registered for auto-startup
- Storage: `~/.storachain-provider/chunks/`

### 3. Login to Dashboard

**URL:** https://storachain.app/provider

**Enter:** Email used during setup

### 4. Go Online

**Action:** Click "Go Online" → Receive 0.3 SCT bonus

**Process:**
1. Backend verifies provider account
2. Mints 0.1 SCT (registration) to wallet
3. Mints 0.2 SCT (online bonus) to wallet
4. Provider status changes to "online"
5. Starts earning rewards

### 5. Monitor & Withdraw

**Dashboard shows:**
- Total earnings
- Device info (IP, CPU, memory, storage)
- Earning history
- Withdrawal form

**Withdrawal:**
1. Request amount
2. Backend verifies balance
3. Transfers SCT to wallet (real blockchain tx)
4. View on Etherscan

---

## 💰 Earnings Breakdown

| Activity | Amount | When | Notes |
|----------|--------|------|-------|
| **Registration** | 0.1 SCT | Immediately after setup | One-time |
| **Going Online** | 0.2 SCT | First time clicking "Go Online" | One-time |
| **Storage** | Variable | Hourly | Per GB stored per month |
| **Uptime** | Variable | Daily | 99%+ uptime bonus |
| **Bandwidth** | Variable | Per download | Per GB transferred |

**Example:** Provider with 100 GB online for 30 days:
```
Registration bonus:       0.1 SCT
Online bonus:            0.2 SCT
Storage (30 × 1 SCT):   30.0 SCT
Uptime (99.8% bonus):    2.0 SCT
Bandwidth (10 downloads): 1.5 SCT
─────────────────────────────────
Total:                  33.8 SCT
```

---

## 🔧 Backend API Endpoints

### Registration

```http
POST /api/providers/cli/register
Content-Type: application/json

{
  "email": "provider@example.com",
  "password": "securepassword123",
  "machineId": "unique-machine-id",
  "deviceName": "john-laptop"
}

Response:
{
  "success": true,
  "providerId": "507f1f77bcf86cd799439011",
  "message": "Registration successful"
}
```

### Heartbeat (from service)

```http
POST /api/providers/cli/heartbeat
Content-Type: application/json

{
  "providerId": "507f1f77bcf86cd799439011",
  "machineId": "unique-machine-id",
  "status": "online",
  "hdd": {
    "totalGB": 100,
    "freeGB": 80,
    "usedGB": 20
  },
  "device": {
    "hostname": "john-laptop",
    "ip": "192.168.1.100",
    "cpus": 4
  },
  "uptime": 3600
}
```

### Go Online

```http
POST /api/providers/cli/:id/go-online
Content-Type: application/json

{
  "hddTotalGB": 100,
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc2e7416Ea65f9"
}

Response:
{
  "success": true,
  "bonus": "0.3 SCT",
  "txHash": "0x123abc...",
  "provider": {
    "status": "online",
    "wallet": "0x742d35Cc6634C0532925a3b844Bc2e7416Ea65f9"
  }
}
```

### Get Dashboard

```http
GET /api/providers/cli/:id/dashboard

Response:
{
  "success": true,
  "provider": {
    "email": "provider@example.com",
    "status": "online",
    "wallet": "0x742d35Cc6634C0532925a3b844Bc2e7416Ea65f9",
    "hdd": { "totalGB": 100, "freeGB": 80, "usedGB": 20 },
    "device": { "hostname": "john-laptop", "ip": "192.168.1.100", ... }
  },
  "earnings": {
    "total": 0.3,
    "records": [
      { "amount": 0.1, "type": "registration_bonus", "createdAt": "..." },
      { "amount": 0.2, "type": "online_bonus", "createdAt": "..." }
    ]
  },
  "balance": {
    "total": 0.3,
    "withdrawn": 0,
    "available": 0.3
  }
}
```

### Withdraw

```http
POST /api/providers/cli/:id/withdraw
Content-Type: application/json

{
  "amount": 0.25
}

Response:
{
  "success": true,
  "message": "Withdrawal processed",
  "txHash": "0x456def...",
  "withdrawal": {
    "amount": 0.25,
    "status": "completed",
    "walletAddress": "0x742d35..."
  }
}
```

---

## 🛠️ Installation & Setup

### Prerequisites

- **Node.js 18+**
- **MongoDB** (local or Atlas)
- **Sepolia RPC URL** (Infura or QuickNode)
- **Private key** of deployer wallet (for token minting)
- **StoraToken contract** deployed on Sepolia

### Backend Setup

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with:
# - SEPOLIA_RPC_URL
# - PRIVATE_KEY
# - STORATOKEN_ADDRESS
# - MONGODB_URI

# 3. Start server
npm start
```

### Frontend Setup

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Add provider route to App.js
import ProviderSetup from './pages/provider/ProviderSetup';
import ProviderDashboard from './pages/provider/ProviderDashboard';

// In routing:
<Route path="/provider/setup" element={<ProviderSetup />} />
<Route path="/provider/dashboard" element={<ProviderDashboard />} />

# 3. Start frontend
npm start
```

### Publish CLI Package

```bash
# 1. Configure npm credentials
npm login

# 2. Update version
cd provider-installer
npm version minor  # or patch/major

# 3. Publish
npm publish --access public

# 4. Test installation
npm install -g storachain-provider
storachain-provider
```

---

## 📊 Database Schema

### Provider Collection

```json
{
  "_id": "ObjectId",
  "email": "provider@example.com",
  "password": "hashed-password",
  "machineId": "unique-id",
  "deviceName": "john-laptop",
  "status": "online|offline|setup|suspended",
  "wallet": {
    "address": "0x742d35Cc6634C0532925a3b844Bc2e7416Ea65f9"
  },
  "hdd": {
    "path": "/mnt/storage",
    "totalGB": 100,
    "freeGB": 80,
    "usedGB": 20
  },
  "device": {
    "hostname": "john-laptop",
    "platform": "linux",
    "cpus": 4,
    "memory": { "totalMB": 8192, "freeMB": 4096 },
    "ip": "192.168.1.100"
  },
  "createdAt": "2024-04-30T10:00:00Z",
  "onlineAt": "2024-04-30T10:05:00Z",
  "offlineAt": null,
  "lastHeartbeat": "2024-04-30T10:30:15Z",
  "uptime": 1800
}
```

### ProviderEarning Collection

```json
{
  "_id": "ObjectId",
  "providerId": "ObjectId",
  "amount": 0.1,
  "type": "registration_bonus|online_bonus|storage_reward|bandwidth_reward",
  "description": "Registration bonus (0.1 SCT)",
  "transactionHash": "0x123abc...",
  "createdAt": "2024-04-30T10:00:00Z"
}
```

### ProviderWithdrawal Collection

```json
{
  "_id": "ObjectId",
  "providerId": "ObjectId",
  "amount": 0.25,
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc2e7416Ea65f9",
  "status": "pending|processing|completed|failed",
  "transactionHash": "0x456def...",
  "error": null,
  "createdAt": "2024-04-30T11:00:00Z",
  "completedAt": "2024-04-30T11:00:30Z"
}
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Sepolia Testnet
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=0x...  # Deployer wallet private key
STORATOKEN_ADDRESS=0x...  # StoraToken contract

# Provider bonuses (in SCT)
PROVIDER_REGISTRATION_BONUS=0.1
PROVIDER_ONLINE_BONUS=0.2

# Backend URL for CLI service
PROVIDER_REGISTRATION_BACKEND_URL=http://localhost:5000
```

### Reward Amounts

Edit in `.env` to adjust:
- Registration bonus
- Online bonus
- Storage reward rate
- Bandwidth reward rate

---

## 🧪 Testing

### 1. Validate Setup

```bash
node scripts/validate-provider-setup.js
```

Output:
```
✓ Node.js version (v18.17.0)
✓ File: backend/routes/providerRoutes.js
✓ File: backend/models/Provider.js
...
✓ 12 passed, 0 failed
```

### 2. Test CLI Registration

```bash
storachain-provider
# Follow prompts with:
# Email: test@example.com
# Password: TestPass123
# Wallet: 0x742d35Cc6634C0532925a3b844Bc2e7416Ea65f9
# HDD: 50 GB at ~/storachain-test
```

### 3. Test Dashboard Login

Open: https://localhost:3000/provider

- Enter: test@example.com
- Should see dashboard

### 4. Test Go Online

- Click "Go Online"
- Enter wallet address
- Verify 0.3 SCT appears in Earnings tab

### 5. Test Withdrawal

- Go to Withdrawal tab
- Enter 0.1 SCT
- Click Withdraw
- Verify TX on Etherscan

---

## 📚 User Documentation

See [PROVIDER_SETUP_GUIDE.md](./PROVIDER_SETUP_GUIDE.md) for complete user guide including:
- Installation steps
- Dashboard walkthrough
- Earnings explanation
- Troubleshooting FAQ
- Best practices

---

## 🐛 Troubleshooting

### Provider service not starting

```bash
# Check logs
cat ~/.storachain-provider/logs/*

# Restart service
storachain-provider restart

# Or restart computer (auto-launches)
```

### Email already registered

- Use different email, OR
- Go to dashboard to login with existing email

### Tokens not minting

**Check:**
1. Backend has valid SEPOLIA_RPC_URL
2. Backend wallet has enough Sepolia ETH (for gas)
3. StoraToken contract address is correct
4. Contract is deployed and callable

**View logs:**
```bash
# Backend
tail -f logs/error.log

# Provider service
cat ~/.storachain-provider/logs/service.log
```

### Withdrawal failing

**Reasons:**
1. Insufficient balance
2. Backend wallet has no Sepolia ETH (gas fee)
3. Network issue (wait and retry)
4. Contract issue

---

## 📈 Monitoring & Analytics

### Provider Metrics

Via dashboard at: https://storachain.app/admin

- Total providers online
- Total earnings distributed
- Withdrawal volume
- Average uptime
- Storage capacity

### Provider Service Health

Monitor via service logs:
```bash
tail -f ~/.storachain-provider/logs/heartbeat.log
```

---

## 🔐 Security Considerations

### CLI Installation

- Package is open-source on GitHub
- No hidden processes or tracking
- Config stored locally in `~/.storachain-provider/`
- Auto-startup only runs local service

### Wallet Security

- Private key stored only in backend `.env`
- Not shared with providers
- Tokens minted by backend wallet via smart contract
- Withdrawals transfer via ERC-20 `transfer()`

### Data Privacy

- Passwords hashed in database (TODO: implement bcrypt)
- Heartbeat contains only device stats, no personal files
- All communication over HTTPS

---

## 🤝 Contributing

To add features or fix bugs:

1. Fork repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

Areas for contribution:
- Better provider discovery/matching
- Enhanced earnings calculation
- More reward types
- Multi-asset withdrawals
- Provider reputation system

---

## 📄 License

MIT License - see LICENSE file

---

## 🆘 Support

- **GitHub Issues**: Report bugs here
- **Email**: support@storachain.app
- **Discord**: Join community chat
- **Docs**: See docs/ folder

---

**Happy storing! 🚀**
