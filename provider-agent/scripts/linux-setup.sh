#!/bin/bash
# StoraChain Provider Agent Installer - Linux/VPS
# Run as root: sudo bash linux-setup.sh

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║   StoraChain Provider Agent - Linux Setup    ║"
echo "║         Run as: sudo bash linux-setup.sh     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "  ✗ Please run as root: sudo bash linux-setup.sh"
  exit 1
fi

STORACHAIN_BACKEND="${STORACHAIN_BACKEND:-http://localhost:5000}"

# Install Node.js if missing
if ! command -v node &>/dev/null; then
  echo "  [1/4] Installing Node.js..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y nodejs >/dev/null 2>&1
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    yum install -y nodejs >/dev/null 2>&1
  elif command -v dnf &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    dnf install -y nodejs >/dev/null 2>&1
  else
    echo "  ✗ Cannot install Node.js automatically. Install manually: https://nodejs.org"
    exit 1
  fi
  echo "  ✓ Node.js installed: $(node -v)"
else
  echo "  [1/4] Node.js already installed: $(node -v)"
fi

# Create agent directory
echo "  [2/4] Setting up agent directory..."
AGENT_DIR="/opt/storachain-agent"
mkdir -p "$AGENT_DIR/src" "$AGENT_DIR/scripts"
cd "$AGENT_DIR"

# Download agent files from GitHub
REPO="https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent/scripts/storachain-agent"
echo "  [3/4] Downloading agent files..."
curl -fsSL "$REPO/agent.js"                    -o agent.js
curl -fsSL "$REPO/src/server.js"               -o src/server.js
curl -fsSL "$REPO/src/storage.js"              -o src/storage.js
curl -fsSL "$REPO/src/registry.js"             -o src/registry.js
curl -fsSL "$REPO/scripts/setup-wizard.js"     -o scripts/setup-wizard.js

# Install dependencies
echo "  [4/4] Installing dependencies..."
npm init -y >/dev/null 2>&1
npm install axios dotenv express uuid >/dev/null 2>&1

# Run setup wizard (only asks email + password)
echo ""
node scripts/setup-wizard.js

echo ""
echo "  Installed to: $AGENT_DIR"
echo "  Commands:  pm2 logs storachain-provider"
echo "             pm2 status"
echo "             pm2 stop storachain-provider"
