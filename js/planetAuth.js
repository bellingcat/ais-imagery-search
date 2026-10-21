const TOKEN_KEY = "planetAuth.accessToken";

function decodeJwtExpiryMs(token) {
    try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const exp = Number(JSON.parse(atob(payload)).exp);
        return Number.isFinite(exp) ? exp * 1000 : null;
    } catch {
        return null;
    }
}

export function setPlanetAccessToken(rawToken) {
    const token = String(rawToken || "").trim().replace(/^Bearer\s+/i, "");
    if (!token) {
        throw new Error("Paste a Planet access token first.");
    }

    const expiresAt = decodeJwtExpiryMs(token);
    if (expiresAt === null) {
        throw new Error("That doesn't look like a Planet access token. API keys are not accepted; use `planet auth print-access-token`.");
    }
    if (expiresAt <= Date.now()) {
        throw new Error("That Planet access token has already expired.");
    }
    sessionStorage.setItem(TOKEN_KEY, token);
}

export function getPlanetTokenExpiry() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return token ? decodeJwtExpiryMs(token) : null;
}

export function isPlanetAuthenticated() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
        return false;
    }
    const expiresAt = decodeJwtExpiryMs(token);
    if (expiresAt === null) {
        // Discard anything stored that isn't a valid access token (e.g. a key from an older version).
        clearPlanetAccessToken();
        return false;
    }
    return expiresAt > Date.now();
}

export function getPlanetAccessToken() {
    if (!isPlanetAuthenticated()) {
        throw new Error("Planet access token is missing or expired. Paste a new one.");
    }
    return sessionStorage.getItem(TOKEN_KEY);
}

export function planetAuthHeaders() {
    return { Authorization: `Bearer ${getPlanetAccessToken()}` };
}

export function clearPlanetAccessToken() {
    sessionStorage.removeItem(TOKEN_KEY);
}
