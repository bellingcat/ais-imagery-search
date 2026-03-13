import maplibregl from "https://esm.sh/maplibre-gl@4.7.1";
import { MAP_STYLE } from "./config.js";

const TRACK_SOURCE_ID = "ais-track-source";
const TRACK_LAYER_ID = "ais-track-layer";
const FOOTPRINT_SOURCE_ID = "stac-footprints-source";
const FOOTPRINT_LAYER_ID = "stac-footprints-layer";

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

export function renderMapData(map, points, shortlist) {
    const track = trackGeoJson(points);
    const footprints = shortlist
        .map((s) => s._feature)
        .filter((f) => f?.geometry)
        .map((f) => ({ type: "Feature", geometry: f.geometry, properties: { id: f.id } }));

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
        const fpSource = map.getSource(FOOTPRINT_SOURCE_ID);
        if (fpSource) {
            fpSource.setData(fpCollection);
        } else {
            map.addSource(FOOTPRINT_SOURCE_ID, { type: "geojson", data: fpCollection });
            map.addLayer({
                id: FOOTPRINT_LAYER_ID,
                type: "fill",
                source: FOOTPRINT_SOURCE_ID,
                paint: {
                    "fill-color": "#2f6f5e",
                    "fill-opacity": 0.25,
                    "fill-outline-color": "#204b3f"
                }
            });
        }

        fitToData(map, [track, ...footprints]);
    };

    if (map.isStyleLoaded()) {
        draw();
    } else {
        map.once("load", draw);
    }
}
