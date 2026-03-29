#!/usr/bin/env bash
# ==============================================================================
# UF1 Viewer – macOS Launch Script
# ==============================================================================
# Launches the Electron app on macOS with optional debug mode.
#
# Usage:
#   chmod +x run-mac.sh
#   ./run-mac.sh [--debug]
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[UF1]${NC} $*"; }
warning() { echo -e "${YELLOW}[UF1]${NC} $*"; }

# ── Parse flags ───────────────────────────────────────────────────────────────
DEBUG=false
for arg in "$@"; do
    case $arg in
        --debug) DEBUG=true ;;
        *)       warning "Unknown flag: $arg (ignored)" ;;
    esac
done

# ── Detect Apple Silicon vs Intel ─────────────────────────────────────────────
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
    info "Apple Silicon (arm64) detected."
else
    info "Intel (x86_64) detected."
fi

# ── Build flags ───────────────────────────────────────────────────────────────
DEBUG_FLAGS=""
if $DEBUG; then
    DEBUG_FLAGS="--inspect=9229"
    export ELECTRON_ENABLE_LOGGING=1
    info "Debug mode: Chrome DevTools on port 9229, Electron logging enabled."
fi

cd "$SCRIPT_DIR"

info "Starting UF1 Viewer 2026..."
info "API endpoint: http://localhost:10101/api/graphql"
echo ""

# shellcheck disable=SC2086
exec npx electron $DEBUG_FLAGS .
