const GMT_DMY_REGEX = /^(\d{2}):(\d{2}):(\d{2})\s+GMT\s+(\d{2})\/(\d{2})\/(\d{4})$/i;

export function parseTimestampUTC(raw) {
    if (raw == null) {
        return null;
    }

    const text = String(raw).trim();
    if (!text) {
        return null;
    }

    const gmtMatch = text.match(GMT_DMY_REGEX);
    if (gmtMatch) {
        const [, hh, mm, ss, dd, mo, yyyy] = gmtMatch;
        const ms = Date.UTC(
            Number(yyyy),
            Number(mo) - 1,
            Number(dd),
            Number(hh),
            Number(mm),
            Number(ss)
        );
        return Number.isNaN(ms) ? null : new Date(ms);
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
}

export function toIsoZ(date) {
    return date.toISOString();
}

export function windowsOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart <= bEnd && bStart <= aEnd;
}
