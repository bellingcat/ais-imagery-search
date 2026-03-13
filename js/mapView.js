import maplibregl from "https://esm.sh/maplibre-gl@4.7.1";
import { MAP_STYLE } from "./config.js";

const TRACK_SOURCE_ID = "ais-track-source";
const TRACK_LAYER_ID = "ais-track-layer";
const CANDIDATE_SOURCE_ID = "stac-candidates-source";
const CANDIDATE_FILL_LAYER_ID = "stac-candidates-fill-layer";
const CANDIDATE_LINE_LAYER_ID = "stac-candidates-line-layer";
const HIGHLIGHT_SOURCE_ID = "stac-highlight-source";
const HIGHLIGHT_LAYER_ID = "stac-highlight-layer";

const interactionStateByMap = new WeakMap();

export function createMap(containerId) {
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

export function renderMapData(map, {
    points,
    candidates,
    highlightedId,
    onFeatureHover,
    onFeatureClick,
    shouldFit = false
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
                collection_color: String(f._collectionColor || "#2f6f5e")
            }
        }));

    const highlightFeature = selectHighlightFeature(footprints, highlightedId);

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
                    "line-color": "#c84c09",
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
                    "line-color": "#c84c09",
                    "line-width": 3
                }
            });
        }

        if (shouldFit) {
            fitToData(map, [track, ...footprints]);
        }
    };

    if (map.isStyleLoaded()) {
        draw();
    } else {
        map.once("load", draw);
    }
}
