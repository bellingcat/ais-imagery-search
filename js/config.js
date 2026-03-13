export const DEFAULTS = {
    stacUrl: "https://catalogue.dataspace.copernicus.eu/stac/search",
    collections: ["sentinel-2-l2a"],
    lonColumn: "lon",
    latColumn: "lat",
    timeColumn: "timestamp",
    temporalBufferMinutes: 30,
    spatialBufferMeters: 0,
    timeoutSeconds: 30,
    chunkDays: 3,
    maxQueryPoints: 120,
    stacPageLimit: 100,
    maxItems: 1200
};

export const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
