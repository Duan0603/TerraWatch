---
baseline_commit: e622085
---
# Story 5.3: Expiry-aware offline geofencing

Status: review

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
4. **AC4 — Expiry-aware status:** the result is one of `warning` (inside at least one zone with `valid_from ≤ now < valid_until`; reports the highest hazard level and the soonest `valid_until`), `stale` or `none` ("no current warning"). `stale` when, and only when, there is no valid zone at the position and: the cache was never synced, or last synced more than 24 h ago, or the position is inside an expired zone, or every cached zone has expired. Otherwise `none`. A valid zone still raises the alarm when the last sync is older than 24 h (a missed alarm is worse than a possibly revoked one; the screen shows the sync time). The app never shows "safe" / "an toàn" as a conclusion and says "this is not a safety confirmation". An expired zone never raises an alarm. Boundaries: `now == valid_until` is expired, `now == valid_from` is valid; instants are UTC, shown in local time.
5. **AC5 — Alarm:** a `warning` raises the existing emergency notification (`NotificationService.showEmergencyAlert`: sound and vibration within what the platform permits, no claim to override silent mode) once per forecast run, not on every GPS fix. A switch on the screen follows the GPS (a fix every 25 m) while the screen is open; the position is only evaluated on the phone. Monitoring while the app is in the background or closed is out of scope.
6. **AC6 — Sync triggers and offline start:** the cache is synced on app start / resume when signed in and online; a failed or offline sync keeps the old cache (which then ages to `stale`). The app still starts and evaluates with a stored session and no network.
7. **AC7 — Screen:** a "Cảnh báo vị trí" screen (reachable from Home) shows the status card (warning / stale / none), the number of cached zones, `last_sync_at`, a "Đồng bộ" button and a "Kiểm tra vị trí" button (explicit GPS read). Text states that the position is evaluated on the phone.
8. **AC8 — Scale:** the test suite loads ≥ 10,000 zones into the cache and a lookup returns correctly; the measured time is reported in the completion notes (it is a capacity check, not an accuracy result).

## Tasks / Subtasks

