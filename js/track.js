import { lineString } from "https://esm.sh/@turf/helpers@7.2.0";

export function buildQueryTrack(points, maxQueryPoints) {
    if (points.length <= maxQueryPoints) {
        return points.slice();
    }

    const step = Math.ceil((points.length - 1) / (maxQueryPoints - 1));
    const sampled = [];

    for (let i = 0; i < points.length; i += step) {
        sampled.push(points[i]);
    }

    const lastPoint = points[points.length - 1];
    if (sampled[sampled.length - 1] !== lastPoint) {
        sampled.push(lastPoint);
    }

    return sampled;
}

export function splitPointsByDays(points, chunkDays) {
    if (points.length === 0) {
        return [];
    }

    const chunks = [];
    const spanMs = chunkDays * 24 * 60 * 60 * 1000;

    let currentChunk = [points[0]];
    let currentStart = points[0].ts.getTime();

    for (let i = 1; i < points.length; i += 1) {
        const pt = points[i];
        if (pt.ts.getTime() - currentStart < spanMs) {
            currentChunk.push(pt);
            continue;
        }

        chunks.push(currentChunk);
        currentChunk = [pt];
        currentStart = pt.ts.getTime();
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
}

export function chunkToLineString(points, maxQueryPoints) {
    const sampled = buildQueryTrack(points, maxQueryPoints);
    const coords = sampled.map((p) => [p.lon, p.lat]);
    return lineString(coords);
}

function segmentGeometry(points, spatialBufferMeters) {
    const coords = [];
    for (const p of points) {
        const last = coords[coords.length - 1];
        if (!last || last[0] !== p.lon || last[1] !== p.lat) {
            coords.push([p.lon, p.lat]);
        }
    }

    if (spatialBufferMeters > 0) {
        // Buffered bbox is a superset of the shortlist's per-point buffer test.
        const lats = coords.map((c) => c[1]);
        const lons = coords.map((c) => c[0]);
        const dLat = spatialBufferMeters / 111320;
        const maxAbsLat = Math.min(89, Math.max(...lats.map(Math.abs)) + dLat);
        const dLon = spatialBufferMeters / (111320 * Math.max(Math.cos((maxAbsLat * Math.PI) / 180), 0.01));
        const [w, s, e, n] = [Math.min(...lons) - dLon, Math.min(...lats) - dLat, Math.max(...lons) + dLon, Math.max(...lats) + dLat];
        return { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
    }

    return coords.length === 1
        ? { type: "Point", coordinates: coords[0] }
        : { type: "LineString", coordinates: coords };
}

/**
 * CQL2-JSON filter matching items that intersect each short stretch of track during that stretch's
 * own (buffered) time window, rather than anywhere on the chunk's track at any time in the chunk.
 */
export function buildSpatioTemporalFilter(points, {
    segmentMinutes,
    temporalBufferMinutes,
    spatialBufferMeters,
    maxPointsPerSegment,
    timeProperty
}) {
    const segmentMs = segmentMinutes * 60 * 1000;
    const bufferMs = temporalBufferMinutes * 60 * 1000;
    const clauses = [];

    let i = 0;
    while (i < points.length) {
        let j = i;
        while (j + 1 < points.length && points[j + 1].ts.getTime() - points[i].ts.getTime() <= segmentMs) {
            j += 1;
        }
        // Include the next segment's first point so the gap between segments is covered.
        const segment = points.slice(i, Math.min(j + 2, points.length));
        const sampled = buildQueryTrack(segment, maxPointsPerSegment);
        const start = new Date(segment[0].ts.getTime() - bufferMs).toISOString();
        const end = new Date(segment[segment.length - 1].ts.getTime() + bufferMs).toISOString();

        clauses.push({
            op: "and",
            args: [
                { op: "s_intersects", args: [{ property: "geometry" }, segmentGeometry(sampled, spatialBufferMeters)] },
                { op: "t_intersects", args: [{ property: timeProperty }, { interval: [start, end] }] }
            ]
        });
        i = j + 1;
    }

    return clauses.length === 1 ? clauses[0] : { op: "or", args: clauses };
}
