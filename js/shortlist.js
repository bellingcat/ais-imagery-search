import { point, polygon } from "https://esm.sh/@turf/helpers@7.2.0";
import booleanIntersects from "https://esm.sh/@turf/boolean-intersects@7.2.0";
import { toIsoZ, windowsOverlap } from "./time.js";
import { yieldToUI } from "./utils.js";

function featureWindow(feature) {
    const props = feature?.properties || {};

    if (props.datetime) {
        const t = new Date(props.datetime).getTime();
        if (Number.isFinite(t)) {
            return [t, t];
        }
    }

    if (props.start_datetime && props.end_datetime) {
        const a = new Date(props.start_datetime).getTime();
        const b = new Date(props.end_datetime).getTime();
        if (Number.isFinite(a) && Number.isFinite(b)) {
            return [Math.min(a, b), Math.max(a, b)];
        }
    }

    return null;
}

function featureTargetTimeMs(startMs, endMs) {
    return Math.round((startMs + endMs) / 2);
}

function metersToDegreesLat(meters) {
    return meters / 111320;
}

function metersToDegreesLon(meters, latDegrees) {
    const cosLat = Math.cos((latDegrees * Math.PI) / 180);
    const safeCos = Math.max(Math.abs(cosLat), 0.01);
    return meters / (111320 * safeCos);
}

function buildPointBufferPolygon(lon, lat, meters, steps = 36) {
    const dLat = metersToDegreesLat(meters);
    const dLon = metersToDegreesLon(meters, lat);

    const ring = [];
    for (let i = 0; i <= steps; i += 1) {
        const theta = (i / steps) * Math.PI * 2;
        ring.push([lon + dLon * Math.cos(theta), lat + dLat * Math.sin(theta)]);
    }

    return polygon([ring]);
}

export async function shortlistFeatures({
    candidates,
    points,
    temporalBufferMinutes,
    spatialBufferMeters,
    onProgress
}) {
    const out = [];
    const temporalBufferMs = temporalBufferMinutes * 60 * 1000;

    for (let fIdx = 0; fIdx < candidates.length; fIdx += 1) {
        const feature = candidates[fIdx];
        if (!feature?.geometry) {
            continue;
        }

        const fWindow = featureWindow(feature);
        if (!fWindow) {
            continue;
        }

        const [fStart, fEnd] = fWindow;
        const targetTimeMs = featureTargetTimeMs(fStart, fEnd);
        let bestMatch = null;

        for (let i = 0; i < points.length; i += 1) {
            const prev = i > 0 ? points[i - 1] : null;
            const curr = points[i];
            const next = i < points.length - 1 ? points[i + 1] : null;
            const currTsMs = curr.ts.getTime();

            let pStart = currTsMs - temporalBufferMs;
            let pEnd = currTsMs + temporalBufferMs;

            if (prev) {
                pStart = Math.max(pStart, prev.ts.getTime());
            }
            if (next) {
                pEnd = Math.min(pEnd, next.ts.getTime());
            }

            if (!windowsOverlap(pStart, pEnd, fStart, fEnd)) {
                continue;
            }

            const aisPoint = point([curr.lon, curr.lat]);
            const queryGeom = spatialBufferMeters > 0
                ? buildPointBufferPolygon(curr.lon, curr.lat, spatialBufferMeters)
                : aisPoint;

            if (!booleanIntersects(feature.geometry, queryGeom)) {
                continue;
            }

            const deltaMs = Math.abs(currTsMs - targetTimeMs);
            if (!bestMatch || deltaMs < bestMatch.deltaMs) {
                bestMatch = {
                    index: i,
                    point: curr,
                    deltaMs
                };
            }
        }

        if (bestMatch) {
            const prevPoint = bestMatch.index > 0 ? points[bestMatch.index - 1] : null;
            const nextPoint = bestMatch.index < points.length - 1 ? points[bestMatch.index + 1] : null;

            out.push({
                id: feature.id,
                collection: feature.collection || "",
                datetime: feature?.properties?.datetime || feature?.properties?.start_datetime || "",
                platform: feature?.properties?.platform || "",
                matched_ais_lon: bestMatch.point.lon,
                matched_ais_lat: bestMatch.point.lat,
                matched_ais_timestamp: toIsoZ(bestMatch.point.ts),
                matched_target_timestamp: toIsoZ(new Date(targetTimeMs)),
                matched_ais_prev_lon: prevPoint ? prevPoint.lon : null,
                matched_ais_prev_lat: prevPoint ? prevPoint.lat : null,
                matched_ais_prev_timestamp: prevPoint ? toIsoZ(prevPoint.ts) : null,
                matched_ais_next_lon: nextPoint ? nextPoint.lon : null,
                matched_ais_next_lat: nextPoint ? nextPoint.lat : null,
                matched_ais_next_timestamp: nextPoint ? toIsoZ(nextPoint.ts) : null,
                matched_time_delta_seconds: Math.round(bestMatch.deltaMs / 1000),
                _feature: feature
            });
        }

        if (typeof onProgress === "function") {
            onProgress({
                currentFeature: fIdx + 1,
                totalFeatures: candidates.length,
                shortlistCount: out.length
            });
        }

        if (fIdx % 30 === 0) {
            await yieldToUI();
        }
    }

    return out;
}
