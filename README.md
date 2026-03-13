# AIS-STAC Browser Matcher

## Architecture note

Data flow mirrors the algorithm loop structure:

1. Parse AIS CSV rows into `{ lon, lat, ts }`, normalize `ts` to UTC `Date`, then sort by time.
2. Build query track with downsampling:
   - use all points when count <= `maxQueryPoints`
   - else sample by `step = ceil((n - 1) / (maxQueryPoints - 1))`
   - always include final AIS point
3. Split query points into chronological chunks by `chunkDays`.
4. For each chunk, call STAC `/search` with POST and `intersects + datetime + collections + limit`.
5. Follow pagination via `next` links (GET or POST), dedupe globally by `feature.id`, and stop at `maxItems`.
6. For each deduped candidate, apply first-match shortlist logic:
   - derive feature time window from `datetime` or `start_datetime/end_datetime`
   - for each AIS point, build clamped temporal window and test overlap
   - on temporal pass, run spatial intersection with point or approximate meter buffer
   - on first hit, record matched AIS point and include feature
7. Render AIS track and matched footprints on MapLibre.
8. Export shortlist rows as JSON or CSV.

## Run

Open `index.html` in a modern browser, or serve this directory with a static file server.

Example:

```bash
npx serve .
```

## Dependencies (CDN)

- maplibre-gl 4.7.1
- papaparse 5.4.1
- @turf/helpers 7.2.0
- @turf/boolean-intersects 7.2.0
