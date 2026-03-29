/**
 * Session Insights Widget
 * Computes live "weetjes", pace analysis, tire strategy hints,
 * gap trends, weather impact, and pit window predictions from
 * the F1MV live timing API.
 */

const { ipcRenderer } = require("electron");
const f1mvApi = require("npm_f1mv_api");

let config = {};
let driverList = {};
let prevTimingData = null;
let prevGaps = {};
let prevWeather = null;
let shownInsights = new Set();
let insightId = 0;

// ── Tire / Pit window tracking ────────────────────────────────────────────────
// Lap counts at which a pit window OPENS per compound (tire age in laps)
const PIT_WINDOW_OPEN  = { SOFT: 14, MEDIUM: 24, HARD: 33, INTERMEDIATE: 10, WET: 8 };
// Expected maximum stint length per compound (beyond this = overdue)
const PIT_EXPECTED_MAX = { SOFT: 20, MEDIUM: 32, HARD: 44, INTERMEDIATE: 18, WET: 14 };
const COMPOUND_COLOR   = { SOFT: "#E8002D", MEDIUM: "#FFF200", HARD: "#FFFFFF", INTERMEDIATE: "#39B54A", WET: "#0067FF" };

let driverStintData   = {};  // { num: { stintCount, compound, currentAge } }
let driverPitEnterAt  = {};  // { num: timestamp when InPit became true }
let prevInPit         = {};  // { num: bool }
let pitWindowAlerted  = new Set();  // "${num}-${compound}"
let pitOverdueAlerted = new Set();  // "${num}-${compound}-${band}"
let prevSectorBests   = {};  // { num: { 0: position, 1: position, 2: position } }
let prevLappedState   = {};  // { num: bool } — whether driver was already lapped
let prevRetiredState  = {};  // { num: bool } — whether driver was already retired

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Helpers ──

function driverTag(num) {
    const d = driverList[String(num)];
    if (!d) return `#${num}`;
    return d.Tla || d.BroadcastName || `#${num}`;
}

function driverTeamColor(num) {
    const d = driverList[String(num)];
    return d?.TeamColour ? `#${d.TeamColour}` : "#fff";
}

function formatGap(seconds) {
    if (seconds == null) return "-";
    const abs = Math.abs(seconds);
    if (abs >= 60) {
        const m = Math.floor(abs / 60);
        const s = (abs % 60).toFixed(1);
        return `${seconds < 0 ? "-" : "+"}${m}:${s.padStart(4, "0")}`;
    }
    return `${seconds < 0 ? "-" : "+"}${abs.toFixed(3)}s`;
}

function timeToSeconds(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split(":");
    if (parts.length === 3) return +parts[0] * 3600 + +parts[1] * 60 + parseFloat(parts[2]);
    if (parts.length === 2) return +parts[0] * 60 + parseFloat(parts[1]);
    return parseFloat(parts[0]);
}

function nowTimeString() {
    const d = new Date();
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── UI ──

function addInsight(category, label, text) {
    const key = `${category}:${label}:${text}`;
    if (shownInsights.has(key)) return false;
    shownInsights.add(key);

    document.getElementById("empty-state").style.display = "none";
    const container = document.getElementById("cards");

    const card = document.createElement("div");
    card.className = `card ${category}`;
    card.innerHTML = `
        <span class="card-label">${label}</span>
        <span class="card-text">${text}</span>
        <span class="card-time">${nowTimeString()}</span>`;
    container.prepend(card);

    // Keep max 40 cards
    while (container.children.length > 40) container.removeChild(container.lastChild);
    return true;
}

function compoundBadge(c) {
    const col = COMPOUND_COLOR[c] || "#888";
    return `<span style="color:${col};font-weight:700">${c || "?"}</span>`;
}

// ── Sounds (Web Audio API synthesis) ───────────────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
}

function playPitPling() {
    try {
        const ctx = getAudioCtx();
        [[660, 0], [880, 0.13]].forEach(([freq, offset]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.value = freq;
            const t = ctx.currentTime + offset;
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.start(t); osc.stop(t + 0.35);
        });
    } catch (e) { /* audio unavailable */ }
}

function playFastestLapSound() {
    try {
        const ctx = getAudioCtx();
        [[880, 0], [1100, 0.13], [1320, 0.26]].forEach(([freq, offset]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = "triangle";
            osc.frequency.value = freq;
            const t = ctx.currentTime + offset;
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
            osc.start(t); osc.stop(t + 0.28);
        });
    } catch (e) { /* audio unavailable */ }
}

function playRetireSound() {
    try {
        const ctx = getAudioCtx();
        [[440, 0], [330, 0.22]].forEach(([freq, offset]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.value = freq;
            const t = ctx.currentTime + offset;
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            osc.start(t); osc.stop(t + 0.45);
        });
    } catch (e) { /* audio unavailable */ }
}

