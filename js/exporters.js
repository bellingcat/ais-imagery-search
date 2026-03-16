function toCsvCell(value) {
    if (value == null) {
        return "";
    }

    const raw = String(value);
    if (/[",\n]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
    }

    return raw;
}

export function shortlistToCsv(shortlist) {
    const columns = [
        "id",
        "collection",
        "datetime",
        "platform",
        "matched_ais_lon",
        "matched_ais_lat",
        "matched_ais_timestamp",
        "matched_time_delta_seconds"
    ];

    const header = columns.join(",");
    const rows = shortlist.map((row) => columns.map((c) => toCsvCell(row[c])).join(","));
    return `${header}\n${rows.join("\n")}`;
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function cleanFilenamePart(value, fallback = "item") {
    const out = String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return out || fallback;
}

function toPositionFeature(role, lon, lat, timestamp, parentId) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return null;
    }

    return {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [lon, lat]
        },
        properties: {
            label: role,
            timestamp: timestamp || "",
            parent_result_id: parentId || ""
        }
    };
}

function toTimeMs(value) {
    const t = new Date(String(value || "")).getTime();
    return Number.isFinite(t) ? t : null;
}

export function downloadJson(shortlist, filename = "shortlist.json") {
    const safe = shortlist.map(({ _feature, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
    triggerDownload(blob, filename);
}

export function downloadCsv(shortlist, filename = "shortlist.csv") {
    const safe = shortlist.map(({ _feature, ...rest }) => rest);
    const blob = new Blob([shortlistToCsv(safe)], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, filename);
}

export function downloadShipPositionGeoJson(row, filename) {
    const features = [];

    const closestFeature = toPositionFeature(
        "Nearest AIS position",
        row?.matched_ais_lon,
        row?.matched_ais_lat,
        row?.matched_ais_timestamp,
        row?.id
    );
    if (closestFeature) {
        features.push(closestFeature);
    }

    const targetMs = toTimeMs(row?.matched_target_timestamp) ?? toTimeMs(row?.datetime) ?? toTimeMs(row?.matched_ais_timestamp);
    const prevMs = toTimeMs(row?.matched_ais_prev_timestamp);
    const nextMs = toTimeMs(row?.matched_ais_next_timestamp);

    let adjacent = null;
    if (targetMs != null && prevMs != null && nextMs != null) {
        adjacent = Math.abs(prevMs - targetMs) <= Math.abs(nextMs - targetMs)
            ? {
                label: "Adjacent AIS position (previous)",
                lon: row?.matched_ais_prev_lon,
                lat: row?.matched_ais_prev_lat,
                timestamp: row?.matched_ais_prev_timestamp
            }
            : {
                label: "Adjacent AIS position (next)",
                lon: row?.matched_ais_next_lon,
                lat: row?.matched_ais_next_lat,
                timestamp: row?.matched_ais_next_timestamp
            };
    } else if (prevMs != null) {
        adjacent = {
            label: "Adjacent AIS position (previous)",
            lon: row?.matched_ais_prev_lon,
            lat: row?.matched_ais_prev_lat,
            timestamp: row?.matched_ais_prev_timestamp
        };
    } else if (nextMs != null) {
        adjacent = {
            label: "Adjacent AIS position (next)",
            lon: row?.matched_ais_next_lon,
            lat: row?.matched_ais_next_lat,
            timestamp: row?.matched_ais_next_timestamp
        };
    }

    if (adjacent) {
        const adjacentFeature = toPositionFeature(
            adjacent.label,
            adjacent.lon,
            adjacent.lat,
            adjacent.timestamp,
            row?.id
        );
        if (adjacentFeature) {
            features.push(adjacentFeature);
        }
    }

    if (features.length === 0) {
        throw new Error("No AIS position points available for this result.");
    }

    const geojson = {
        type: "FeatureCollection",
        features
    };

    const safeId = cleanFilenamePart(row?.id, "result");
    const outName = filename || `ship-position-${safeId}.geojson`;
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
    triggerDownload(blob, outName);
}
