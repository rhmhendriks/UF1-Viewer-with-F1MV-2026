/**
 * UF1 Viewer – Direct F1MV GraphQL Client (Ubuntu 2026 Edition)
 *
 * Thin wrapper around the MultiViewer for F1 GraphQL API at
 * http://<host>:<port>/api/graphql
 *
 * All driver names, numbers, team names and team colours come from the
 * live DriverList topic — nothing is hardcoded here.
 *
 * 2026 notes:
 *   - DRS (telemetry channel 6) is replaced by Active Aero and is no
 *     longer broadcast in CarData.  Active channels: 0=RPM, 2=Speed,
 *     3=Gear, 4=Throttle, 5=Brake.
 *   - Cadillac is the 11th constructor alongside the 10 legacy teams.
 *   - The API exposes TeamColour per driver in DriverList — use it.
 */

"use strict";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 10101;

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

/**
 * POST a GraphQL query to the F1MV API.
 * @param {string} query
 * @param {string} [host]
 * @param {number} [port]
 * @returns {Promise<object>} parsed response data
 */
async function gqlQuery(query, host = DEFAULT_HOST, port = DEFAULT_PORT) {
    const url = `http://${host}:${port}/api/graphql`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`GraphQL ${res.status}: ${res.statusText}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map((e) => e.message).join(", "));
    return json.data;
}

// ---------------------------------------------------------------------------
// Live timing helpers
// ---------------------------------------------------------------------------

/**
 * Fetch one or more F1LiveTimingState topics.
 * @param {string|string[]} topics  e.g. "TimingData" or ["TimingData","DriverList"]
 */
async function getLiveTimingState(topics, host = DEFAULT_HOST, port = DEFAULT_PORT) {
    const fields = (Array.isArray(topics) ? topics : [topics]).join("\n        ");
    const data = await gqlQuery(`{ f1LiveTimingState { ${fields} } }`, host, port);
    return data.f1LiveTimingState ?? {};
}

/**
 * Fetch the live DriverList.
 * Each entry: RacingNumber, Tla, FullName, BroadcastName,
 * TeamName, TeamColour (hex without #), HeadshotUrl, Line, Reference.
 * @returns {Promise<object>} keyed by racing number string
 */
async function getDriverList(host = DEFAULT_HOST, port = DEFAULT_PORT) {
    const state = await getLiveTimingState("DriverList", host, port);
    return state.DriverList ?? {};
}

/**
 * Extract { teamName -> "#RRGGBB" } from a DriverList object.
 * Uses live TeamColour from the API — no hardcoded values.
 * @param {object} driverList  result of getDriverList()
 */
function teamColorsFromDriverList(driverList) {
    const colors = {};
    for (const d of Object.values(driverList)) {
        if (d.TeamName && d.TeamColour) {
            colors[d.TeamName] = `#${d.TeamColour}`;
        }
    }
    return colors;
}

/**
 * Get "#RRGGBB" for a driver number from a DriverList object.
 * Falls back to "#ffffff" if not found.
 */
function driverColor(driverNumber, driverList) {
    const d = driverList[String(driverNumber)];
    return d?.TeamColour ? `#${d.TeamColour}` : "#ffffff";
}

/**
 * Fetch the live session clock.
 */
async function getLiveTimingClock(host = DEFAULT_HOST, port = DEFAULT_PORT) {
    const data = await gqlQuery(
        `{ f1LiveTimingClock { systemTime trackTime trackTimeUtc liveTimingStartTime paused } }`,
        host,
        port
    );
    return data.f1LiveTimingClock ?? {};
}

// ---------------------------------------------------------------------------
// Player / window management
// ---------------------------------------------------------------------------

/** Get all open MultiViewer player windows. */
async function getAllPlayers(host = DEFAULT_HOST, port = DEFAULT_PORT) {
    const data = await gqlQuery(
        `{ players {
            id playerType
            driverData { driverNumber teamName driverName }
            streamData { title contentId }
            state { bounds { x y width height } alwaysOnTop }
        } }`,
        host, port
    );
    return data.players ?? [];
}

/**
 * Create a new player window.
 * @param {{ contentId, driverNumber?, title?, bounds?, alwaysOnTop? }} opts
 */
async function createPlayer(
    { contentId, driverNumber = null, title = "", bounds = null, alwaysOnTop = true },
    host = DEFAULT_HOST,
    port = DEFAULT_PORT
) {
    const boundsInput = bounds
        ? `bounds: { x: ${bounds.x}, y: ${bounds.y}, width: ${bounds.width}, height: ${bounds.height} }`
        : "";
    const data = await gqlQuery(
        `mutation {
            createPlayer(input: {
                contentId: "${contentId}"
                ${driverNumber !== null ? `driverNumber: ${driverNumber}` : ""}
                ${title ? `title: "${title.replace(/"/g, '\\"')}"` : ""}
                ${boundsInput}
                alwaysOnTop: ${alwaysOnTop}
            }) { id }
        }`,
        host, port
    );
    return data.createPlayer ?? {};
}

// ---------------------------------------------------------------------------
// System / port discovery
// ---------------------------------------------------------------------------

/** Return the MultiViewer version string, or null if not reachable. */
async function getVersion(host = DEFAULT_HOST, port = DEFAULT_PORT) {
    try {
        const data = await gqlQuery("{ version }", host, port);
        return data.version ?? null;
    } catch {
        return null;
    }
}

/**
 * Discover the F1MV port.
 * Tries 10101 first (MultiViewer for Linux default), then falls back to
 * npm_f1mv_api auto-discovery.
 * @returns {Promise<number|null>}
 */
async function discoverPort(host = DEFAULT_HOST) {
    if (await getVersion(host, DEFAULT_PORT)) return DEFAULT_PORT;
    try {
        const f1mvApi = require("npm_f1mv_api");
        const result = await f1mvApi.discoverF1MVInstances(host);
        return result?.port ?? null;
    } catch {
        return null;
    }
}

module.exports = {
    gqlQuery,
    getLiveTimingState,
    getDriverList,
    teamColorsFromDriverList,
    driverColor,
    getLiveTimingClock,
    getAllPlayers,
    createPlayer,
    getVersion,
    discoverPort,
    DEFAULT_HOST,
    DEFAULT_PORT,
};
