#!/usr/bin/env bash
# ==============================================================================
# UF1 Viewer – Fix Electron Binary
# ==============================================================================
# The initial npm install downloaded a corrupt/incomplete Electron binary (50KB
# stub instead of the full ~200MB binary). This script fixes it by:
#   1. Killing any running Electron processes
#   2. Clearing the Electron download cache
#   3. Removing the broken node_modules/electron
#   4. Reinstalling the electron npm package with a fresh binary download
#
# Usage:
#   chmod +x fix-electron.sh
#   ./fix-electron.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

info "=== UF1 Viewer – Electron Binary Fix ==="
echo ""

# 1. Kill running Electron processes
info "Killing any running Electron processes..."
pkill -f "Electron" 2>/dev/null || true
sleep 2

# 2. Clear Electron download cache
info "Clearing Electron download cache..."
rm -rf "$HOME/Library/Caches/electron" 2>/dev/null || true
rm -rf "$HOME/.cache/electron" 2>/dev/null || true

# 3. Remove broken electron from node_modules
info "Removing broken node_modules/electron..."
cd "$SCRIPT_DIR"
rm -rf node_modules/electron

# 4. Check current binary size (if still exists)
if [[ -f "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ]]; then
    SIZE=$(stat -f%z "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" 2>/dev/null || echo "0")
    if [[ "$SIZE" -lt 1000000 ]]; then
        warning "Binary is only ${SIZE} bytes (expected ~200MB) — corrupt download detected."
        rm -rf node_modules/electron
    fi
fi

# 5. Reinstall electron with fresh download
info "Installing electron@28 (this downloads ~200MB, may take a few minutes)..."
npm install electron@28 --no-audit 2>&1 | tail -10

# 6. Verify
if [[ -f "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ]]; then
    SIZE=$(stat -f%z "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" 2>/dev/null || echo "0")
    if [[ "$SIZE" -gt 1000000 ]]; then
        VERSION=$(./node_modules/.bin/electron --version 2>/dev/null || echo "unknown")
        info "Electron $VERSION installed successfully (binary: ${SIZE} bytes)."
    else
        error "Binary is still too small (${SIZE} bytes). Check your internet connection and retry."
    fi
else
    error "Electron binary not found after install. Run: npm install electron@28"
fi

echo ""
info "=== Done! ==="
info "You can now run:  npm start  or  ./run-mac.sh  or  open -a 'UF1 Viewer 2026'"
