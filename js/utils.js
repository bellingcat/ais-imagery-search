export function yieldToUI() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

export function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

export function splitCsvList(value) {
    return String(value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

export function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