- [x] **Task 1: Backend endpoint** (AC: #1) — `ForecastRepository` (JdbcTemplate), `ForecastOfflineSyncResponse`/item DTO, `ForecastController`, `SecurityConfig` (authenticated), gateway location, `AuthExceptionHandler` coverage; demo seed script `services/core-api/scripts/seed-demo-forecasts.sql`.
- [x] **Task 2: Backend tests** (AC: #1) — integration test with real PostGIS rows (current, upcoming, pending, rejected, superseded, inactive, unavailable, expired) and 401 without token; revoked run disappears from the next snapshot.
- [x] **Task 3: Mobile data layer** (AC: #2, #8) — `ForecastZone` model, `ZoneStore` (SQLite `forecast_zones` + `last_sync_at`), `ForecastRepository.sync()` (full replace in a transaction).
- [x] **Task 4: Geofencing logic** (AC: #3, #4, #5) — pure `GeofenceEvaluator` (injectable clock) using the existing `GeoMath.isPointInPolygon`; replaces the unused centroid-500 m `OfflineGeofencingService`.
- [x] **Task 5: Screen and triggers** (AC: #5-#7) — `geofence_screen.dart`, Home entry, sync on start/resume in `MainShell`.
- [x] **Task 6: Mobile tests and build** (AC: #3, #4, #8) — boundary / expiry / timezone / revocation / offline-keeps-cache / 10,000 zones; `flutter analyze`, `flutter test`, debug build.
- [ ] **Task 7: Real stack check** — seed demo zones (done), call the endpoint through the gateway (done); sync on a phone, stop the gateway, confirm warning and stale behaviour (pending).

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

- Backend `GET /api/v1/forecasts/offline-sync` implemented on `feature/core-forecast-offline-sync` (this branch is stacked on it). Core API suite 40/40 (3 new in `ForecastApiTest`). Verified through the rebuilt gateway with a real user: no token → 401; with the demo seed only `DEMO_NOW` is returned (expired and pending runs are not), instants end in `Z`, geometry is a closed Polygon.
- Mobile: `flutter analyze` clean, `flutter test` 62/62 (new: `offline_geofence_test.dart`, `zone_store_sqlite_test.dart` using `sqflite_common_ffi`, added as a dev dependency). Covers polygon edge/vertex, `valid_until`/`valid_from` boundaries to the millisecond, `+07:00` vs `Z`, 24 h sync age, revocation, offline keeps the cache, malformed payload rejected whole, alarm once per run, screen states and the absence of the word "safe".
- AC8 capacity check (desktop SQLite via ffi, not a phone): 10,000 zones written in 418 ms, one point decision (bbox query + polygon test) in 9 ms. Capacity only, not an accuracy result.
- Decisions: warning wins over a stale sync (a valid zone alarms even if the last sync is older than 24 h); "inside an expired zone" is its own stale reason; a malformed item rejects the whole sync so the previous cache survives; the phone clock is trusted for expiry (`shortcut`, no server-time offset yet).
- Replaced the unused centroid-500 m `OfflineGeofencingService` and the always-green "Đang hoạt động" Home card (green read as "safe"). `hazard_polygons` is left in the schema untouched (old installs keep an empty table).
- GPS: `currentPosition()` waits 30 s and falls back to a last known fix of at most 10 minutes.
- Not verified: a phone run (GPS permission flow, real alarm sound/vibration, `adb reverse` sync, stopping the gateway), `flutter build apk`, and the position-stream switch (no automated test; the explicit check path is tested). Demo data only: the forecast tables are empty until the AI forecast writer exists.

### File List

- services/core-api: `ForecastController`, `ForecastService`, `ForecastRepository`, `ForecastZoneResponse`, `ForecastOfflineSyncResponse`, `SecurityConfig`, `ForecastApiTest`, `scripts/seed-demo-forecasts.sql`; gateway/nginx.conf
- apps/mobile/lib/features/geofence/data: `forecast_zone.dart`, `zone_store.dart`, `forecast_repository.dart`, `geofence_evaluator.dart`, `device_location.dart`; presentation/`geofence_screen.dart`
- apps/mobile/lib: `core/utils/geo_math.dart`, `core/storage/local_storage.dart`, `core/constants/api_endpoints.dart`, `features/home/presentation/home_screen.dart`, `main_shell.dart`; removed `services/geofencing_service.dart`
- apps/mobile: `pubspec.yaml`, `pubspec.lock` (sqflite_common_ffi dev), `test/offline_geofence_test.dart`, `test/zone_store_sqlite_test.dart`
- _bmad-output/implementation-artifacts: this story, `sprint-status.yaml`

### Review Findings (bmad-code-review, 2026-10-30)

Scope: `main...feature/mobile-offline-geofencing` (27 files, ~1,800 lines) against this story. The three layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) were run inline by the author's session, not by independent subagents, so treat this as a self-review and ask a teammate for a second pair of eyes.

Fixed in this branch:
- **[High] Silent alarm on Android 13+:** `POST_NOTIFICATIONS` was declared but never requested, and `showEmergencyAlert` swallows the error, so a warning would show no notification. Added `NotificationService.requestPermission()`, called when the citizen checks the position or switches monitoring on.
- **[Medium] Reuse miss:** the existing `LocationService.checkAndRequestPermission()` (checks GPS service + permission) was reimplemented; `device_location.dart` now uses it.
- **[Medium] Monitoring switch could stay on after an error** (no permission, GPS off): the stream now checks permission first and a stream error switches the monitor off and shows the reason.
- **[Low]** unexpected local-data errors (SQLite) were unhandled in button handlers → generic message; `getHazardCount` renamed `getZoneCount` (it counts zones now); misleading epsilon comment corrected; `docs/API_SPECIFICATION.md` marks offline-sync as implemented and the gateway route as added.

Accepted / deferred (not bugs for this story):
- Phone clock is trusted for expiry and sync age (`shortcut`: use `serverTime` offset later).
- Full-snapshot sync is unbounded (~0.5 KB/zone, gzip is already on at the gateway); add delta/ETag if zone count grows.
- Holes in polygons are ignored; assessment units are simple Polygons.
- The alarm de-duplication set is in memory, so a restart may ring once more for the same run.
- Background/closed-app monitoring is out of scope (needs a foreground service and background-location consent).
- If the notification permission is denied the in-app card still shows the warning but no system alarm rings.

Open: Task 7 phone run. Status stays `review` until the phone check is done.

### Post-merge fix: the alarm had no siren (2026-10-30, branch `feature/mobile-emergency-siren`)

Phone test (Xiaomi): the zone warning appeared and the first report was "no siren". The notification had been posted on `emergency_channel` (importance 5, vibration) but its sound was only the system default notification tone (`content://settings/system/notification_sound`), and `assets/sounds` holds no siren file. A siren was added, **but it was not the reason for the first silence**: the tester had not enabled notifications for the app on the phone. After enabling them the siren was heard. So two things were true: (1) app notifications must be allowed in Android settings (Android 13+ also asks at runtime; MIUI can block them separately), and (2) the old channel only had a "ting".
- Added `android/app/src/main/res/raw/emergency_siren.wav` (8 s, 700-1300 Hz sweep, generated, no third-party audio) and `keep.xml` so release shrinking does not drop it.
- `showEmergencyAlert` now uses a new channel `emergency_alarm` (an Android channel's sound cannot be changed after creation) with that sound, `AudioAttributesUsage.alarm` (alarm stream) and `AndroidNotificationCategory.alarm`. The same path serves the Story 5.1 emergency broadcast.
- **Verified on a phone:** siren audible once notifications were enabled. Not compared against the old "ting" channel on the same device.
- Limits: the alarm stream volume is separate from media/ringer volume and may be low; Do-Not-Disturb can still mute it; the sound plays once for 8 s (not looping); `FSI_REQUESTED_BUT_DENIED` on Android 14 only affects a full-screen pop-up, not the sound. The app does not yet tell the citizen when notifications are blocked (possible follow-up).
