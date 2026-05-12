#!/bin/bash
# ============================================================
# StoraChain Provider Agent — Linux/VPS Installer
# ============================================================

set -e

INSTALL_DIR="$HOME/storachain-agent"

echo ""
echo "======================================================"
echo "    StoraChain Provider Installer (Linux / VPS)       "
echo "======================================================"
echo ""

echo "=== [1/4] Checking Node.js ==="
if ! command -v node &>/dev/null; then
  echo "Node.js not found. Installing Node.js..."
  if ! command -v curl &>/dev/null; then
    sudo apt-get update -y && sudo apt-get install curl -y
  fi
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "Node.js is already installed: $(node -v)"
fi

echo "=== [2/4] Creating agent directory ==="
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo "=== [3/4] Downloading agent files ==="
REPO_BASE="https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/tree/main/provider-agent"

curl -fsSL "$REPO_BASE/agent.js" -o agent.js
mkdir -p src scripts
curl -fsSL "$REPO_BASE/src/server.js" -o src/server.js
curl -fsSL "$REPO_BASE/src/storage.js" -o src/storage.js
curl -fsSL "$REPO_BASE/src/registry.js" -o src/registry.js
curl -fsSL "$REPO_BASE/src/integrity.js" -o src/integrity.js
curl -fsSL "$REPO_BASE/scripts/setup-wizard.js" -o scripts/setup-wizard.js

echo "=== [4/4] Installing dependencies ==="
if [ ! -f "package.json" ]; then
  npm init -y > /dev/null 2>&1
fi
npm install -g pm2 > /dev/null 2>&1
npm install axios dotenv express uuid --save > /dev/null 2>&1

# ── Backend URL (production) ─────────────────────────────────────────────
STORACHAIN_BACKEND="https://api.storachain.miyuru.dev"
echo ""
echo "  Using backend: $STORACHAIN_BACKEND"
echo ""

# Run setup wizard (only asks for email + password)
node scripts/setup-wizard.js --backend "$STORACHAIN_BACKEND"

echo ""
echo "  Installed to: $INSTALL_DIR"
echo "  Commands:  pm2 logs storachain-provider"
echo "             pm2 status"
echo "             pm2 stop storachain-provider"
