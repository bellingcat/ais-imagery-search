import { DEFAULTS } from "./config.js";
import { parseAisCsv } from "./csvParser.js";
import { buildQueryTrack, chunkToLineString, splitPointsByDays } from "./track.js";
import { searchStacByChunks } from "./stacClient.js";
import { shortlistFeatures } from "./shortlist.js";
import { createMap, renderMapData } from "./mapView.js";
import { downloadCsv, downloadJson } from "./exporters.js";
import { assert, splitCsvList, toFiniteNumber } from "./utils.js";

const state = {
    shortlist: [],
    points: [],
    chunks: [],
    candidates: []
};

const form = document.getElementById("controlsForm");
const runBtn = document.getElementById("runBtn");
const jsonBtn = document.getElementById("jsonBtn");
const csvBtn = document.getElementById("csvBtn");
const statusLine = document.getElementById("statusLine");
const progressLine = document.getElementById("progressLine");

const metricPoints = document.getElementById("metricPoints");
const metricChunks = document.getElementById("metricChunks");
const metricCandidates = document.getElementById("metricCandidates");
const metricShortlist = document.getElementById("metricShortlist");

const map = createMap("map");

function setStatus(text) {
    statusLine.textContent = text;
}

function setProgress(text) {
    progressLine.textContent = text;
}

function setRunning(running) {
    runBtn.disabled = running;
}

function refreshMetrics() {
    metricPoints.textContent = String(state.points.length);
    metricChunks.textContent = String(state.chunks.length);
    metricCandidates.textContent = String(state.candidates.length);
    metricShortlist.textContent = String(state.shortlist.length);
}

function readSettings() {
    const file = document.getElementById("csvFile").files?.[0];
    assert(file, "Please select a CSV file.");

    const collections = splitCsvList(document.getElementById("collections").value);
    assert(collections.length > 0, "At least one collection is required.");

    const settings = {
        file,
        lonColumn: document.getElementById("lonColumn").value.trim() || DEFAULTS.lonColumn,
        latColumn: document.getElementById("latColumn").value.trim() || DEFAULTS.latColumn,
        timeColumn: document.getElementById("timeColumn").value.trim() || DEFAULTS.timeColumn,
        collections,
        stacUrl: document.getElementById("stacUrl").value.trim() || DEFAULTS.stacUrl,
        temporalBufferMinutes: toFiniteNumber(
            document.getElementById("temporalBufferMinutes").value,
            DEFAULTS.temporalBufferMinutes
        ),
        spatialBufferMeters: toFiniteNumber(
            document.getElementById("spatialBufferMeters").value,
            DEFAULTS.spatialBufferMeters
        ),
        timeoutSeconds: toFiniteNumber(document.getElementById("timeoutSeconds").value, DEFAULTS.timeoutSeconds),
        chunkDays: toFiniteNumber(document.getElementById("chunkDays").value, DEFAULTS.chunkDays),
        maxQueryPoints: Math.max(
            2,
            Math.trunc(toFiniteNumber(document.getElementById("maxQueryPoints").value, DEFAULTS.maxQueryPoints))
        ),
        stacPageLimit: Math.max(
            1,
            Math.trunc(toFiniteNumber(document.getElementById("stacPageLimit").value, DEFAULTS.stacPageLimit))
        ),
        maxItems: Math.max(1, Math.trunc(toFiniteNumber(document.getElementById("maxItems").value, DEFAULTS.maxItems)))
    };

    assert(settings.timeoutSeconds > 0, "Timeout must be > 0.");
    assert(settings.chunkDays >= 1, "Chunk days must be >= 1.");

    return settings;
}

async function runMatching() {
    const settings = readSettings();

    setRunning(true);
    jsonBtn.disabled = true;
    csvBtn.disabled = true;

    try {
        setStatus("Parsing AIS CSV...");
        state.points = await parseAisCsv(settings.file, {
            lonColumn: settings.lonColumn,
            latColumn: settings.latColumn,
            timeColumn: settings.timeColumn
        });

        const queryTrack = buildQueryTrack(state.points, settings.maxQueryPoints);
        state.chunks = splitPointsByDays(queryTrack, settings.chunkDays);

        setStatus("Searching STAC by chunk and pagination...");
        state.candidates = await searchStacByChunks({
            stacUrl: settings.stacUrl,
            chunks: state.chunks,
            collections: settings.collections,
            stacPageLimit: settings.stacPageLimit,
            maxItems: settings.maxItems,
            timeoutSeconds: settings.timeoutSeconds,
            maxQueryPoints: settings.maxQueryPoints,
            chunkToLineString,
            onProgress: ({ chunkIndex, totalChunks, pageCount, uniqueCandidates }) => {
                setProgress(`STAC: chunk ${chunkIndex}/${totalChunks}, page ${pageCount}, unique ${uniqueCandidates}`);
                metricCandidates.textContent = String(uniqueCandidates);
            }
        });

        setStatus("Running shortlist temporal and spatial checks...");
        state.shortlist = await shortlistFeatures({
            candidates: state.candidates,
            points: state.points,
            temporalBufferMinutes: settings.temporalBufferMinutes,
            spatialBufferMeters: settings.spatialBufferMeters,
            onProgress: ({ currentFeature, totalFeatures, shortlistCount }) => {
                setProgress(`Shortlist: feature ${currentFeature}/${totalFeatures}, matched ${shortlistCount}`);
                metricShortlist.textContent = String(shortlistCount);
            }
        });

        refreshMetrics();
        renderMapData(map, state.points, state.shortlist);

        jsonBtn.disabled = false;
        csvBtn.disabled = false;

        setStatus("Completed");
        setProgress(`Done. Unique candidates ${state.candidates.length}; shortlist ${state.shortlist.length}.`);
    } catch (error) {
        setStatus("Failed");
        setProgress(error.message || String(error));
        console.error(error);
    } finally {
        setRunning(false);
        refreshMetrics();
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runMatching();
});

jsonBtn.addEventListener("click", () => {
    downloadJson(state.shortlist);
});

csvBtn.addEventListener("click", () => {
    downloadCsv(state.shortlist);
});

setStatus("Idle");
setProgress("Ready. Load AIS CSV to begin.");
