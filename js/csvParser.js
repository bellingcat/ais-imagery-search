import Papa from "https://esm.sh/papaparse@5.4.1";
import { parseTimestampUTC } from "./time.js";
import { assert } from "./utils.js";

export async function parseAisCsv(file, { lonColumn, latColumn, timeColumn }) {
    const text = await file.text();

    const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
    });

    if (result.errors.length > 0) {
        throw new Error(`CSV parse error: ${result.errors[0].message}`);
    }

    const points = [];
    for (const row of result.data) {
        const lon = Number(row[lonColumn]);
        const lat = Number(row[latColumn]);
        const ts = parseTimestampUTC(row[timeColumn]);

        if (!Number.isFinite(lon) || !Number.isFinite(lat) || !ts) {
            continue;
        }

        points.push({ lon, lat, ts });
    }

    points.sort((a, b) => a.ts - b.ts);
    assert(points.length >= 2, "Need at least 2 valid AIS points after parsing.");

    return points;
}
