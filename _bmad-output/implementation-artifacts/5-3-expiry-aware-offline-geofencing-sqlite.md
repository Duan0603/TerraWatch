---
baseline_commit: e622085
---
# Story 5.3: Expiry-aware offline geofencing

Status: ready-for-dev

## Story

As a Citizen,
I want my phone to warn me when I stand inside an approved forecast zone, even with no signal,
and to tell me plainly when its forecast data is out of date,
so that I am never alarmed by an expired forecast and never told I am "safe" by missing data.

**Epic:** Epic 5: Mobile and end-to-end verification
**Sprint key:** `5-3-expiry-aware-offline-geofencing-sqlite`
**Branches:** backend `feature/core-forecast-offline-sync` (new endpoint, 5.3 needs it and Thuận's `/forecasts` API does not exist yet), mobile `feature/mobile-offline-geofencing`.

## Acceptance Criteria

1. **AC1 — Sync API:** `GET /api/v1/forecasts/offline-sync` (any signed-in user; no token → 401) returns `{serverTime, items[]}`. Each item: `runId, unitId, unitVersion, hazardLevel (low|medium|high|extreme), probability, issuedAt, validFrom, validUntil (UTC ISO-8601), modelVersion, geometry (GeoJSON Polygon)`. Items are forecast runs with `review_status='approved'`, `is_active=true` and `valid_until > now`. Pending, rejected, superseded, inactive and already-expired runs are never returned. The gateway routes `/api/v1/forecasts`.
2. **AC2 — Local cache:** the phone stores per zone: run id, unit id, unit version, hazard level, probability, issued/valid-from/valid-until (UTC), model version, polygon, and a bounding box (indexed). A sync replaces the whole cache in one transaction (zones the server no longer lists — revoked, rejected or superseded — disappear), and `last_sync_at` is stored. A failed sync changes nothing.
3. **AC3 — Local geofencing:** given the GPS position, the app finds candidate zones by bounding box in SQLite, then decides with a point-in-polygon test (not a distance to a centre). Nothing is sent to the server; continuous GPS stays on the phone. A point exactly on an edge counts as inside.
4. **AC4 — Expiry-aware status:** the result is one of `warning` (inside at least one zone with `valid_from ≤ now < valid_until`; reports the highest hazard level and the soonest `valid_until`), `stale` (the cache has zones but none is currently valid, or it was never synced / last synced more than 24 h ago; says when the data expired or was last synced) or `none` ("no current warning"). The app never shows the words "safe" / "an toàn" as a conclusion. An expired zone never raises an alarm. Boundaries are tested: `now == valid_until` is expired, `now == valid_from` is valid; times compare in UTC and display in local time.
5. **AC5 — Alarm:** entering a `warning` zone triggers the existing emergency notification (sound/vibration within what the platform permits) once per zone per run (no repeat on every GPS fix). The app does not claim to override silent mode. Foreground monitoring only in this story.
6. **AC6 — Sync triggers and offline start:** the cache is synced on app start / resume when signed in and online; a failed or offline sync keeps the old cache (which then ages to `stale`). The app still starts and evaluates with a stored session and no network.
7. **AC7 — Screen:** a "Cảnh báo vị trí" screen (reachable from Home) shows the status card (warning / stale / none), the number of cached zones, `last_sync_at`, a "Đồng bộ" button and a "Kiểm tra vị trí" button (explicit GPS read). Text states that the position is evaluated on the phone.
8. **AC8 — Scale:** the test suite loads ≥ 10,000 zones into the cache and a lookup returns correctly; the measured time is reported in the completion notes (it is a capacity check, not an accuracy result).

## Tasks / Subtasks

- [x] **Task 1: Backend endpoint** (AC: #1) — `ForecastRepository` (JdbcTemplate), `ForecastOfflineSyncResponse`/item DTO, `ForecastController`, `SecurityConfig` (authenticated), gateway location, `AuthExceptionHandler` coverage; demo seed script `services/core-api/scripts/seed-demo-forecasts.sql`.
- [x] **Task 2: Backend tests** (AC: #1) — integration test with real PostGIS rows (current, upcoming, pending, rejected, superseded, inactive, unavailable, expired) and 401 without token; revoked run disappears from the next snapshot.
- [ ] **Task 3: Mobile data layer** (AC: #2, #8) — `ForecastZone` model, `ZoneStore` (SQLite `forecast_zones` + `last_sync_at`), `ForecastRepository.sync()` (full replace in a transaction).
- [ ] **Task 4: Geofencing logic** (AC: #3, #4, #5) — pure `GeofenceEvaluator` (injectable clock) using the existing `GeoMath.isPointInPolygon`; replaces the unused centroid-500 m `OfflineGeofencingService`.
- [ ] **Task 5: Screen and triggers** (AC: #5-#7) — `geofence_screen.dart`, Home entry, sync on start/resume in `MainShell`.
- [ ] **Task 6: Mobile tests and build** (AC: #3, #4, #8) — boundary / expiry / timezone / revocation / offline-keeps-cache / 10,000 zones; `flutter analyze`, `flutter test`, debug build.
- [ ] **Task 7: Real stack check** — seed demo zones, run the endpoint through the gateway, sync on a phone, stop the gateway, confirm warning and stale behaviour.

## Dev Notes

- **Data source decision:** the epic says "forecast geometry/run/version/validity". `core_schema.forecast_runs` (V3) already has `valid_from/valid_until`, `review_status` (`pending|approved|rejected|superseded`), `is_active`, `hazard_level`, `probability`, `model_version`; the polygon is the assessment unit's `geom` in `gis_schema.spatial_assessment_units`. The tables are **empty** today (the AI forecast writer is another story), so this story adds the read path and a demo seed script; it does not create forecasts. The legacy `GET /landslides/offline-sync` (verified incidents, no validity) is left untouched.
- **Reconciliation = full snapshot:** the server lists only currently valid approved runs, the phone replaces its cache with that list. This covers revocation and supersession with no tombstones. `shortcut:` full snapshot on every sync (about 1 KB per zone); move to `If-None-Match`/delta when the zone count makes it slow.
- **Existing code (read):** `apps/mobile/lib/services/geofencing_service.dart` has no callers and only measures distance to a centroid; `LocalStorage` runs `_createTablesIfNotExist` on every open, so adding a table needs no `dbVersion` bump (Story 5.2 owns that bump); `hazard_polygons` + `getHazardCount()` are used only by the Home counter; `GeoMath.isPointInPolygon(lat, lon, [[lon,lat],…])` exists and is not tested; `NotificationService.showEmergencyAlert` is the existing alarm.
- **Preserve:** HomeScreen's emergency listener (kept alive by `IndexedStack`), login/offline-start behaviour (Story 5.5 AC4), the Story 5.9 map (still uses `/landslides/active`).
- **"No warning" is not "safe":** wording is fixed by AC4 and PRD ("expired forecasts show stale status, not a fresh prediction or an all-clear").
- **Out of scope:** background/foreground-service monitoring while the app is closed, FCM push (Story 5.1), editing forecasts, per-user area filtering, map overlay of zones.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3]
- [Source: _bmad-output/planning-artifacts/prd.md (SQLite caches approved forecast geometry, issue/expiry, supersession; ≥ 10,000 geometries; expired = stale)]
- [Source: docs/API_SPECIFICATION.md `GET /api/v1/forecasts/offline-sync`]
- [Source: services/core-api/src/main/resources/db/migration/V3__rainfall_terrain_forecast_schema.sql]
- [Source: CONTRIBUTING.md#1] branch `feature/<role>-<feature-name>`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

### File List
