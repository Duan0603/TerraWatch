---
baseline_commit: 9b790f8
---
# Story 4.39: Fixes for the confirmed-landslides layer (code review of 4.38)

Status: review

## Story

As an officer or admin,
I want the confirmed-landslides layer to survive bad data and a bad minute on the network, and to stay visible above the forecast areas,
so that I can trust it when I compare real incidents with the AI forecast.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-39-confirmed-layer-fixes`
**Branch:** `feature/webgis-confirmed-fixes` (from main 9b790f8). Source: `/code-review high` on Story 4.38.

## Acceptance Criteria

1. **AC1 (validation):** `toConfirmedCollection` keeps only Polygon/MultiPolygon features whose coordinates are finite `[lon, lat]` numbers and that have properties. Empty geometry, `null`/text coordinates, points and empty rings are dropped, so the count, `fitBounds` and `confirmedCentres` cannot throw.
2. **AC2 (order):** the confirmed layers are added after the forecast layers and moved to the top when forecast layers are added later, so a confirmed incident inside a forecast zone is not dimmed. Verified on the live map before and after the satellite style switch.
3. **AC3 (failure):** a failed call keeps the previous data (layer and toggle stay). The previous object is kept when the new data is identical, so the map is not redrawn.
4. **AC4 (refetch):** the data is requested at most every 5 minutes, not on every 60 s refresh or live update. A manual refresh reloads the queue only.
5. **AC5 (tidy):** one colour constant for fill and dot; `WeakSet` and layer list at module level (no allocation per render); popup wording "Cực nguy hiểm" now matches `RISK_LABELS` in `EventCard.jsx`.
6. **AC6 (tests):** unit test with 9 broken/valid shapes; e2e for broken geometry and for "manual refresh does not re-download". All 25 e2e pass.

## Not changed (decision for the team)

`GET /api/v1/landslides/active` is public (no login), also used by the mobile offline sync. Left as it is; tighten it only if the team agrees the data is not meant for citizens.

## Known limits

- Layer drawing and popup are checked by hand/screenshots and `getStyle().layers`; tiles are blocked in e2e so there is no automated pixel test.
- Verified events appear within 5 minutes unless the page is reloaded; the verify endpoint does not publish a live update.