// ── Connection ──

async function getConfigurations() {
    const store = await ipcRenderer.invoke("get_store");
    const host = store.config.network.host;
    const port = (await f1mvApi.discoverF1MVInstances(host))?.port;
    config = { host, port };
}

// ── Analysis functions ──

function analyzeGapTrends(timingData) {
    if (!timingData?.Lines) return;
    const lines = timingData.Lines;

    for (const [num, data] of Object.entries(lines)) {
        const gapStr = data.GapToLeader;
        if (!gapStr || gapStr === "") continue;

        // Detect lapped cars (gap string contains "L")
        const isLapped = /\dL/i.test(gapStr) || gapStr.includes(" L");
        if (isLapped) {
            if (!prevLappedState[num]) {
                addInsight("position", "LAPPED",
                    `<strong>${driverTag(num)}</strong> has been lapped`);
            }
            prevLappedState[num] = true;
            continue; // skip numeric gap delta for lapped cars
        }
        prevLappedState[num] = false;

        const gap = parseFloat(gapStr);
        if (isNaN(gap)) continue;

        if (prevGaps[num] !== undefined) {
            const delta = gap - prevGaps[num];
            // Significant closing or pulling away (over 1s change in one update)
            if (delta < -1.0) {
                addInsight("gap", "GAP CLOSING",
                    `<strong>${driverTag(num)}</strong> closed <strong>${Math.abs(delta).toFixed(1)}s</strong> to the leader`);
            } else if (delta > 2.0) {
                addInsight("gap", "FALLING BACK",
                    `<strong>${driverTag(num)}</strong> lost <strong>${delta.toFixed(1)}s</strong> to the leader`);
            }
        }
        prevGaps[num] = gap;
    }
}

function analyzeRetirements(timingData) {
    if (!timingData?.Lines) return;
    for (const [num, data] of Object.entries(timingData.Lines)) {
        const isRetired = data.Retired === true;
        if (isRetired && !prevRetiredState[num]) {
            addInsight("position", "RETIRED",
                `<strong>${driverTag(num)}</strong> has retired from the race`);
            playRetireSound();
        }
        prevRetiredState[num] = isRetired;
    }
}

function analyzePace(timingData, timingStats) {
    if (!timingData?.Lines) return;

    const lines = timingData.Lines;
    const bestLaps = [];

    for (const [num, data] of Object.entries(lines)) {
        const lastLap = data.LastLapTime?.Value;
        if (!lastLap) continue;
        const secs = timeToSeconds(lastLap);
        if (secs && secs > 10) { // sanity check
            bestLaps.push({ num, time: lastLap, secs });
        }
    }

    if (bestLaps.length < 2) return;
    bestLaps.sort((a, b) => a.secs - b.secs);

    // Detect personal best or session best
    if (timingStats?.Lines) {
        for (const [num, stats] of Object.entries(timingStats.Lines)) {
            const pb = stats.PersonalBestLapTime;
            if (pb?.Value && pb?.Position === 1) {
                // Session fastest lap
                if (addInsight("pace", "FASTEST LAP",
                    `<strong>${driverTag(num)}</strong> set the fastest lap: <strong>${pb.Value}</strong>`)) {
                    playFastestLapSound();
                }
            }
        }
    }

    // Detect if someone in lower positions has top-3 pace
    for (const lap of bestLaps.slice(0, 3)) {
        const pos = lines[lap.num]?.Position;
        if (pos && parseInt(pos) > 10) {
            addInsight("pace", "HIDDEN PACE",
                `<strong>${driverTag(lap.num)}</strong> (P${pos}) logged <strong>${lap.time}</strong> — top-3 pace from outside the top 10`);
        }
    }
}

// Track when a driver enters the pit lane (for timing pit stop duration)
function analyzePitEntry(timingData) {
    if (!timingData?.Lines) return;
    for (const [num, data] of Object.entries(timingData.Lines)) {
        const curInPit = data.InPit === true;
        if (prevInPit[num] !== undefined && !prevInPit[num] && curInPit) {
            driverPitEnterAt[num] = Date.now();
        }
        prevInPit[num] = curInPit;
    }
}

