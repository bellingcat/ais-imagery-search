import maplibregl from "https://esm.sh/maplibre-gl@4.7.1";
import { Protocol } from "https://esm.sh/pmtiles@3.2.1";
import { MAP_STYLE } from "./config.js";

const TRACK_SOURCE_ID = "ais-track-source";
const TRACK_LAYER_ID = "ais-track-layer";
const CANDIDATE_SOURCE_ID = "stac-candidates-source";
const CANDIDATE_FILL_LAYER_ID = "stac-candidates-fill-layer";
const CANDIDATE_LINE_LAYER_ID = "stac-candidates-line-layer";
const HIGHLIGHT_SOURCE_ID = "stac-highlight-source";
const HIGHLIGHT_LAYER_ID = "stac-highlight-layer";

const interactionStateByMap = new WeakMap();
const previewPopupByMap = new WeakMap();
let pmtilesProtocolRegistered = false;

function ensurePmtilesProtocol() {
    if (pmtilesProtocolRegistered) {
        return;
    }

    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    pmtilesProtocolRegistered = true;
}

export function createMap(containerId) {
    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
        container: containerId,
        style: MAP_STYLE,
        center: [0, 0],
        zoom: 2
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    return map;
}

function trackGeoJson(points) {
    return {
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: points.map((p) => [p.lon, p.lat])
        },
        properties: {}
    };
}

function featureCollection(features) {
    return {
        type: "FeatureCollection",
        features
    };
}

function emptyFeatureCollection() {
    return { type: "FeatureCollection", features: [] };
}

function selectHighlightFeature(footprints, featureId) {
    if (!featureId) {
        return null;
    }

    return footprints.find((f) => String(f.properties?.id) === String(featureId)) || null;
}

function selectHighlightedCandidate(candidates, featureId) {
    if (!featureId) {
        return null;
    }

    return candidates.find((f) => String(f?.id ?? "") === String(featureId)) || null;
}

function findSelfHref(feature) {
    const links = Array.isArray(feature?.links) ? feature.links : [];
    const selfLink = links.find((entry) => String(entry?.rel || "").toLowerCase() === "self" && entry?.href);
    return selfLink?.href || "";
}

function toAbsoluteHref(href, baseHref) {
    const raw = String(href || "").trim();
    if (!raw) {
        return "";
    }

    try {
        return new URL(raw, baseHref || window.location.href).toString();
    } catch {
        return "";
    }
}

function isBrowserLoadableImageUrl(url) {
    return /^https?:\/\//i.test(String(url || "").trim());
}

function isLikelyImageAsset(entry) {
    const type = String(entry?.type || "").toLowerCase();
    if (type.startsWith("image/")) {
        return true;
    }

    const href = String(entry?.href || "").toLowerCase();
    return /\.(png|jpe?g|webp|gif)(\?|$)/.test(href);
}

function assetRank(entry, key) {
    const keyText = String(key || "").toLowerCase();
    const roles = Array.isArray(entry?.roles)
        ? entry.roles.map((role) => String(role).toLowerCase())
        : [];
    const rankMap = [
        { needle: "thumbnail", score: 0 },
        { needle: "quicklook", score: 1 },
        { needle: "overview", score: 2 },
        { needle: "preview", score: 3 },
        { needle: "browse", score: 4 },
        { needle: "visual", score: 5 }
    ];

    for (const { needle, score } of rankMap) {
        if (keyText.includes(needle) || roles.some((role) => role.includes(needle))) {
            return score;
        }
    }

    return 99;
}

function resolvePreviewImage(feature) {
    const selfHref = findSelfHref(feature);
    const links = Array.isArray(feature?.links) ? feature.links : [];
    const previewLink = links.find((entry) => {
        const rel = String(entry?.rel || "").toLowerCase();
        return entry?.href && (rel === "preview" || rel === "icon");
    });

    if (previewLink?.href) {
        const resolved = toAbsoluteHref(previewLink.href, selfHref);
        if (resolved && isBrowserLoadableImageUrl(resolved)) {
            return resolved;
        }
    }

    const assets = feature?.assets && typeof feature.assets === "object" ? feature.assets : {};
    const candidates = Object.entries(assets)
        .filter(([, entry]) => entry?.href && isLikelyImageAsset(entry))
        .map(([key, entry]) => ({ key, entry }))
        .sort((a, b) => assetRank(a.entry, a.key) - assetRank(b.entry, b.key));

    if (!candidates.length) {
        return "";
    }

    const resolved = toAbsoluteHref(candidates[0].entry.href, selfHref);
    return isBrowserLoadableImageUrl(resolved) ? resolved : "";
}

