#!/bin/bash
# StoraChain Provider Agent Installer - Linux/VPS
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent/scripts/linux-setup.sh)

set -e

REPO_BASE="https://raw.githubusercontent.com/MiyuruDilakshan/StoraChain/main/provider-agent"
AGENT_DIR="$HOME/storachain-agent"

echo "╔══════════════════════════════════════════════╗"
echo "║   StoraChain Provider Agent - Linux Setup    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Install Node.js if missing
if ! command -v node &>/dev/null; then
  echo "  [1/5] Installing Node.js 20..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
    sudo apt-get install -y nodejs >/dev/null 2>&1
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
    sudo yum install -y nodejs >/dev/null 2>&1
  elif command -v dnf &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
    sudo dnf install -y nodejs >/dev/null 2>&1
  else
    echo "  ✗ Cannot install Node.js automatically. Install manually: https://nodejs.org"
    exit 1
  fi
  echo "  ✓ Node.js installed: $(node -v)"
else
  echo "  [1/5] Node.js: $(node -v)"
fi

# Create agent directory
echo "  [2/5] Setting up agent directory: $AGENT_DIR"
mkdir -p "$AGENT_DIR/src" "$AGENT_DIR/scripts"
cd "$AGENT_DIR"

# Download agent files from GitHub
echo "  [3/5] Downloading agent files..."

download_file() {
  local url="$1"
  local dest="$2"
  if ! curl -fsSL "$url" -o "$dest" 2>/dev/null; then
    echo "  ✗ Failed: $dest"
    exit 1
  fi
  echo "    ✓ $dest"
}

download_file "$REPO_BASE/agent.js"                "agent.js"
download_file "$REPO_BASE/package.json"            "package.json"
download_file "$REPO_BASE/src/server.js"           "src/server.js"
download_file "$REPO_BASE/src/storage.js"          "src/storage.js"
download_file "$REPO_BASE/src/registry.js"         "src/registry.js"
download_file "$REPO_BASE/src/integrity.js"        "src/integrity.js"
download_file "$REPO_BASE/scripts/setup-wizard.js" "scripts/setup-wizard.js"

# Install dependencies
echo "  [4/5] Installing dependencies..."
npm install --omit=dev 2>/dev/null || npm install >/dev/null 2>&1
npm install -g pm2 >/dev/null 2>&1
echo "    ✓ Dependencies installed"

# Open firewall port 3001
if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 3001/tcp >/dev/null 2>&1
  echo "    ✓ Port 3001 opened in UFW"
fi

# Run setup wizard
echo "  [5/5] Running setup wizard..."
STORACHAIN_BACKEND="https://api.storachain.miyuru.dev"
node scripts/setup-wizard.js --backend "$STORACHAIN_BACKEND"

# Enable PM2 auto-start on reboot
pm2 save >/dev/null 2>&1
PM2_STARTUP=$(pm2 startup 2>&1 | grep "sudo" | head -1)
if [ -n "$PM2_STARTUP" ]; then
  echo ""
  echo "  To enable auto-start on reboot, run:"
  echo "    $PM2_STARTUP"
fi

echo ""
echo "  Installed to : $AGENT_DIR"
echo "  Commands:"
echo "    pm2 logs storachain-provider"
echo "    pm2 status"
echo "    pm2 restart storachain-provider"
echo ""
echo "  ⚠  Make sure port 3001 is open inbound in your VPS firewall!"
echo ""
