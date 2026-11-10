---
baseline_commit: 7373117
---
# Story 4.38: "Sạt lở đã xác nhận" map layer (real incidents next to the forecast)

Status: review

## Story

As an officer or admin,
I want to see on the map the landslides that were detected from satellite images and confirmed by an officer,
so that I can compare the AI forecast areas with real, verified incidents.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-38-confirmed-landslides-layer`
**Branch:** `feature/webgis-confirmed-landslides` (from main 7373117). Roadmap item "real-incident layer". No backend change: uses the existing `GET /api/v1/landslides/active` (verified events as GeoJSON).

## Acceptance Criteria

1. **AC1:** The dashboard loads the confirmed landslides with its other data (also on every refresh and live update). Empty, malformed or failed answers mean "no layer", never an error on screen.
2. **AC2:** When there is at least one, the map shows a button "Sạt lở đã xác nhận (N)". It is off at first. Switching it on shows the areas (fill + dashed outline, dark red/orange/amber by risk level) and a round dot at the centre of each (areas are only a few hundred metres wide and vanish when zoomed out), and flies the camera to frame them. Switching it off hides the layer.
3. **AC3:** Clicking an area or dot opens one popup: risk level, area in ha, slope, model confidence, satellite scene id, who/when verified (UTC+7). Text is set with `textContent`. The generic "TỌA ĐỘ ĐIỂM CHỌN" popup does not open on the same click.
4. **AC4:** The layer survives the satellite/terrain style switch and React StrictMode (click handler is bound once per map).
5. **AC5:** Unit tests for the helpers (`toConfirmedCollection`, `confirmedBounds`, `confirmedCentres`, `describeConfirmed`); e2e for the toggle and for a failing call. Live check with the real backend (2 confirmed points) done.

## Files

`api/landslideApi.js`, `utils/confirmedLandslides.js`, `hooks/useDashboardData.js` (+`confirmed`), `DashboardPage.jsx`, `DetailPanel.jsx`, `MapViewer.jsx`, `tests/test-confirmed-landslides.mjs`, `e2e/confirmed.spec.js`.

## Known limits

- Only verified events (`/active`). Pending or rejected events are not shown.
- Dev data has 2 verified seed events; the layer is only as good as the verification work behind it.
- The two seed points lie far from the demo zone, so the button flies there; the rain/evidence panels cover part of the map on a laptop screen.
- Drawing is checked by `queryRenderedFeatures` and screenshots, not by a pixel-exact test (map tiles are blocked in e2e).
