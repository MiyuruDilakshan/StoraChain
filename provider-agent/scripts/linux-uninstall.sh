#!/bin/bash
# StoraChain Provider Agent Uninstaller - Linux/VPS
# Run as root: sudo bash linux-uninstall.sh

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║   StoraChain Provider Agent - Uninstaller    ║"
echo "║         Run as: sudo bash linux-uninstall.sh ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "  ✗ Please run as root: sudo bash linux-uninstall.sh"
  exit 1
fi

AGENT_DIR="/opt/storachain-agent"

if [ ! -d "$AGENT_DIR" ]; then
  echo "  ✗ Agent directory not found at $AGENT_DIR"
  exit 0
fi

cd "$AGENT_DIR"

echo "  [1/3] Stopping background services..."
if command -v pm2 &>/dev/null; then
  pm2 delete storachain-provider || true
  pm2 save || true
fi

echo "  [2/3] Wiping local storage and releasing disk space..."
if [ -f "agent.js" ]; then
  node agent.js --uninstall || true
fi

echo "  [3/3] Removing agent files..."
rm -rf "$AGENT_DIR"

echo ""
echo "  ✓ StoraChain Provider Agent has been successfully uninstalled."
echo "  ✓ All reserved storage chunks have been deleted."
echo ""