function analyzeTiresAndPits(timingAppData, timingData) {
    if (!timingAppData?.Lines || !timingData?.Lines) return;

    for (const [num, appData] of Object.entries(timingAppData.Lines)) {
        const stints = appData.Stints;
        if (!stints) continue;

        const stintKeys = Object.keys(stints).sort((a, b) => +a - +b);
        if (stintKeys.length === 0) continue;

        const stintCount   = stintKeys.length;
        const currentStint = stints[stintKeys[stintKeys.length - 1]];
        if (!currentStint) continue;

        const compound  = (currentStint.Compound || "UNKNOWN").toUpperCase();
        const tireAge   = parseInt(currentStint.TotalLaps || 0);
        const tdLine    = timingData.Lines[num] || {};
        const isRetired = tdLine.Retired === true || tdLine.KnockedOut === true;
        const pos       = tdLine.Position || "?";

        const prev = driverStintData[num];

        if (prev) {
            if (stintCount > prev.stintCount) {
                // ── Pit stop detected ───────────────────────────────────────────
                const prevAge      = prev.currentAge;
                const prevCompound = prev.compound;
                const expected     = PIT_EXPECTED_MAX[prevCompound] ?? 0;
                const delta        = prevAge - expected;
                const deltaStr     = delta === 0
                    ? "exactly as expected"
                    : delta > 0
                        ? `<strong>+${delta}</strong> laps over expected`
                        : `<strong>${Math.abs(delta)}</strong> laps early`;

                let pitDurStr = "";
                if (driverPitEnterAt[num]) {
                    const durSec = Math.round((Date.now() - driverPitEnterAt[num]) / 1000);
                    if (durSec > 1 && durSec < 120) {
                        pitDurStr = ` — pit: <strong>${durSec}s</strong>`;
                    }
                    delete driverPitEnterAt[num];
                }

                addInsight("tires", "PIT STOP",
                    `<strong>${driverTag(num)}</strong> (P${pos}) ${compoundBadge(prevCompound)} → ${compoundBadge(compound)} · <strong>${prevAge} laps</strong> · ${deltaStr}${pitDurStr}`);
                playPitPling();

                // Reset window alerts so new stint gets fresh tracking
                pitWindowAlerted.delete(`${num}-${compound}`);
                for (const key of [...pitOverdueAlerted]) {
                    if (key.startsWith(`${num}-${compound}-`)) pitOverdueAlerted.delete(key);
                }

            } else if (compound === prev.compound && !isRetired) {
                // ── Same stint — check pit window ────────────────────────────────
                const windowOpen  = PIT_WINDOW_OPEN[compound];
                const expectedMax = PIT_EXPECTED_MAX[compound] ?? 0;

                if (windowOpen && tireAge >= windowOpen && !pitWindowAlerted.has(`${num}-${compound}`)) {
                    pitWindowAlerted.add(`${num}-${compound}`);
                    addInsight("pit", "PIT WINDOW OPEN",
                        `<strong>${driverTag(num)}</strong> (P${pos}) ${compoundBadge(compound)} — <strong>${tireAge} laps</strong>, pit window now open`);
                }

                if (expectedMax && tireAge > expectedMax) {
                    const band = Math.floor((tireAge - expectedMax) / 5);
                    const key  = `${num}-${compound}-${band}`;
                    if (!pitOverdueAlerted.has(key)) {
                        pitOverdueAlerted.add(key);
                        addInsight("pit", "PIT OVERDUE",
                            `<strong>${driverTag(num)}</strong> (P${pos}) ${compoundBadge(compound)} — <strong>${tireAge} laps</strong>, <strong>${tireAge - expectedMax}</strong> over expected window`);
                    }
                }
            }
        }

        driverStintData[num] = { stintCount, compound, currentAge: tireAge };
    }
}

function analyzeSectors(timingStats) {
    if (!timingStats?.Lines) return;
    for (const [num, stats] of Object.entries(timingStats.Lines)) {
        const sectors = stats.BestSectors;
        if (!Array.isArray(sectors)) continue;
        for (let i = 0; i < sectors.length; i++) {
            const sec = sectors[i];
            if (!sec?.Value) continue;
            const secPos = parseInt(sec.Position);
            if (secPos === 1 && prevSectorBests[num]?.[i] !== 1) {
                addInsight("pace", `FASTEST S${i + 1}`,
                    `<strong>${driverTag(num)}</strong> sets fastest sector ${i + 1}: <strong>${sec.Value}</strong>`);
            }
            if (!prevSectorBests[num]) prevSectorBests[num] = {};
            prevSectorBests[num][i] = secPos;
        }
    }
}

