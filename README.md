# AIS Imagery Search

<a href="https://www.bellingcat.com"><img alt="Bellingcat logo: Discover Bellingcat" src="https://img.shields.io/badge/Discover%20Bellingcat-%20?style=for-the-badge&logo=data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAAA4AAAAYCAYAAADKx8xXAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9TS0UqDnZQEcxQneyiIo6likWwUNoKrTqYXPoFTRqSFBdHwbXg4Mdi1cHFWVcHV0EQ%2FABxdnBSdJES%2F5cUWsR4cNyPd%2Fced%2B8AoVllqtkTA1TNMtKJuJjLr4rBVwQwhhBEDEvM1JOZxSw8x9c9fHy9i%2FIs73N%2Fjn6lYDLAJxLHmG5YxBvEs5uWznmfOMzKkkJ8Tjxp0AWJH7kuu%2FzGueSwwDPDRjY9TxwmFktdLHcxKxsq8QxxRFE1yhdyLiuctzir1Tpr35O%2FMFTQVjJcpzmKBJaQRIo6klFHBVVYiNKqkWIiTftxD%2F%2BI40%2BRSyZXBYwcC6hBheT4wf%2Fgd7dmcXrKTQrFgcCLbX%2BMA8FdoNWw7e9j226dAP5n4Err%2BGtNYO6T9EZHixwBA9vAxXVHk%2FeAyx1g6EmXDMmR%2FDSFYhF4P6NvygODt0Dfmttbex%2BnD0CWulq%2BAQ4OgYkSZa97vLu3u7d%2Fz7T7%2BwHEU3LHAa%2FQ6gAAAAZiS0dEAAAAAAAA%2BUO7fwAAAAlwSFlzAAAuIwAALiMBeKU%2FdgAAAAd0SU1FB%2BgFHwwiMH4odB4AAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAA50lEQVQ4y82SvWpCQRCFz25ERSJiCNqlUiS1b5AuEEiZIq1NOsGXCKms0wXSp9T6dskDiFikyiPc%2FrMZyf3FXSGQ0%2BzuzPl2ZoeVKgQ0gQ2wBVpVHlcDkjM5V%2FJ5nag6sJ%2FZX%2Bh%2FC7gEhqeAFKf7p1M9aB3b5oN1OomB7g1axUBPBr3GQHODHmOgqUF3MZAzKI2d4LWBV4H%2BMXDuJd1a7Cew1k7SwksaHC4LqNaw7aeX9GWHXkC1G1sTAS17Y3Kk2lnp4wNLiz0DrgLq8qt2MfmSSabAO%2FBBXp26dtrADPjOmN%2BAUdG7B3cE61l5hOZiAAAAAElFTkSuQmCC&logoColor=%23fff&color=%23000"></a><!--
--><a href="https://discord.gg/bellingcat"><img alt="Discord logo: Join our community" src="https://img.shields.io/badge/Join%20our%20community-%20?style=for-the-badge&logo=discord&logoColor=%23fff&color=%235865F2"></a><!--
--><a href="https://bellingcat.github.io/ais-imagery-search/"><img alt="Right arrow icon: Try out the tool" src="https://img.shields.io/badge/Try%20out%20the%20tool-%20?style=for-the-badge&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB3aWR0aD0iMTg1Ljk5ODQ2bW0iCiAgIGhlaWdodD0iMTYyLjM5MjY3bW0iCiAgIHZpZXdCb3g9IjAgMCAxODUuOTk4NDYgMTYyLjM5MjY2IgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmcxIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIxLjMuMiAoMDkxZTIwZSwgMjAyMy0xMS0yNSwgY3VzdG9tKSIKICAgc29kaXBvZGk6ZG9jbmFtZT0iQXJyb3dzLnN2ZyIKICAgeG1sbnM6aW5rc2NhcGU9Imh0dHA6Ly93d3cuaW5rc2NhcGUub3JnL25hbWVzcGFjZXMvaW5rc2NhcGUiCiAgIHhtbG5zOnNvZGlwb2RpPSJodHRwOi8vc29kaXBvZGkuc291cmNlZm9yZ2UubmV0L0RURC9zb2RpcG9kaS0wLmR0ZCIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzdmc9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8c29kaXBvZGk6bmFtZWR2aWV3CiAgICAgaWQ9Im5hbWVkdmlldzEiCiAgICAgcGFnZWNvbG9yPSIjMDAwMDAwIgogICAgIGJvcmRlcmNvbG9yPSIjMDAwMDAwIgogICAgIGJvcmRlcm9wYWNpdHk9IjAuMjUiCiAgICAgaW5rc2NhcGU6c2hvd3BhZ2VzaGFkb3c9ImZhbHNlIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwLjAiCiAgICAgaW5rc2NhcGU6cGFnZWNoZWNrZXJib2FyZD0idHJ1ZSIKICAgICBpbmtzY2FwZTpkZXNrY29sb3I9IiNkMWQxZDEiCiAgICAgaW5rc2NhcGU6ZG9jdW1lbnQtdW5pdHM9Im1tIgogICAgIHNob3dib3JkZXI9ImZhbHNlIgogICAgIGJvcmRlcmxheWVyPSJmYWxzZSIKICAgICBpbmtzY2FwZTp6b29tPSIxLjAyNDI2MzIiCiAgICAgaW5rc2NhcGU6Y3g9IjIzNi43NTU1NSIKICAgICBpbmtzY2FwZTpjeT0iMjk0LjM1NzkzIgogICAgIGlua3NjYXBlOndpbmRvdy13aWR0aD0iMTkyMCIKICAgICBpbmtzY2FwZTp3aW5kb3ctaGVpZ2h0PSIxMDA5IgogICAgIGlua3NjYXBlOndpbmRvdy14PSItOCIKICAgICBpbmtzY2FwZTp3aW5kb3cteT0iLTgiCiAgICAgaW5rc2NhcGU6d2luZG93LW1heGltaXplZD0iMSIKICAgICBpbmtzY2FwZTpjdXJyZW50LWxheWVyPSJsYXllcjEiIC8+CiAgPGRlZnMKICAgICBpZD0iZGVmczEiIC8+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoOC42MjMyNDYzLDExLjIwNTAwMSkiPgogICAgPHBhdGgKICAgICAgIGlkPSJwYXRoMSIKICAgICAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7ZmlsbC1vcGFjaXR5OjE7c3Ryb2tlLXdpZHRoOjAuMjMwNDI2IgogICAgICAgZD0iTSAtOC42MjMyNDYzLC0xMS4yMDUwMDEgQyAtMy40Njg3NzA4LDIuODM2ODQyNSAxLjY2NzQxOCwxNi44ODU0MDEgNi44MTA0MzcsMzAuOTMxNDQ1IDI1LjQxNTIzMyw0My45NTQyMjQgNDQuMDIwMzIsNTYuOTc3MDg4IDYyLjYyNTExOCw2OS45OTk4NjIgNDQuMDIwMzIsODMuMDIyNjM2IDI1LjQxNTIzMyw5Ni4wNDU0OTggNi44MTA0MzcsMTA5LjA2ODI4IDEuNjc2NTA0NCwxMjMuMTA4MjcgLTMuNDU4Nzc2MywxMzcuMTQ4MDYgLTguNTkzNzkwNywxNTEuMTg3NjcgMzAuMDYxNTczLDEyNC4xMjM5OSA2OC43MTg5MDksOTcuMDYyNzMzIDEwNy4zNzQ4NCw2OS45OTk4NjIgNjguNzA5MTMyLDQyLjkzMTE0OCAzMC4wNDIwMzMsMTUuODY0MzI3IC04LjYyMzI0NjMsLTExLjIwNTAwMSBaIG0gNzAuMDAwMzc4MywwIEMgNjYuNTMxNTIyLDIuODM2ODExMSA3MS42NjczNDQsMTYuODg1NDQgNzYuODEwMjk5LDMwLjkzMTQ0NSA5NS40MTUwOTQsNDMuOTU0MjI0IDExNC4wMjAxOCw1Ni45NzcwODggMTMyLjYyNDk4LDY5Ljk5OTg2MiAxMTQuMDIwMTgsODMuMDIyNjM2IDk1LjQxNTA5NCw5Ni4wNDU0OTggNzYuODEwMjk5LDEwOS4wNjgyOCA3MS42NzYzNjYsMTIzLjEwODI3IDY2LjU0MTA4NSwxMzcuMTQ4MDYgNjEuNDA2MDcxLDE1MS4xODc2NyAxMDAuMDYxNDMsMTI0LjEyMzk5IDEzOC43MTkyOSw5Ny4wNjI3MzMgMTc3LjM3NTIyLDY5Ljk5OTg2MiAxMzguNzA5NTEsNDIuOTMxMTQ4IDEwMC4wNDI0MSwxNS44NjQzMjcgNjEuMzc3MTMyLC0xMS4yMDUwMDEgWiIKICAgICAgIHNvZGlwb2RpOm5vZGV0eXBlcz0iY2NjY2NjY2NjY2NjY2MiIC8+CiAgPC9nPgo8L3N2Zz4K&logoColor=fff&color=e8710a"></a>

This project lets you search Sentinel and Landsat imagery using AIS ship tracking data.

It returns results where the footprint of the satellite imagery overlaps with the ships approximate location at the capture time.

The main limitation is that you must bring your own AIS data to use the tool.

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

## Planet search

PlanetScope (`PSScene`), SkySat (`SkySatScene`) and Pelican (`PelicanScene`) scenes are searched via the Planet Data API's beta STAC service (`https://api.planet.com/x/data/search`, see https://docs.planet.com/develop/apis/data/stac/) using a Planet access token pasted into the app.

- Get an access token from the Planet CLI (`planet auth login`, then `planet auth print-access-token`) The token is kept in session storage for the current tab only and must be replaced when it expires.

## Run

Open `index.html` in a modern browser, or serve this directory with a static file server.

Example:

```bash
npx serve .
```

## Dependencies (CDN)

- maplibre-gl 4.7.1
- pmtiles 3.2.1
- papaparse 5.4.1
- @turf/helpers 7.2.0
- @turf/boolean-intersects 7.2.0
