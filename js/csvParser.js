import Papa from "https://esm.sh/papaparse@5.4.1";
import { parseTimestampUTC } from "./time.js";
import { assert } from "./utils.js";

const AUTO_COLUMN_CANDIDATES = {
    lon: ["lon", "Lon", "Lng", "Longitude", "longitude"],
    lat: ["lat", "Lat", "Latitude", "latitude"],
    time: ["Date/Time", "timestamp", "datetime"]
};

function resolveColumnName(columnInput, availableHeaders, candidates, label) {
    const trimmedInput = String(columnInput || "").trim();

    if (trimmedInput) {
        if (availableHeaders.includes(trimmedInput)) {
            return trimmedInput;
        }

        const caseInsensitiveMatch = availableHeaders.find(
            (header) => header.toLowerCase() === trimmedInput.toLowerCase()
        );
        if (caseInsensitiveMatch) {
            return caseInsensitiveMatch;
        }

        throw new Error(
            `${label} column "${trimmedInput}" was not found in CSV headers: ${availableHeaders.join(", ")}`
        );
    }

    for (const candidate of candidates) {
        if (availableHeaders.includes(candidate)) {
            return candidate;
        }
    }

    throw new Error(
        `Could not auto-detect ${label} column. Tried: ${candidates.join(", ")}. CSV headers: ${availableHeaders.join(", ")}`
    );
}

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

    const availableHeaders = Array.isArray(result.meta?.fields)
        ? result.meta.fields.map((header) => String(header || "").trim()).filter(Boolean)
        : [];

    assert(availableHeaders.length > 0, "CSV does not contain a valid header row.");

    const resolvedLonColumn = resolveColumnName(
        lonColumn,
        availableHeaders,
        AUTO_COLUMN_CANDIDATES.lon,
        "Longitude"
    );
    const resolvedLatColumn = resolveColumnName(
        latColumn,
        availableHeaders,
        AUTO_COLUMN_CANDIDATES.lat,
        "Latitude"
    );
    const resolvedTimeColumn = resolveColumnName(
        timeColumn,
        availableHeaders,
        AUTO_COLUMN_CANDIDATES.time,
        "Time"
    );

    const points = [];
    for (const row of result.data) {
        const lon = Number(row[resolvedLonColumn]);
        const lat = Number(row[resolvedLatColumn]);
        const ts = parseTimestampUTC(row[resolvedTimeColumn]);

        if (!Number.isFinite(lon) || !Number.isFinite(lat) || !ts) {
            continue;
        }

        points.push({ lon, lat, ts });
    }

    points.sort((a, b) => a.ts - b.ts);
    assert(points.length >= 2, "Need at least 2 valid AIS points after parsing.");

    return points;
}
