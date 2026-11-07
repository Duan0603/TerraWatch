---
baseline_commit: a0525dd
---
# Story 4.11: Admin monitoring area (AOI) management

Status: review

## Story

As an admin,
I want to create, edit and deactivate monitoring areas,
so that forecasts and alerts target the areas the project really watches.

**Epic:** Epic 4: Forecast orchestration, WebGIS and warnings
**Sprint key:** `4-11-aoi-management`
**Origin:** merged in PR #60 (`9730afb`) without a story file. Written after the fact on 2026-11-07 from the code and the live review of `main` a0525dd; fixes found in that review are in Stories 4.7-4.9.

## Acceptance Criteria

1. `POST /monitoring-areas` and `PUT /monitoring-areas/{id}` are admin only (officer 403); `GET` stays public for the map and the app.
2. An area has a unique name (migration V10); a duplicate name gives 409.
3. The WebGIS "Vùng giám sát" modal lists areas and creates or edits one from a name, a description and a GeoJSON polygon typed as JSON (quick presets included).
4. Not delivered: drawing a polygon on the map (the commit message says "drawing", the screen is a JSON editor).

## Where it lives

`MonitoringAreaController`, `MonitoringAreaService`, `SpatialRepository.updateMonitoringArea`, `AoiManagementModal.jsx`, `forecastApi.js`.

## Tests and known gaps

`BroadcastAdminApiTest.onlyAnAdminCreatesAreasAndADuplicateNameIsAConflict`. Gaps: no test for PUT, none for invalid GeoJSON in the UI.
