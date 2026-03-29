# UF1 Viewer — 2026 Season Edition

> **PRIVATE HOBBY PROJECT** — This is maintained in my spare time, purely for fun
> and to enhance my own F1 race-watching experience. There is **no fixed timeline,
> no release schedule, and no support SLA**. Issues and PRs are welcome but may
> take a while (or may never) be addressed. If you need a stable, actively-maintained
> viewer, use the original upstream project linked below.


---

> **⚠ FORK WARNING**
>
> This repository is a **personal fork** of
> [MRAJEKO/UF1-Viewer-with-F1MV](https://github.com/MRAJEKO/UF1-Viewer-with-F1MV)
> (the original Ultimate F1 Viewer). The upstream project, all original features,
> and the core architecture are the work of **MRAJEKO** and contributors.
> This fork adds cross-platform support and personal customisations on top of that
> foundation. Credit for the original app goes entirely to the upstream authors.
>
> If you are looking for the official project, go to the original repo above.

---

## What's new in the 2026 Update (this fork)

Changes added on top of the upstream project:

### Sound & Audio Overhaul
- Flag change sound alerts (yellow, red, safety car, VSC) with adjustable volume
- Race start / lights-out audio cue
- Active Aero state change chime
- Pit lane open/close notification sound
- All sounds can be individually toggled and volume-adjusted in Settings

### UI Overhaul
- Redesigned main hub — cleaner layout, reduced visual noise
- F1 2026 design language: updated typography, refreshed colour palette matching 2026 team liveries
- Dark-mode-first across all overlay windows
- Compact mode for smaller screens / second monitor use
- Improved session timer display with lap counter integration

### Session Insights (new window)
- Real-time stint tracker: tyre age, compound, expected pit window per driver
- Position delta chart: gain/loss over the last 5 laps per driver
- Fastest lap history graph (session-wide)
- Crash / incident timeline with timestamps
- Export current session snapshot as JSON for later review

### 2026 F1 Regulation Changes Reflected
| Area | Change |
|------|--------|
| **Power unit** | No MGU-H; simplified hybrid (ICE + MGU-K only) |
| **Aerodynamics** | Active aero — front/rear wing adjust per corner |
| **Teams** | Audi replaces Kick Sauber; Cadillac as 11th constructor |
| **Drivers** | Hamilton → Ferrari; Sainz → Williams; Antonelli → Mercedes; Bortoleto → Audi |

### Cross-platform Support
- macOS installer + launcher scripts (`install-mac.sh`, `run-mac.sh`)
- `electron-builder.yml` extended with macOS (`.dmg`) and Windows (`.exe`) targets
- Linux (`.deb`, `.AppImage`) targets kept and updated

---

## Requirements

| Dependency | Minimum | Notes |
|---|---|---|
| macOS | 12 Monterey+ | Apple Silicon (arm64) and Intel (x86_64) |
| Windows | 10 / 11 | x64 and arm64 |
| Ubuntu / Debian | 22.04 LTS+ | Also Fedora, Arch, etc. |
| Node.js | 18 LTS | v20 / v22 recommended |
| MultiViewer for F1 | latest | Must be running; GraphQL on port **10101** |

---

## Quick start (from source)

### macOS

```bash
chmod +x install-mac.sh
./install-mac.sh       # installs Homebrew (if needed), Node.js, npm deps, shell alias

./run-mac.sh           # start the app
./run-mac.sh --debug   # open DevTools + verbose logging
```

### Linux (Ubuntu / Debian)

```bash
chmod +x install-ubuntu.sh
./install-ubuntu.sh    # installs apt deps, Node.js, npm deps, .desktop launcher

./run-ubuntu.sh              # smart launcher (auto-detects Wayland / X11)
./run-ubuntu.sh --wayland    # force Wayland
./run-ubuntu.sh --x11        # force X11
./run-ubuntu.sh --debug      # DevTools + verbose logging
```

### Windows

```powershell
# Install Node.js 20 LTS from https://nodejs.org
npm install
npm start
```

### All platforms — npm scripts

```bash
npm start             # run from source (requires Node.js + npm install)
npm run start:debug   # run with DevTools
```

---

## Building installers

### macOS → `.dmg`

```bash
npm run dist:dmg      # → out/UF1-Viewer-2026-*.dmg (x64 + arm64 universal)
npm run dist:mac      # → dmg + zip
```

> **Gatekeeper note**: for personal / local use, signing is not required.
> For distributing outside your own machines you need an Apple Developer account,
> codesigning, and notarization. See
> [Apple's notarization docs](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

### Windows → `.exe` (NSIS installer)

```bash
npm run dist:exe      # → out/UF1-Viewer-2026-Setup-*.exe
npm run dist:win      # → NSIS installer + portable exe
```

> **Cross-compiling**: building a `.exe` on macOS/Linux requires
> [Wine](https://www.winehq.org). On a Windows machine no extra tools are needed.

### Linux → `.deb` / `.AppImage`

```bash
npm run dist:deb         # → out/*.deb  (amd64 + arm64)
npm run dist:appimage    # → out/*.AppImage  (x86_64 + arm64)
npm run dist             # → all Linux targets
```

### All platforms at once

```bash
npm run dist:all    # builds mac + win + linux in one command (best on CI)
```

> **Note**: cross-platform builds work best on a CI/CD environment where each
> target OS is natively available. macOS `.dmg` can only be built on macOS;
> Windows `.exe` with NSIS can be built on Linux/macOS with Wine installed.

---

## Connect to MultiViewer

1. Start **MultiViewer for F1** — must be reachable at `http://localhost:10101`
2. Open UF1 Viewer — auto-connects via the GraphQL API on startup
3. In Settings, change **Host** if MultiViewer runs on a different machine

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

🆕 = rookie / new seat · 🔄 = moved team

---

## Transparent window troubleshooting

### macOS
Transparency works natively via Core Animation — no setup needed.

### Linux (GNOME / Wayland)
```bash
./run-ubuntu.sh --wayland
```

### Linux (i3 / tiling WMs / X11)
```bash
sudo apt install picom && picom &
# then: ./run-ubuntu.sh --x11
```

### All windows appear white / opaque
```bash
ELECTRON_ENABLE_LOGGING=1 ./run-ubuntu.sh --debug
# check output for EGL / transparency errors
```

---

## API reference

Queries the MultiViewer GraphQL API at `http://localhost:10101/api/graphql`.

```bash
# Current timing data
curl -s -X POST http://localhost:10101/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ f1LiveTimingState { TimingData DriverList SessionInfo } }"}' \
  | python3 -m json.tool

# App version
curl -s -X POST http://localhost:10101/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ version }"}' | python3 -m json.tool
```

Client module: [`src/api/f1mv-client.js`](src/api/f1mv-client.js)

---

## Credits

- **Original UF1 Viewer** — [MRAJEKO](https://github.com/MRAJEKO/UF1-Viewer-with-F1MV)
- **Live Timing** — JustJoostNL
- **npm_f1mv_api** — LapsTimeOff
- **MultiViewer for F1** — [multiviewer.app](https://multiviewer.app) team
- **2026 fork / cross-platform / session insights** — rhmhendriks

---

## License

MIT — inherited from the upstream project. All additions in this fork are also MIT.
