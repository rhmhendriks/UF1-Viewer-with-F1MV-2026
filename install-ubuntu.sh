#!/usr/bin/env bash
# ==============================================================================
# UF1 Viewer – Ubuntu 2026 Install Script
# ==============================================================================
# Installs system dependencies, Node.js (if not present), npm modules, and
# registers a .desktop launcher so the app appears in the GNOME/KDE menu.
#
# Usage:
#   chmod +x install-ubuntu.sh
#   ./install-ubuntu.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="UF1 Viewer 2026"
DESKTOP_FILE="$HOME/.local/share/applications/uf1-viewer-2026.desktop"
ICON_SOURCE="$SCRIPT_DIR/src/icons/windows/logo.png"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

info "=== $APP_NAME Ubuntu Installer ==="
info "Working directory: $SCRIPT_DIR"

# ── 1. System dependencies ────────────────────────────────────────────────────
info "Installing system packages (requires sudo)..."
sudo apt-get update -qq
sudo apt-get install -y \
    libgtk-3-0 \
    libnotify4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    libatspi2.0-0 \
    libsecret-1-0 \
    libgbm1 \
    libdrm2 \
    curl \
    wget

# ── 2. Node.js ────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    info "Node.js not found – installing via NodeSource (LTS)..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VER=$(node --version)
    info "Node.js $NODE_VER already installed."
fi

# Require Node >=18
REQUIRED=18
ACTUAL=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$ACTUAL" -lt "$REQUIRED" ]; then
    error "Node.js >=18 required (found v$ACTUAL). Please upgrade: https://nodejs.org"
fi

# ── 3. npm dependencies ───────────────────────────────────────────────────────
info "Installing npm dependencies..."
cd "$SCRIPT_DIR"
npm install --no-audit --prefer-offline 2>&1 | tail -5

# ── 4. Desktop launcher ───────────────────────────────────────────────────────
info "Creating .desktop launcher at $DESKTOP_FILE ..."
mkdir -p "$HOME/.local/share/applications"
cat > "$DESKTOP_FILE" << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
GenericName=Formula 1 Viewer
Comment=Live timing overlay for Formula 1 2026 Season – works with MultiViewer
Exec=bash -c 'cd "$SCRIPT_DIR" && npm start'
Icon=$ICON_SOURCE
Terminal=false
Categories=Utility;Sports;
Keywords=F1;Formula1;Racing;Timing;MultiViewer;
StartupWMClass=uf1-viewer-2026
MimeType=x-scheme-handler/muvi;
DESKTOP_EOF

# Fix Exec path with full script dir
sed -i "s|cd \"\\\$SCRIPT_DIR\"|cd \"$SCRIPT_DIR\"|g" "$DESKTOP_FILE"

chmod +x "$DESKTOP_FILE"
# Update desktop database
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

# ── 5. Register muvi:// protocol handler (if MultiViewer is installed) ────────
if command -v xdg-mime &>/dev/null; then
    info "Attempting to register muvi:// protocol handler..."
    # Check if MultiViewer already registered it
    HANDLER=$(xdg-mime query default x-scheme-handler/muvi 2>/dev/null || true)
    if [ -z "$HANDLER" ]; then
        xdg-mime default uf1-viewer-2026.desktop x-scheme-handler/muvi 2>/dev/null || true
        info "muvi:// handler registered to UF1 Viewer (can be overridden by MultiViewer)."
    else
        info "muvi:// already handled by: $HANDLER"
    fi
fi

# ── 6. Wayland / transparency note ───────────────────────────────────────────
echo ""
info "=== Post-install notes ==="
if [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
    warning "Wayland detected. Transparent windows require a compositor with EGL."
    warning "If overlay windows appear white/opaque, try running with:"
    warning "  ELECTRON_ENABLE_LOGGING=1 npm start -- --enable-features=UseOzonePlatform --ozone-platform=wayland"
else
    info "X11 session detected. Transparent windows need a compositing manager."
    info "Most Ubuntu installs (GNOME+Mutter, KDE+KWin) include one by default."
fi

echo ""
info "=== Installation complete! ==="
info "Start the app with:"
info "  cd $SCRIPT_DIR && npm start"
info "Or use the '$APP_NAME' entry in your desktop application launcher."
echo ""
info "MultiViewer for F1 must be running on http://localhost:10101 before"
info "connecting. Download it at: https://multiviewer.app"