function buildPreviewPopupContent(feature, previewUrl) {
    const root = document.createElement("div");
    root.className = "map-preview-card";

    const imageWrap = document.createElement("div");
    imageWrap.className = "map-preview-image-wrap";

    if (previewUrl) {
        const img = document.createElement("img");
        img.className = "map-preview-image";
        img.src = previewUrl;
        img.alt = `Preview for ${String(feature?.collection || "imagery item")}`;
        img.loading = "lazy";
        img.addEventListener("error", () => {
            imageWrap.innerHTML = "";
            const empty = document.createElement("div");
            empty.className = "map-preview-empty";
            empty.textContent = "No thumbnail found";
            imageWrap.appendChild(empty);
        });
        imageWrap.appendChild(img);
    } else {
        const empty = document.createElement("div");
        empty.className = "map-preview-empty";
        empty.textContent = "No thumbnail found";
        imageWrap.appendChild(empty);
    }

    root.appendChild(imageWrap);

    const caption = document.createElement("div");
    caption.className = "map-preview-caption";
    const collection = String(feature?.collection || "").trim();
    const dt = String(feature?.properties?.datetime || feature?.properties?.start_datetime || "").trim();
    caption.textContent = [collection, dt].filter(Boolean).join(" | ");
    root.appendChild(caption);

    return root;
}

function updatePreviewPopup(map, highlightFeature, highlightedCandidate) {
    const existing = previewPopupByMap.get(map);

    if (!highlightFeature || !highlightedCandidate) {
        if (existing) {
            existing.remove();
            previewPopupByMap.delete(map);
        }
        return;
    }

    const previewUrl = resolvePreviewImage(highlightedCandidate);
    const center = centerOfGeometry(highlightFeature.geometry);
    if (!center) {
        if (existing) {
            existing.remove();
            previewPopupByMap.delete(map);
        }
        return;
    }

    const content = buildPreviewPopupContent(highlightedCandidate, previewUrl);

    if (existing) {
        existing.setLngLat(center).setDOMContent(content);
        return;
    }

    const popup = new maplibregl.Popup({
        className: "preview-popup",
        closeButton: false,
        closeOnClick: false,
        maxWidth: "230px",
        offset: 16
    })
        .setLngLat(center)
        .setDOMContent(content)
        .addTo(map);

    previewPopupByMap.set(map, popup);
}

function ensureInteractionHandlers(map, onHover, onClick) {
    const previous = interactionStateByMap.get(map);
    if (previous) {
        map.off("mousemove", CANDIDATE_FILL_LAYER_ID, previous.onMove);
        map.off("mousemove", CANDIDATE_LINE_LAYER_ID, previous.onMove);
        map.off("click", CANDIDATE_FILL_LAYER_ID, previous.onClick);
        map.off("click", CANDIDATE_LINE_LAYER_ID, previous.onClick);
        map.off("mouseleave", CANDIDATE_FILL_LAYER_ID, previous.onLeave);
        map.off("mouseleave", CANDIDATE_LINE_LAYER_ID, previous.onLeave);
    }

    const onMove = (event) => {
        const featureId = event.features?.[0]?.properties?.id;
        if (featureId && typeof onHover === "function") {
            onHover(String(featureId));
        }
    };

    const onClickLayer = (event) => {
        const featureId = event.features?.[0]?.properties?.id;
        if (featureId && typeof onClick === "function") {
            onClick(String(featureId));
        }
    };

    const onLeave = () => {
        if (typeof onHover === "function") {
            onHover(null);
        }
    };

    map.on("mousemove", CANDIDATE_FILL_LAYER_ID, onMove);
    map.on("mousemove", CANDIDATE_LINE_LAYER_ID, onMove);
    map.on("click", CANDIDATE_FILL_LAYER_ID, onClickLayer);
    map.on("click", CANDIDATE_LINE_LAYER_ID, onClickLayer);
    map.on("mouseleave", CANDIDATE_FILL_LAYER_ID, onLeave);
    map.on("mouseleave", CANDIDATE_LINE_LAYER_ID, onLeave);

    interactionStateByMap.set(map, {
        onMove,
        onClick: onClickLayer,
        onLeave
    });
}

function fitToData(map, features) {
    if (!features.length) {
        return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const collectCoord = (coord) => {
        minX = Math.min(minX, coord[0]);
        maxX = Math.max(maxX, coord[0]);
        minY = Math.min(minY, coord[1]);
        maxY = Math.max(maxY, coord[1]);
    };

    const scanGeom = (geom) => {
        if (!geom) {
            return;
        }

        const { type, coordinates } = geom;
        if (type === "Point") {
            collectCoord(coordinates);
        } else if (type === "LineString" || type === "MultiPoint") {
            coordinates.forEach(collectCoord);
        } else if (type === "Polygon" || type === "MultiLineString") {
            coordinates.flat().forEach(collectCoord);
        } else if (type === "MultiPolygon") {
            coordinates.flat(2).forEach(collectCoord);
        }
    };

    features.forEach((f) => scanGeom(f.geometry));

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return;
    }

    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 40, duration: 600 });
}

