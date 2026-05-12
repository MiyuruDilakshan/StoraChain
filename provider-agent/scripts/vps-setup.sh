#!/bin/bash
# ============================================================
# StoraChain Provider Agent — Linux/VPS Installer
# ============================================================

set -e

INSTALL_DIR="$HOME/storachain-agent"
REPO_BASE="https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent"

echo ""
echo "======================================================"
echo "    StoraChain Provider Installer (Linux / VPS)       "
echo "======================================================"
echo ""

echo "=== [1/5] Checking Node.js ==="
if ! command -v node &>/dev/null; then
  echo "Node.js not found. Installing Node.js 20..."
  if ! command -v curl &>/dev/null; then
    sudo apt-get update -y && sudo apt-get install -y curl
  fi
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "Node.js is already installed: $(node -v)"
fi

echo ""
echo "=== [2/5] Creating agent directory ==="
mkdir -p "$INSTALL_DIR/src" "$INSTALL_DIR/scripts"
cd "$INSTALL_DIR"

echo ""
echo "=== [3/5] Downloading agent files from GitHub ==="
echo "  Source: $REPO_BASE"

download_file() {
  local url="$1"
  local dest="$2"
  echo "  Downloading $dest..."
  if ! curl -fsSL "$url" -o "$dest"; then
    echo "  ✗ Failed to download $dest from $url"
    exit 1
  fi
}

download_file "$REPO_BASE/agent.js"                  "agent.js"
download_file "$REPO_BASE/package.json"              "package.json"
download_file "$REPO_BASE/src/server.js"             "src/server.js"
download_file "$REPO_BASE/src/storage.js"            "src/storage.js"
download_file "$REPO_BASE/src/registry.js"           "src/registry.js"
download_file "$REPO_BASE/src/integrity.js"          "src/integrity.js"
download_file "$REPO_BASE/scripts/setup-wizard.js"   "scripts/setup-wizard.js"

echo ""
echo "=== [4/5] Installing dependencies ==="
npm install --omit=dev 2>/dev/null || npm install
npm install -g pm2 > /dev/null 2>&1
echo "  ✓ Dependencies installed"

# ── Open firewall port 3001 if ufw is active ─────────────────────
if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  echo ""
  echo "  Opening port 3001 in UFW firewall..."
  ufw allow 3001/tcp > /dev/null 2>&1 && echo "  ✓ Port 3001 opened"
fi

# ── Backend URL (production) ─────────────────────────────────────
STORACHAIN_BACKEND="https://api.storachain.miyuru.dev"
echo ""
echo "  Using backend: $STORACHAIN_BACKEND"
echo ""

echo "=== [5/5] Running setup wizard ==="
node scripts/setup-wizard.js --backend "$STORACHAIN_BACKEND"

# ── Enable PM2 auto-start on system reboot ───────────────────────
echo ""
echo "  Enabling PM2 auto-start on reboot..."
pm2 save > /dev/null 2>&1
# Generate startup script (may need sudo on first run)
PM2_STARTUP=$(pm2 startup 2>&1 | grep "sudo" | head -1)
if [ -n "$PM2_STARTUP" ]; then
  echo "  Run this command to enable startup on reboot:"
  echo "    $PM2_STARTUP"
fi

echo ""
echo "======================================================"
echo "  Installed to : $INSTALL_DIR"
echo "  Commands:"
echo "    pm2 logs storachain-provider     # view logs"
echo "    pm2 status                       # check status"
echo "    pm2 stop storachain-provider     # stop agent"
echo "    pm2 restart storachain-provider  # restart agent"
echo "======================================================"
echo "  ⚠  Make sure port 3001 is open in your VPS firewall!"
echo "     (Security Group / iptables / UFW: TCP inbound 3001)"
echo "======================================================"
echo ""
