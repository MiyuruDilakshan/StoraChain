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
REPO_BASE="https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent"

curl -fsSL "$REPO_BASE/agent.js" -o agent.js
mkdir -p src scripts
curl -fsSL "$REPO_BASE/src/server.js" -o src/server.js
curl -fsSL "$REPO_BASE/src/storage.js" -o src/storage.js
curl -fsSL "$REPO_BASE/src/registry.js" -o src/registry.js
curl -fsSL "$REPO_BASE/scripts/setup-wizard.js" -o scripts/setup-wizard.js

echo "=== [4/4] Installing dependencies ==="
if [ ! -f "package.json" ]; then
  npm init -y > /dev/null 2>&1
fi
npm install -g pm2 > /dev/null 2>&1
npm install axios dotenv express uuid --save > /dev/null 2>&1

# ── Ask for backend URL ────────────────────────────────────────────────────
# VPS providers cannot reach localhost:5000 on the project owner's PC.
# The backend must be publicly accessible (deployed URL or ngrok tunnel).
echo ""
echo "======================================================"
echo "  Backend Server URL"
echo "  This is the public address of the StoraChain backend."
echo "  Example: https://storachain-backend.onrender.com"
echo "           https://abc123.ngrok.io"
echo "======================================================"

# Allow pre-setting via environment variable (useful for automation)
if [ -z "$STORACHAIN_BACKEND" ]; then
  read -rp "  Enter backend URL: " STORACHAIN_BACKEND
  # Strip trailing slash
  STORACHAIN_BACKEND="${STORACHAIN_BACKEND%/}"
fi

if [ -z "$STORACHAIN_BACKEND" ]; then
  echo "  ERROR: Backend URL is required for VPS setup."
  exit 1
fi

echo ""
echo "  Using backend: $STORACHAIN_BACKEND"
echo ""

# Run setup wizard
node scripts/setup-wizard.js --backend "$STORACHAIN_BACKEND"

echo ""
echo "  Installed to: $INSTALL_DIR"
echo "  Commands:  pm2 logs storachain-provider"
echo "             pm2 status"
echo "             pm2 stop storachain-provider"
