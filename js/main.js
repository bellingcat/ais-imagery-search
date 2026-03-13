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
    candidates: [],
    shortlistedFeatures: [],
    rows: [],
    highlightedFeatureId: null,
    collectionColors: new Map()
};

const searchView = document.getElementById("searchView");
const resultsView = document.getElementById("resultsView");
const form = document.getElementById("controlsForm");
const runBtn = document.getElementById("runBtn");
const jsonBtn = document.getElementById("jsonBtn");
const csvBtn = document.getElementById("csvBtn");
const newSearchBtn = document.getElementById("newSearchBtn");
const statusLine = document.getElementById("statusLine");
const progressLine = document.getElementById("progressLine");
const resultsTbody = document.getElementById("resultsTbody");
const resultsLegend = document.getElementById("resultsLegend");
const resultCandidates = document.getElementById("resultCandidates");
const resultShortlist = document.getElementById("resultShortlist");

const metricPoints = document.getElementById("metricPoints");
const metricChunks = document.getElementById("metricChunks");
const metricCandidates = document.getElementById("metricCandidates");
const metricShortlist = document.getElementById("metricShortlist");

const map = createMap("map");

const COLLECTION_PALETTE = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf"
];

function setStatus(text) {
    statusLine.textContent = text;
}

function setProgress(text) {
    progressLine.textContent = text;
}

function setRunning(running) {
    runBtn.disabled = running;
    if (newSearchBtn) {
        newSearchBtn.disabled = running;
    }
}

function showSearchView() {
    searchView.classList.remove("hidden");
    resultsView.classList.add("hidden");
}

function showResultsView() {
    searchView.classList.add("hidden");
    resultsView.classList.remove("hidden");
}

function refreshMetrics() {
    metricPoints.textContent = String(state.points.length);
    metricChunks.textContent = String(state.chunks.length);
    metricCandidates.textContent = String(state.candidates.length);
    metricShortlist.textContent = String(state.shortlist.length);
}

function featureDateTime(feature) {
    const props = feature?.properties || {};
    return props.datetime || props.start_datetime || "";
}

function toBrowserItemUrl(selfHref) {
    if (!selfHref) {
        return "";
    }

    try {
        const url = new URL(selfHref);
        const cleanPath = url.pathname.replace(/^\/v1(?=\/|$)/, "");
        const browserHost = url.host.startsWith("browser.") ? url.host : `browser.${url.host}`;
        return `${url.protocol}//${browserHost}${cleanPath}?.language=en`;
    } catch {
        const noV1 = String(selfHref).replace(/\/v1(?=\/collections\/)/, "");
        const withBrowser = noV1.replace(/^https:\/\/(?!browser\.)/, "https://browser.");
        return `${withBrowser}?.language=en`;
    }
}

function pickImageryUrl(feature) {
    const links = Array.isArray(feature?.links) ? feature.links : [];
    const selfLink = links.find((entry) => String(entry?.rel || "").toLowerCase() === "self" && entry?.href);
    return toBrowserItemUrl(selfLink?.href || "");
}

function buildCollectionColorMap(candidates) {
    const collections = Array.from(
        new Set(candidates.map((c) => String(c.collection || "unknown")))
    ).sort((a, b) => a.localeCompare(b));

    const out = new Map();
    for (let i = 0; i < collections.length; i += 1) {
        out.set(collections[i], COLLECTION_PALETTE[i % COLLECTION_PALETTE.length]);
    }

    return out;
}

function renderLegend(colorMap) {
    resultsLegend.innerHTML = "";
    const entries = Array.from(colorMap.entries());
    for (const [collection, color] of entries) {
        const item = document.createElement("span");
        item.className = "legend-item";
        item.innerHTML = `<span class="legend-swatch" style="background:${color}"></span><span>${collection}</span>`;
        resultsLegend.appendChild(item);
    }
}

function buildResultRows(candidates, shortlist) {
    const shortlistById = new Map(shortlist.map((row) => [String(row.id), row]));

    return candidates.map((feature) => {
        const featureId = String(feature.id ?? "");
        const match = shortlistById.get(featureId);
        return {
            id: featureId,
            collection: String(feature.collection || ""),
            datetime: featureDateTime(feature),
            platform: String(feature?.properties?.platform || ""),
            matched_ais_timestamp: match?.matched_ais_timestamp || "",
            imagery_url: pickImageryUrl(feature),
            matched: Boolean(match)
        };
    });
}

function setHighlightedRow(featureId, shouldScroll) {
    const rows = resultsTbody.querySelectorAll("tr[data-feature-id]");
    let targetRow = null;

    for (const row of rows) {
        const isTarget = featureId && row.getAttribute("data-feature-id") === String(featureId);
        row.classList.toggle("active", Boolean(isTarget));
        if (isTarget) {
            targetRow = row;
        }
    }

    if (targetRow && shouldScroll) {
        targetRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function rerenderMap(shouldFit = false) {
    renderMapData(map, {
        points: state.points,
        candidates: state.shortlistedFeatures,
        highlightedId: state.highlightedFeatureId,
        onFeatureHover: (featureId) => {
            state.highlightedFeatureId = featureId;
            setHighlightedRow(featureId, false);
            rerenderMap();
        },
        onFeatureClick: (featureId) => {
            state.highlightedFeatureId = featureId;
            setHighlightedRow(featureId, true);
            rerenderMap();
        },
        shouldFit
    });
}

function renderResultsTable(rows) {
    resultsTbody.innerHTML = "";

    for (const row of rows) {
        const tr = document.createElement("tr");
        tr.setAttribute("data-feature-id", row.id);

        const imageryCell = row.imagery_url
            ? `<a href="${row.imagery_url}" target="_blank" rel="noopener noreferrer">Open</a>`
            : "-";

        tr.innerHTML = `
            <td>${row.id || ""}</td>
            <td>${row.collection || ""}</td>
            <td>${row.datetime || ""}</td>
            <td>${row.platform || ""}</td>
            <td>${row.matched_ais_timestamp || "-"}</td>
            <td>${imageryCell}</td>
        `;

        tr.addEventListener("mouseenter", () => {
            state.highlightedFeatureId = row.id;
            setHighlightedRow(row.id, false);
            rerenderMap();
        });

        tr.addEventListener("click", () => {
            state.highlightedFeatureId = row.id;
            setHighlightedRow(row.id, false);
            rerenderMap();
        });

        resultsTbody.appendChild(tr);
    }
}

function prepareResultsView() {
    state.shortlistedFeatures = state.shortlist
        .map((row) => row._feature)
        .filter((feature) => feature && feature.geometry);

    state.collectionColors = buildCollectionColorMap(state.shortlistedFeatures);
    for (const feature of state.shortlistedFeatures) {
        const collection = String(feature.collection || "unknown");
        feature._collectionColor = state.collectionColors.get(collection) || "#2f6f5e";
    }

    state.rows = buildResultRows(state.shortlistedFeatures, state.shortlist);
    renderResultsTable(state.rows);
    renderLegend(state.collectionColors);

    resultCandidates.textContent = String(state.shortlistedFeatures.length);
    resultShortlist.textContent = String(state.shortlist.length);

    state.highlightedFeatureId = state.rows[0]?.id || null;
    setHighlightedRow(state.highlightedFeatureId, false);
    rerenderMap(true);
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
        showSearchView();
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
        prepareResultsView();
        showResultsView();

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

newSearchBtn.addEventListener("click", () => {
    showSearchView();
    setStatus("Idle");
    setProgress("Ready. Load AIS CSV to begin.");
});

setStatus("Idle");
setProgress("Ready. Load AIS CSV to begin.");
showSearchView();