function analyzeWeather(weatherData) {
    if (!weatherData) return;

    const rain = weatherData.Rainfall === "1" || weatherData.Rainfall === true;
    const trackTemp = parseFloat(weatherData.TrackTemp);
    const airTemp = parseFloat(weatherData.AirTemp);
    const humidity = parseFloat(weatherData.Humidity);
    const wind = parseFloat(weatherData.WindSpeed);

    if (prevWeather) {
        // Rain state change
        const wasRaining = prevWeather.Rainfall === "1" || prevWeather.Rainfall === true;
        if (rain && !wasRaining) {
            addInsight("weather", "RAIN DETECTED",
                `Rainfall has started — track conditions changing. Track: <strong>${trackTemp}°C</strong>, Air: <strong>${airTemp}°C</strong>`);
        } else if (!rain && wasRaining) {
            addInsight("weather", "RAIN STOPPED",
                `Rainfall has stopped — track drying. Humidity: <strong>${humidity}%</strong>`);
        }

        // Significant temperature change
        const prevTrack = parseFloat(prevWeather.TrackTemp);
        if (!isNaN(prevTrack) && !isNaN(trackTemp)) {
            const tempDelta = trackTemp - prevTrack;
            if (Math.abs(tempDelta) >= 3) {
                addInsight("weather", "TRACK TEMP",
                    `Track temperature ${tempDelta > 0 ? "rose" : "dropped"} <strong>${Math.abs(tempDelta).toFixed(1)}°C</strong> to <strong>${trackTemp}°C</strong> — tire behavior affected`);
            }
        }

        // High wind
        if (wind >= 30) {
            addInsight("weather", "HIGH WIND",
                `Wind speed at <strong>${wind} km/h</strong> — may affect aero performance in high-speed corners`);
        }
    }

    prevWeather = { ...weatherData };
}

function analyzePositionChanges(timingData) {
    if (!prevTimingData?.Lines || !timingData?.Lines) return;

    for (const [num, data] of Object.entries(timingData.Lines)) {
        const currentPos = parseInt(data.Position);
        const prevPos = parseInt(prevTimingData.Lines[num]?.Position);
        if (isNaN(currentPos) || isNaN(prevPos)) continue;

        const change = prevPos - currentPos;
        if (change >= 3) {
            addInsight("position", "POSITION GAIN",
                `<strong>${driverTag(num)}</strong> gained <strong>${change} positions</strong> — now P${currentPos}`);
        } else if (change <= -3) {
            addInsight("position", "POSITION LOSS",
                `<strong>${driverTag(num)}</strong> dropped <strong>${Math.abs(change)} positions</strong> — now P${currentPos}`);
        }
    }
}

function analyzeRaceMilestones(lapCount) {
    if (!lapCount?.TotalLaps) return;
    const totalLaps  = parseInt(lapCount.TotalLaps);
    const currentLap = parseInt(lapCount.CurrentLap);
    if (isNaN(totalLaps) || isNaN(currentLap) || totalLaps === 0) return;

    if (currentLap === Math.floor(totalLaps / 2)) {
        addInsight("pace", "HALF DISTANCE",
            `Race at half distance — lap <strong>${currentLap}</strong> of <strong>${totalLaps}</strong>`);
    }

    if (totalLaps - currentLap === 10) {
        addInsight("pace", "FINAL LAPS",
            `<strong>10 laps remaining</strong> in the race`);
    }
}

function analyzeDRS(sessionInfo, timingData) {
    // With 2026 rules Active Aero replaces DRS —
    // just flag when session goes active
    if (!sessionInfo) return;
}

function analyzeSessionStatus(sessionData, sessionStatus) {
    if (!sessionStatus) return;

    if (sessionStatus === "Aborted") {
        addInsight("position", "RED FLAG", "Session has been <strong>red-flagged</strong>");
    }
}

// ── Main loop ──

async function run() {
    await getConfigurations();

    // Set session name
    try {
        const info = await f1mvApi.LiveTimingAPIGraphQL(config, "SessionInfo");
        const si = info.SessionInfo;
        if (si) {
            const name = si.Meeting?.Name || "";
            const session = si.Name || "";
            document.getElementById("session-name").textContent = `${name} — ${session}`;
        }
    } catch (e) {
        console.log("Session info not yet available");
    }

    async function tick() {
        try {
            const api = await f1mvApi.LiveTimingAPIGraphQL(config, [
                "DriverList",
                "ExtrapolatedClock",
                "LapCount",
                "RaceControlMessages",
                "SessionData",
                "SessionInfo",
                "SessionStatus",
                "TimingAppData",
                "TimingData",
                "TimingStats",
                "WeatherData",
            ]);

            driverList = api.DriverList || driverList;

            // Run all analyses
            analyzeGapTrends(api.TimingData);
            analyzeRetirements(api.TimingData);
            analyzePace(api.TimingData, api.TimingStats);
            analyzePitEntry(api.TimingData);
            analyzeTiresAndPits(api.TimingAppData, api.TimingData);
            analyzeSectors(api.TimingStats);
            analyzeWeather(api.WeatherData);
            analyzePositionChanges(api.TimingData);
            analyzeRaceMilestones(api.LapCount);
            analyzeSessionStatus(api.SessionData, api.SessionStatus?.Status);

            // Store previous state for delta detection
            prevTimingData = api.TimingData ? JSON.parse(JSON.stringify(api.TimingData)) : prevTimingData;
        } catch (e) {
            console.log("Insights tick error:", e.message);
        }
    }

    await tick();
    setInterval(tick, 5000);
}

run();
