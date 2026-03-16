import { toIsoZ } from "./time.js";
import { yieldToUI } from "./utils.js";

const MAX_429_RETRIES = 4;
const DEFAULT_429_WAIT_MS = 2000;
const MAX_RETRY_AFTER_MS = 120000;
const DEFAULT_REQUEST_DELAY_MS = 200;

function buildHeaders() {
    return {
        Accept: "application/geo+json, application/json",
        "Content-Type": "application/json"
    };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(retryAfterValue) {
    if (!retryAfterValue) {
        return null;
    }

    const seconds = Number(retryAfterValue);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds * 1000;
    }

    const retryDate = Date.parse(retryAfterValue);
    if (Number.isFinite(retryDate)) {
        return Math.max(0, retryDate - Date.now());
    }

    return null;
}

function isRetriableNetworkError(error) {
    if (!error) {
        return false;
    }

    if (error.name === "TypeError") {
        return true;
    }

    const message = String(error.message || "").toLowerCase();
    return message.includes("networkerror") || message.includes("failed to fetch");
}

async function fetchJsonWithTimeout(url, init, timeoutMs) {
    for (let attempt = 1; attempt <= MAX_429_RETRIES + 1; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
                headers: {
                    ...buildHeaders(),
                    ...(init.headers || {})
                }
            });

            if (response.status === 429) {
                const retryAfterRaw = response.headers.get("retry-after");
                const retryAfterMs = parseRetryAfterMs(retryAfterRaw);
                const fallbackBackoffMs = DEFAULT_429_WAIT_MS * attempt;
                const waitMs = Math.min(
                    MAX_RETRY_AFTER_MS,
                    retryAfterMs == null ? fallbackBackoffMs : retryAfterMs
                );

                if (attempt <= MAX_429_RETRIES) {
                    await sleep(waitMs);
                    continue;
                }

                const bodyText = await response.text().catch(() => "<no body>");
                throw new Error(
                    `HTTP 429 Too Many Requests from ${url}. Retry-After: ${retryAfterRaw || "unavailable"}. Body: ${bodyText.slice(0, 500)}`
                );
            }

            if (!response.ok) {
                const bodyText = await response.text().catch(() => "<no body>");
                throw new Error(
                    `HTTP ${response.status} ${response.statusText} from ${url}. Body: ${bodyText.slice(0, 500)}`
                );
            }

            const contentType = (response.headers.get("content-type") || "").toLowerCase();
            if (!contentType.includes("json")) {
                throw new Error(`Expected JSON response from ${url}, got content-type: ${contentType || "unknown"}`);
            }

            try {
                return await response.json();
            } catch (error) {
                throw new Error(`Failed parsing JSON from ${url}: ${error.message}`);
            }
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error(`Request timed out after ${timeoutMs} ms for ${url}`);
            }

            if (isRetriableNetworkError(error)) {
                const fallbackBackoffMs = DEFAULT_429_WAIT_MS * attempt;
                const waitMs = Math.min(MAX_RETRY_AFTER_MS, fallbackBackoffMs);

                if (attempt <= MAX_429_RETRIES) {
                    await sleep(waitMs);
                    continue;
                }

                throw new Error(
                    `Network error after ${MAX_429_RETRIES + 1} attempts for ${url}: ${error.message || String(error)}`
                );
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw new Error(`Unexpected retry loop termination for ${url}`);
}

function getNextLink(page) {
    const links = Array.isArray(page?.links) ? page.links : [];
    return links.find((link) => String(link.rel || "").toLowerCase() === "next");
}

function normalizeMethod(linkMethod) {
    const method = String(linkMethod || "GET").toUpperCase();
    return method === "POST" ? "POST" : "GET";
}

export async function searchStacByChunks({
    stacUrl,
    chunks,
    collections,
    stacPageLimit,
    maxItems,
    timeoutSeconds,
    maxQueryPoints,
    chunkToLineString,
    onProgress
}) {
    const timeoutMs = timeoutSeconds * 1000;
    const unique = new Map();

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const chunk = chunks[chunkIndex];
        if (chunk.length < 2) {
            continue;
        }

        const line = chunkToLineString(chunk, maxQueryPoints);
        const start = chunk[0].ts;
        const end = chunk[chunk.length - 1].ts;
        const datetime = `${toIsoZ(start)}/${toIsoZ(end)}`;

        let pageCount = 0;
        let nextRequest = {
            url: stacUrl,
            method: "POST",
            body: {
                collections,
                intersects: line.geometry,
                datetime,
                limit: stacPageLimit
            }
        };

        while (nextRequest && unique.size < maxItems) {
            pageCount += 1;

            await sleep(DEFAULT_REQUEST_DELAY_MS);

            const init = {
                method: nextRequest.method,
                headers: buildHeaders()
            };

            if (nextRequest.method === "POST") {
                init.body = JSON.stringify(nextRequest.body || {});
            }

            const page = await fetchJsonWithTimeout(nextRequest.url, init, timeoutMs);
            if (!page || typeof page !== "object" || !Array.isArray(page.features)) {
                throw new Error(
                    `Unexpected STAC response shape from ${nextRequest.url}: features is missing or not an array.`
                );
            }

            for (const feature of page.features) {
                if (!feature || typeof feature.id === "undefined" || feature.id === null) {
                    continue;
                }

                const key = String(feature.id);
                if (!unique.has(key)) {
                    unique.set(key, feature);
                }

                if (unique.size >= maxItems) {
                    break;
                }
            }

            const next = getNextLink(page);
            if (!next || unique.size >= maxItems) {
                nextRequest = null;
            } else {
                const method = normalizeMethod(next.method);
                const resolvedHref = new URL(next.href, nextRequest.url).toString();
                nextRequest = {
                    url: resolvedHref,
                    method,
                    body: method === "POST" ? next.body || {} : undefined
                };
            }

            if (typeof onProgress === "function") {
                onProgress({
                    chunkIndex: chunkIndex + 1,
                    totalChunks: chunks.length,
                    pageCount,
                    uniqueCandidates: unique.size
                });
            }

            await yieldToUI();
        }

        if (unique.size >= maxItems) {
            break;
        }
    }

    return Array.from(unique.values());
}
