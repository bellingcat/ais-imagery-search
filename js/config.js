export const DEFAULTS = {
    stacUrl: "https://catalogue.dataspace.copernicus.eu/stac/search",
    collections: ["sentinel-2-l2a"],
    lonColumn: "Lng",
    latColumn: "Lat",
    timeColumn: "Date/Time",
    temporalBufferMinutes: 30,
    spatialBufferMeters: 0,
    timeoutSeconds: 30,
    chunkDays: 3,
    maxQueryPoints: 120,
    stacPageLimit: 100,
    maxItems: 1200
};

export const PLANET = {
    // Planet Data API STAC service (beta).
    searchUrl: "https://api.planet.com/x/data/search",
    // Planet's CQL2 rejects `datetime`; acquisition time is filtered as `acquired`.
    timeProperty: "acquired",
    segmentMinutes: 60,
    maxPointsPerSegment: 20,
    collections: {
        planetscope: "PSScene",
        skysat: "SkySatScene",
        pelican: "PelicanScene"
    }
};

export const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
