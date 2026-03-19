import { DEFAULTS } from "./config.js";
import { parseAisCsv } from "./csvParser.js";
import { buildQueryTrack, chunkToLineString, splitPointsByDays } from "./track.js";
import { searchStacByChunks } from "./stacClient.js";
import { shortlistFeatures } from "./shortlist.js";
import { createMap, renderMapData } from "./mapView.js";
import { downloadCsv, downloadJson, downloadShipPositionGeoJson } from "./exporters.js";
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
const appShell = document.querySelector(".app-shell");
const paneResizer = document.getElementById("paneResizer");
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

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function initPaneResizer() {
    if (!appShell || !paneResizer) {
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    const onPointerMove = (event) => {
        if (!isResizing) {
            return;
        }

        const deltaX = event.clientX - startX;
        const viewportMax = Math.max(520, window.innerWidth - 360);
        const nextWidth = clamp(startWidth + deltaX, 420, viewportMax);
        appShell.style.setProperty("--left-pane-width", `${nextWidth}px`);
    };

    const stopResizing = () => {
        if (!isResizing) {
            return;
        }

        isResizing = false;
        document.body.classList.remove("resizing");
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", stopResizing);
        window.removeEventListener("pointercancel", stopResizing);
    };

    paneResizer.addEventListener("pointerdown", (event) => {
        if (window.matchMedia("(max-width: 1024px)").matches) {
            return;
        }

        event.preventDefault();
        isResizing = true;
        startX = event.clientX;
        startWidth = document.querySelector(".controls-panel")?.getBoundingClientRect().width || 620;

        document.body.classList.add("resizing");
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", stopResizing);
        window.addEventListener("pointercancel", stopResizing);
    });
}

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

function formatDisplayTimestamp(value) {
    const text = String(value || "").trim();
    if (!text) {
        return "";
    }

    const withSpace = text.replace("T", " ");
    const noMillis = withSpace.replace(/(\d{2}:\d{2}:\d{2})\.\d+/, "$1");
    const noMillisNoZulu = noMillis.replace(/Z$/, "");
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(noMillisNoZulu)) {
        return noMillisNoZulu;
    }

    const parsed = new Date(text);
    if (Number.isFinite(parsed.getTime())) {
        return parsed.toISOString().slice(0, 19).replace("T", " ").replace(/Z$/, "");
    }

    return noMillisNoZulu;
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

const COPERNICUS_BROWSER_CONFIG = {
    "sentinel-2-l2a": {
        datasetId: "S2_L2A_CDAS",
        layerId: "1_TRUE_COLOR"
    },
    "sentinel-1-grd": {
        datasetId: "S1_CDAS_IW_VVVH",
        layerId: "8_RGB-RATIO"
    },
    "landsat-c2-l1-oli-tirs": {
        datasetId: "CDAS_L8_L9_LOTL1",
        layerId: "1_TRUE_COLOR"
    }
};

function toDayBoundsUtc(timestamp) {
    const parsed = new Date(String(timestamp || ""));
    if (!Number.isFinite(parsed.getTime())) {
        return null;
    }

    const year = parsed.getUTCFullYear();
    const month = parsed.getUTCMonth();
    const day = parsed.getUTCDate();

    const fromTime = new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
    const toTime = new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString();
    return { fromTime, toTime };
}

function buildCopernicusBrowserUrl(row) {
    const config = COPERNICUS_BROWSER_CONFIG[String(row?.collection || "").toLowerCase()];
    if (!config) {
        return "";
    }

    const lat = Number(row?.matched_ais_lat);
    const lng = Number(row?.matched_ais_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return "";
    }

    const dayBounds = toDayBoundsUtc(row?.matched_ais_timestamp || row?.matched_target_timestamp || row?.datetime);
    if (!dayBounds) {
        return "";
    }

    const params = new URLSearchParams({
        zoom: "14",
        lat: String(lat),
        lng: String(lng),
        datasetId: config.datasetId,
        fromTime: dayBounds.fromTime,
        toTime: dayBounds.toTime,
        layerId: config.layerId
    });

    return `https://browser.dataspace.copernicus.eu/?${params.toString()}`;
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

    const rows = candidates.map((feature) => {
        const featureId = String(feature.id ?? "");
        const match = shortlistById.get(featureId);
        return {
            id: featureId,
            collection: String(feature.collection || ""),
            datetime: featureDateTime(feature),
            platform: String(feature?.properties?.platform || ""),
            matched_ais_lon: match?.matched_ais_lon,
            matched_ais_lat: match?.matched_ais_lat,
            matched_ais_timestamp: match?.matched_ais_timestamp || "",
            matched_target_timestamp: match?.matched_target_timestamp || "",
            matched_ais_prev_lon: match?.matched_ais_prev_lon,
            matched_ais_prev_lat: match?.matched_ais_prev_lat,
            matched_ais_prev_timestamp: match?.matched_ais_prev_timestamp || "",
            matched_ais_next_lon: match?.matched_ais_next_lon,
            matched_ais_next_lat: match?.matched_ais_next_lat,
            matched_ais_next_timestamp: match?.matched_ais_next_timestamp || "",
            imagery_url: pickImageryUrl(feature),
            copernicus_browser_url: "",
            matched: Boolean(match)
        };
    });

    for (const row of rows) {
        row.copernicus_browser_url = buildCopernicusBrowserUrl(row);
    }

    rows.sort((a, b) => {
        const aMs = new Date(a.datetime || "").getTime();
        const bMs = new Date(b.datetime || "").getTime();
        const safeA = Number.isFinite(aMs) ? aMs : Number.NEGATIVE_INFINITY;
        const safeB = Number.isFinite(bMs) ? bMs : Number.NEGATIVE_INFINITY;
        return safeB - safeA;
    });

    return rows;
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

function rerenderMap(shouldFit = false, flyToHighlight = false) {
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
        shouldFit,
        flyToHighlight
    });
}

