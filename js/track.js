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