function centerOfGeometry(geom) {
    if (!geom) {
        return null;
    }

    if (geom.type === "Point" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
        return [geom.coordinates[0], geom.coordinates[1]];
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const collectCoord = (coord) => {
        minX = Math.min(minX, coord[0]);
        maxX = Math.max(maxX, coord[0]);
        minY = Math.min(minY, coord[1]);
        maxY = Math.max(maxY, coord[1]);
    };

    const { type, coordinates } = geom;
    if (type === "LineString" || type === "MultiPoint") {
        coordinates.forEach(collectCoord);
    } else if (type === "Polygon" || type === "MultiLineString") {
        coordinates.flat().forEach(collectCoord);
    } else if (type === "MultiPolygon") {
        coordinates.flat(2).forEach(collectCoord);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return null;
    }

    return [(minX + maxX) / 2, (minY + maxY) / 2];
}

export function renderMapData(map, {
    points,
    candidates,
    highlightedId,
    onFeatureHover,
    onFeatureClick,
    shouldFit = false,
    flyToHighlight = false
}) {
    const track = trackGeoJson(points);
    const footprints = candidates
        .filter((f) => f?.geometry)
        .map((f) => ({
            type: "Feature",
            geometry: f.geometry,
            properties: {
                id: String(f.id ?? ""),
                collection: String(f.collection || "unknown"),
                collection_color: String(f._collectionColor || "#f88906")
            }
        }));

    const highlightFeature = selectHighlightFeature(footprints, highlightedId);
    const highlightedCandidate = selectHighlightedCandidate(candidates, highlightedId);

    const draw = () => {
        const trackSource = map.getSource(TRACK_SOURCE_ID);
        if (trackSource) {
            trackSource.setData(track);
        } else {
            map.addSource(TRACK_SOURCE_ID, { type: "geojson", data: track });
            map.addLayer({
                id: TRACK_LAYER_ID,
                type: "line",
                source: TRACK_SOURCE_ID,
                paint: {
                    "line-color": "#fbb400",
                    "line-width": 3
                }
            });
        }

        const fpCollection = featureCollection(footprints);
        const fpSource = map.getSource(CANDIDATE_SOURCE_ID);
        if (fpSource) {
            fpSource.setData(fpCollection);
        } else {
            map.addSource(CANDIDATE_SOURCE_ID, { type: "geojson", data: fpCollection });
            map.addLayer({
                id: CANDIDATE_FILL_LAYER_ID,
                type: "fill",
                source: CANDIDATE_SOURCE_ID,
                paint: {
                    "fill-color": ["get", "collection_color"],
                    "fill-opacity": 0.33,
                    "fill-outline-color": "#18342d"
                }
            });

            map.addLayer({
                id: CANDIDATE_LINE_LAYER_ID,
                type: "line",
                source: CANDIDATE_SOURCE_ID,
                paint: {
                    "line-color": ["get", "collection_color"],
                    "line-width": 1.2,
                    "line-opacity": 0.8
                }
            });

            ensureInteractionHandlers(map, onFeatureHover, onFeatureClick);
        }

        const highlightCollection = highlightFeature
            ? featureCollection([highlightFeature])
            : emptyFeatureCollection();
        const highlightSource = map.getSource(HIGHLIGHT_SOURCE_ID);
        if (highlightSource) {
            highlightSource.setData(highlightCollection);
        } else {
            map.addSource(HIGHLIGHT_SOURCE_ID, { type: "geojson", data: highlightCollection });
            map.addLayer({
                id: HIGHLIGHT_LAYER_ID,
                type: "line",
                source: HIGHLIGHT_SOURCE_ID,
                paint: {
                    "line-color": "#fbb400",
                    "line-width": 3
                }
            });
        }

        if (shouldFit) {
            fitToData(map, [track, ...footprints]);
        } else if (flyToHighlight && highlightFeature) {
            const center = centerOfGeometry(highlightFeature.geometry);
            if (center) {
                map.flyTo({
                    center,
                    duration: 700,
                    essential: true
                });
            }
        }

        updatePreviewPopup(map, highlightFeature, highlightedCandidate);
    };

    if (map.isStyleLoaded()) {
        draw();
    } else {
        map.once("load", draw);
    }
}
