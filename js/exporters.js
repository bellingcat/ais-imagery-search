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
