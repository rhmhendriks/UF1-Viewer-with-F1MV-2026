#!/usr/bin/env bash
# ==============================================================================
# UF1 Viewer – Ubuntu 2026 Launch Script
# ==============================================================================
# Detects Wayland / X11 and sets the appropriate Electron flags before
# launching the app.
#
# Usage:
#   chmod +x run-ubuntu.sh
#   ./run-ubuntu.sh [--wayland] [--x11] [--debug]
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[UF1]${NC} $*"; }
warning() { echo -e "${YELLOW}[UF1]${NC} $*"; }

# ── Parse flags ───────────────────────────────────────────────────────────────
FORCE_WAYLAND=false
FORCE_X11=false
DEBUG=false
for arg in "$@"; do
    case $arg in
        --wayland) FORCE_WAYLAND=true ;;
        --x11)     FORCE_X11=true ;;
        --debug)   DEBUG=true ;;
    esac
done

# ── Build Electron flags ──────────────────────────────────────────────────────
ELECTRON_FLAGS=""

if $FORCE_WAYLAND; then
    ELECTRON_FLAGS="--enable-features=UseOzonePlatform,WaylandWindowDecorations --ozone-platform=wayland"
    info "Forcing Wayland mode."
elif $FORCE_X11; then
    ELECTRON_FLAGS="--ozone-platform=x11"
    info "Forcing X11 mode."
elif [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
    ELECTRON_FLAGS="--enable-features=UseOzonePlatform,WaylandWindowDecorations --ozone-platform=wayland"
    info "Wayland session detected – using Wayland platform."
else
    info "X11 session – using default Chromium rendering."
fi

# Disable sandbox when running as root inside containers / CI
if [ "$(id -u)" = "0" ]; then
    warning "Running as root – adding --no-sandbox flag."
    ELECTRON_FLAGS="$ELECTRON_FLAGS --no-sandbox"
fi

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
exec npx electron $DEBUG_FLAGS . $ELECTRON_FLAGS
