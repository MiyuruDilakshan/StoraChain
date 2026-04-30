# StoraChain Provider Installation & Earnings Guide

## ✨ Overview

StoraChain Providers are decentralized storage nodes that earn **SCT (StoraChain Tokens)** by storing and serving files on the network. This guide covers the complete setup process, from installation to earning and withdrawing tokens.

---

## 🚀 Quick Start (5 minutes)

### 1. Prerequisites
- **Node.js 18+** installed ([download here](https://nodejs.org/))
- **Ethereum wallet** with address (for receiving rewards)
- **Computer** that can run 24/7 (or as much as possible)
- **Disk space** available (minimum 10 GB recommended)

### 2. Install Provider Service

Run one of these commands based on your system:

#### Windows (PowerShell)
```powershell
npm install -g storachain-provider
storachain-provider
```

#### macOS / Linux (Terminal)
```bash
npm install -g storachain-provider
storachain-provider
```

### 3. Follow the Installer Steps

The interactive installer will:
1. ✓ Check your system (Node.js, npm, disk space)
2. ✓ Ask for email and password
3. ✓ Request HDD storage allocation (GB)
4. ✓ Set up auto-startup service
5. ✓ Display setup completion message

### 4. Access Your Dashboard

Go to: **https://storachain.app/provider**

- Enter the email you used during installation
- You'll see your dashboard with device info and earnings

### 5. Go Online

- Click **"Go Online"** button
- Provide your Ethereum wallet address
- **Receive 0.3 SCT bonus** (0.1 registration + 0.2 online)
- Start earning immediately!

---

## 📋 Detailed Setup Guide

### Step 1: Download & Install

#### Windows
1. Open **PowerShell** (right-click → Run as Administrator)
2. Run:
   ```powershell
   npm install -g storachain-provider
   ```
3. Wait for installation to complete

#### macOS
1. Open **Terminal**
2. Run:
   ```bash
   npm install -g storachain-provider
   ```

#### Linux
1. Open **Terminal**
2. Run:
   ```bash
   npm install -g storachain-provider
   ```

**Note:** If you get permission errors, use:
```bash
npm install -g storachain-provider --unsafe-perm
```

---

### Step 2: Run the Installer

After installation, run:
```bash
storachain-provider
```

This launches an interactive setup wizard.

#### Installer Prompts

**1. System Check**
- Verifies Node.js version (must be 18+)
- Checks npm availability
- Verifies disk space availability

**2. Provider Credentials**
- **Email**: Your account email (used for login)
- **Password**: Account password (min 8 characters)
- **Wallet Address**: Ethereum address for receiving rewards (format: `0x...`)

**3. HDD Storage**
- **Allocation Size**: Amount of disk space to dedicate (e.g., 100 GB)
- **Storage Path**: Where files will be stored
  - Windows: `D:\storage`, `E:\storage`, etc.
  - Linux/macOS: `/mnt/storage`, `/var/storage`, etc.

**4. Auto-Startup Setup**
- Windows: Creates scheduled task (runs at startup)
- Linux: Creates systemd service
- macOS: Creates LaunchAgent

**Output:**
```
╔════════════════════════════════════════╗
║    🎉 Setup Successful! 🎉            ║
╚════════════════════════════════════════╝

Next Steps:
1. Go to your Provider Dashboard
   → URL: https://storachain.app/provider

2. Log in with your email and password

3. Click "Go Online" to activate your provider

4. Your provider service will auto-launch on system startup
```

---

### Step 3: Access Provider Dashboard

**URL:** https://storachain.app/provider

**Login:**
1. Enter your email
2. Click "Access Dashboard"

**Dashboard Overview:**
- **Status**: Current provider status (online/offline/setup)
- **Earnings**: Total SCT tokens earned
- **Device Info**: Hostname, IP, CPU, Memory, Storage
- **Earnings History**: Detailed transaction log
- **Withdrawal**: Request token transfers to wallet

---

### Step 4: Go Online

1. In dashboard, click **"🚀 Go Online"** button
2. Confirm your wallet address
3. You'll receive **0.3 SCT** bonus:
   - **0.1 SCT**: Registration bonus
   - **0.2 SCT**: Online bonus

**Your provider is now active!** 🎉

---

## 💰 Earnings System

### How You Earn

Providers earn SCT tokens for:

| Activity | Reward | When |
|----------|--------|------|
| **Registration** | 0.1 SCT | After CLI setup |
| **Going Online** | 0.2 SCT | First time going online |
| **Storage Reward** | Variable | For each GB-month stored |
| **Uptime Reward** | Variable | Bonus for 99%+ uptime |
| **Bandwidth Reward** | Variable | For each download served |

### Example Earnings Timeline

```
Day 1:
  - Complete setup → +0.1 SCT (registration)
  - Go online → +0.2 SCT (online bonus)
  Total: 0.3 SCT

Week 1:
  - User uploads 50 GB files → +0.5 SCT
  - Uptime: 99.8% → +0.2 SCT (bonus)
  Total: +0.7 SCT (new total: 1.0 SCT)

Month 1:
  - Storage: 50 GB × 30 days → +5 SCT
  - Downloads: 100 served → +2 SCT
  - Total monthly: +7 SCT (balance: ~8 SCT)
```

### View Earnings

In dashboard, **Earnings tab** shows:
- **Total Earned**: All-time earnings
- **Withdrawn**: Tokens transferred to wallet
- **Available**: Ready to withdraw
- **History**: Detailed transaction log

---

## 💸 Withdrawals

### Request Withdrawal

1. Go to **Withdrawal** tab in dashboard
2. Enter amount in SCT
3. Click "💸 Withdraw"
4. Tokens transfer to your wallet (testnet)

### Withdrawal Process

```
Your Balance: 10 SCT
        ↓
Request Withdrawal: 5 SCT
        ↓
Backend verifies balance ✓
        ↓
Transfers 5 SCT to your wallet
        ↓
Withdrawal complete (blockchain tx hash shown)
        ↓
Your Balance: 5 SCT
```

### Real Testnet Transfers ⚠️

**Important:** Withdrawals are real transactions on **Sepolia Testnet**:
- Transactions are recorded on-chain
- You can verify on [Etherscan](https://sepolia.etherscan.io/)
- Tokens arrive in your wallet within seconds
- **Note:** You can only withdraw what you've earned

### Viewing Transactions

Each withdrawal shows a transaction hash (TX) that links to:
```
https://sepolia.etherscan.io/tx/{txHash}
```

Click to verify the transfer on-chain.

---

## 📊 Provider Dashboard Features

### Overview Tab
- Total earnings & balance
- Storage allocated
- Uptime hours
- Status badges
- Go Online/Offline controls

### Earnings Tab
- Detailed earning history
- Earning type breakdown
- Date and amount for each transaction
- Transaction descriptions

### Device Tab
- Hostname and platform
- IP address & wallet
- CPU cores and memory
- Storage usage stats

### Withdrawal Tab
- Request withdrawal form
- Balance display
- Withdrawal history
- Transaction hash links

---

## ⚙️ Service Management

### Check Service Status

**Windows:**
```powershell
Get-Process storachain-provider | Select-Object Name, ProcessName
```

**Linux/macOS:**
```bash
ps aux | grep storachain-provider
```

### Restart Service

**Windows:**
```powershell
Restart-Service storachain-provider
```

**Linux/macOS:**
```bash
systemctl restart storachain-provider
```

Or simply restart your computer.

### View Logs

**Windows:**
- Logs: `%APPDATA%\.storachain-provider\logs\`

**Linux/macOS:**
- Logs: `~/.storachain-provider/logs/`

---

## 📱 Dashboard Commands

### Via CLI

```bash
# Check provider status
storachain-provider status

# Go online
storachain-provider online --wallet 0x123...

# Go offline
storachain-provider offline

# View earnings
storachain-provider earnings
```

### Via Web Dashboard

**URL:** https://storachain.app/provider

- Online interface
- Real-time updates (click refresh)
- Mobile-responsive design
- No CLI knowledge needed

---

## 🆘 Troubleshooting

### Provider not appearing in dashboard

**Problem:** Installed provider but dashboard shows "not found"

**Solutions:**
1. Verify service is running: `storachain-provider status`
2. Check firewall isn't blocking port 3002
3. Restart service: Restart computer or `storachain-provider restart`
4. Check browser cache: Ctrl+Shift+Delete → Clear cookies

### Email already registered

**Problem:** "Email already registered" during setup

**Solutions:**
1. Use a different email address
2. If it's your email, go to dashboard with that email to login
3. Contact support if you forgot your password

### HDD mounting issues

**Problem:** Storage path not accessible

**Solutions:**
1. Verify the path exists and you have write permissions
2. Use a local path (Windows: `D:\storage`, Linux: `/mnt/storage`)
3. Ensure the disk has enough free space
4. Re-run installer with different path

### Tokens not received after going online

**Problem:** "Go Online" clicked but no bonus received

**Solutions:**
1. Check Earnings tab → should show 0.3 SCT
2. If not, backend minting may have failed (check logs)
3. Refresh dashboard (F5) and check again
4. Wait 30 seconds and refresh (sometimes delayed)
5. Contact support with screenshot

### Withdrawal transaction stuck

**Problem:** Withdrawal shows "pending" for long time

**Solutions:**
1. Wait 2-3 minutes (testnet can be slow)
2. Check transaction on Etherscan using TX hash
3. If it shows "failed", try again with smaller amount
4. Ensure backend wallet has enough SepoliaETH for gas

---

## 💡 Best Practices

### For Maximum Earnings

1. **Keep online 24/7**
   - Uptime bonuses reward continuous availability
   - Restart computer won't interrupt service (auto-launches)

2. **Allocate good storage**
   - More storage = more files = more earning potential
   - Start with 50-100 GB if you have space

3. **Maintain good connectivity**
   - Upload/download speeds affect rewards
   - Wired connection preferred over WiFi
   - Stable IP helps

4. **Monitor your dashboard**
   - Check earnings weekly
   - Withdraw before testnet resets
   - Track device health (CPU, memory, storage)

### Security Tips

1. **Wallet Security**
   - Use a dedicated MetaMask wallet for testing
   - Keep seed phrase safe
   - Never share private keys

2. **Provider Security**
   - Use strong passwords (12+ characters)
   - Enable 2FA if available
   - Keep Node.js updated

3. **System Security**
   - Keep OS updated
   - Use firewall
   - Monitor resource usage

---

## 📞 Support & FAQ

### Q: Will auto-startup work if I disable it?
**A:** Yes, just re-run `storachain-provider` to restart the service manually.

### Q: Can I run multiple providers on one machine?
**A:** Not recommended. Each needs separate storage and generates own ID.

### Q: What if my computer crashes?
**A:** Service auto-restarts when computer reboots. Uptime counter resets but earnings remain.

### Q: Can I change my storage allocation?
**A:** Yes, go to Provider Dashboard → Device tab → edit and save.

### Q: When are rewards distributed?
**A:** Instant for bonuses; storage/bandwidth rewards calculated hourly.

### Q: Can I withdraw anytime?
**A:** Yes, withdraw any amount you've earned, anytime.

### Q: Is this real money?
**A:** SCT tokens have real value on testnet. Withdrawals are real blockchain transactions.

### Q: What about gas fees?
**A:** Backend covers gas fees for minting. Withdrawals may cost small gas fee.

---

## 🎯 Next Steps

1. ✅ Complete installation
2. ✅ Access dashboard
3. ✅ Go online (get bonus 0.3 SCT!)
4. ✅ Monitor earnings
5. ✅ Withdraw tokens
6. ✅ Increase storage allocation (earn more!)
7. ✅ Help others join StoraChain

---

## 📚 Resources

- **Dashboard**: https://storachain.app/provider
- **Sepolia Etherscan**: https://sepolia.etherscan.io/
- **MetaMask Wallet**: https://metamask.io/
- **Node.js**: https://nodejs.org/

---

**Happy storing! 🚀**

Questions? Issues? Visit our [support portal](#) or email support@storachain.app

