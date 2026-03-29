# UF1 Viewer — 2026 Season · Ubuntu Edition

> Live timing overlays and multi-window viewer for Formula 1 2026 — designed for **Ubuntu / Linux**.  
> Works alongside **[MultiViewer for F1](https://multiviewer.app)** via its local GraphQL API.

---

## What's new in the 2026 Edition

### 2026 F1 Regulation changes reflected
| Area | Change |
|------|--------|
| **Power unit** | No MGU-H; simplified hybrid unit (ICE + MGU-K only) |
| **Aerodynamics** | Active aero — cars actively adjust front/rear wing elements |
| **Teams** | **Audi** replaces Kick Sauber; full 2026 driver roster loaded |
| **Drivers** | Hamilton → Ferrari; Sainz → Williams; Antonelli → Mercedes; Bortoleto → Audi; Hadjar, Doohan, Bearman as rookies |

### Linux / Ubuntu improvements
- **`launchMVF1()`** now uses `shell.openExternal()` — works on all platforms including Linux (no more "not supported" alert)
- **Wayland + X11** launch modes via dedicated scripts
- Automatic transparency detection guidance on first run
- Direct GraphQL client module (`src/api/f1mv-client.js`) that queries the local F1MV API at `http://localhost:10101/api/graphql` without relying on OS-specific port discovery

---

## Requirements

| Dependency | Minimum version | Notes |
|------------|----------------|-------|
| Ubuntu / Debian Linux | 22.04 LTS+ | Also works on Fedora, Arch etc. |
| Node.js | 18 LTS | v20/v22 recommended |
| MultiViewer for F1 | latest | Must be running; exposes GraphQL API on port **10101** |
| Compositing manager | any | Required for transparent overlay windows (GNOME + Mutter, KDE + KWin, Picom on i3/sway etc.) |

---

## Quick start

### 1 — Install

```bash
cd UF1-Viewer-Ubuntu-2026
chmod +x install-ubuntu.sh
./install-ubuntu.sh          # installs apt deps, Node.js, npm packages, .desktop entry
```

### 2 — Run

```bash
npm start                    # auto-detects X11 / Wayland
# or
./run-ubuntu.sh              # smart launcher (detects session type and sets Electron flags)
./run-ubuntu.sh --wayland    # force Wayland mode
./run-ubuntu.sh --x11        # force X11 mode
./run-ubuntu.sh --debug      # open DevTools and enable verbose logging
```

### 3 — Connect
1. Start **MultiViewer for F1** (must be reachable at `http://localhost:10101`)
2. Open UF1 Viewer — it will auto-connect via the GraphQL API
3. Set the **Host** in Settings if MultiViewer is running on a different machine

---

## Build distributable packages

```bash
npm run dist:appimage    # → out/UF1-Viewer-2026-x86_64.AppImage
npm run dist:deb         # → out/uf1-viewer-ubuntu-2026_2.0.0_amd64.deb
npm run dist             # → all Linux targets (AppImage + deb + rpm)
```

---

## Transparent window troubleshooting

### GNOME (X11)
Transparency works out-of-the-box with Mutter compositing.

### GNOME (Wayland)
```bash
./run-ubuntu.sh --wayland
```

### i3 / sway / tiling WMs
Install a compositor:
```bash
# X11
sudo apt install picom
picom &

# Wayland / sway
# Sway has built-in compositing — just use --wayland flag
```

### All windows appear white / opaque
```bash
ELECTRON_ENABLE_LOGGING=1 ./run-ubuntu.sh --debug
# Look for "ERR" lines related to transparency / EGL
```

---

## 2026 Driver Lineup

| # | Driver | Team |
|---|--------|------|
| 1 | Max Verstappen | Red Bull Racing |
| 4 | Lando Norris | McLaren |
| 5 | Gabriel Bortoleto 🆕 | Audi |
| 6 | Isack Hadjar 🆕 | Racing Bulls |
| 10 | Pierre Gasly | Alpine |
| 12 | Andrea Kimi Antonelli 🆕 | Mercedes |
| 14 | Fernando Alonso | Aston Martin |
| 16 | Charles Leclerc | Ferrari |
| 18 | Lance Stroll | Aston Martin |
| 22 | Yuki Tsunoda | Racing Bulls |
| 23 | Alexander Albon | Williams |
| 27 | Nico Hülkenberg | Audi |
| 30 | Liam Lawson | Red Bull Racing |
| 31 | Esteban Ocon | Haas |
| 44 | Lewis Hamilton 🔄 | Ferrari |
| 55 | Carlos Sainz 🔄 | Williams |
| 61 | Jack Doohan 🆕 | Alpine |
| 63 | George Russell | Mercedes |
| 81 | Oscar Piastri | McLaren |
| 87 | Oliver Bearman 🆕 | Haas |

🆕 = rookie / new seat in 2026 · 🔄 = moved team

---

## API reference

The local GraphQL API at `http://localhost:10101/api/graphql` is used directly.  
You can also query it with curl for debugging:

```bash
# Get current timing data
curl -s -X POST http://localhost:10101/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ f1LiveTimingState { TimingData DriverList SessionInfo TrackStatus } }"}' \
  | python3 -m json.tool | less

# Get app version
curl -s -X POST http://localhost:10101/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ version }"}' | python3 -m json.tool
```

The client module at [`src/api/f1mv-client.js`](src/api/f1mv-client.js) exposes:

| Export | Description |
|--------|-------------|
| `getLiveTimingState(topics)` | Fetch one or more live timing topics |
| `getLiveTimingClock()` | Session clock / countdown |
| `getAllPlayers()` | All open MultiViewer windows |
| `createPlayer(opts)` | Open a new player window |
| `getVersion()` | MultiViewer app version |
| `discoverPort(host)` | Auto-detect MultiViewer port |
| `DRIVERS_2026` | Full 2026 driver roster object |
| `TEAM_COLORS_2026` | Official 2026 team hex colours |

---

## Credits
- **Original UF1 Viewer** — MRAJEKO  
- **Live Timing** — JustJoostNL  
- **npm_f1mv_api** — LapsTimeOff  
- **MultiViewer for F1** — multiviewer.app team  
- **Ubuntu / Linux edition** — adapted 2026