function clearCurrentSearch() {
    state.shortlist = [];
    state.points = [];
    state.chunks = [];
    state.candidates = [];
    state.shortlistedFeatures = [];
    state.rows = [];
    state.highlightedFeatureId = null;
    state.collectionColors = new Map();

    resultsTbody.innerHTML = "";
    renderLegend(state.collectionColors);
    resultCandidates.textContent = "0";
    resultShortlist.textContent = "0";

    jsonBtn.disabled = true;
    csvBtn.disabled = true;

    rerenderMap(false, false);
    refreshMetrics();
}

function renderResultsTable(rows) {
    resultsTbody.innerHTML = "";

    for (const row of rows) {
        const tr = document.createElement("tr");
        tr.setAttribute("data-feature-id", row.id);

        const formattedDatetime = formatDisplayTimestamp(row.datetime);
        const formattedMatchedTime = formatDisplayTimestamp(row.matched_ais_timestamp);

        const hasClosestPosition = Number.isFinite(row.matched_ais_lon) && Number.isFinite(row.matched_ais_lat);
        const shipPositionCell = `<button type="button" class="ship-pos-btn" ${hasClosestPosition ? "" : "disabled"}>Download</button>`;
        const hasImageryUrl = Boolean(row.imagery_url);
        const hasCopernicusUrl = Boolean(row.copernicus_browser_url);
        const imageryCell = `
            <div class="imagery-actions">
                <button type="button" class="imagery-btn" ${hasImageryUrl ? "" : "disabled"}>Open Item</button>
                <button type="button" class="copernicus-btn" ${hasCopernicusUrl ? "" : "disabled"}>Open Browser</button>
            </div>
        `;

        tr.innerHTML = `
            <td>${row.platform || ""}</td>
            <td>${formattedDatetime || ""}</td>
            <td>${formattedMatchedTime || "-"}</td>
            <td>${shipPositionCell}</td>
            <td>${imageryCell}</td>
        `;

        const shipPositionBtn = tr.querySelector(".ship-pos-btn");
        if (shipPositionBtn) {
            shipPositionBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                try {
                    downloadShipPositionGeoJson(row);
                } catch (error) {
                    setStatus("Failed");
                    setProgress(error.message || String(error));
                    console.error(error);
                }
            });
        }

        const imageryBtn = tr.querySelector(".imagery-btn");
        if (imageryBtn) {
            imageryBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                if (!row.imagery_url) {
                    return;
                }

                window.open(row.imagery_url, "_blank", "noopener,noreferrer");
            });
        }

        const copernicusBtn = tr.querySelector(".copernicus-btn");
        if (copernicusBtn) {
            copernicusBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                if (!row.copernicus_browser_url) {
                    return;
                }

                window.open(row.copernicus_browser_url, "_blank", "noopener,noreferrer");
            });
        }

        tr.addEventListener("mouseenter", () => {
            state.highlightedFeatureId = row.id;
            setHighlightedRow(row.id, false);
            rerenderMap();
        });

        tr.addEventListener("click", () => {
            state.highlightedFeatureId = row.id;
            setHighlightedRow(row.id, false);
            rerenderMap(false, true);
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

    const selectedCollections = [];
    if (document.getElementById("collectionS1")?.checked) {
        selectedCollections.push("sentinel-1-grd");
    }
    if (document.getElementById("collectionS2")?.checked) {
        selectedCollections.push("sentinel-2-l2a");
    }
    if (document.getElementById("collectionLandsat")?.checked) {
        selectedCollections.push("landsat-c2-l1-oli-tirs");
    }

    const additionalCollections = splitCsvList(document.getElementById("additionalCollections")?.value || "");
    const collections = Array.from(new Set([...selectedCollections, ...additionalCollections]));
    assert(collections.length > 0, "At least one collection is required.");

    const settings = {
        file,
        lonColumn: document.getElementById("lonColumn").value.trim(),
        latColumn: document.getElementById("latColumn").value.trim(),
        timeColumn: document.getElementById("timeColumn").value.trim(),
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
    clearCurrentSearch();
    showSearchView();
    setStatus("Idle");
    setProgress("Ready. Load AIS CSV to begin.");
});

setStatus("Idle");
setProgress("Ready. Load AIS CSV to begin.");
showSearchView();
initPaneResizer();
