---
baseline_commit: 5c0efac
---
# Story 5.9: Mobile hazard map

Status: review

## Story

As a Citizen,
I want to see the verified landslide areas on a real map on my phone, styled like the WebGIS,
so that I can see where the danger is around me.

**Epic:** Epic 5: Mobile and end-to-end verification
**Sprint key:** `5-9-mobile-hazard-map`
**Target app:** `apps/mobile/`, branch `feature/mobile-map` (independent of the profile branches).
**Backend:** none new; uses the existing `GET /api/v1/landslides/active` (GeoJSON, same as WebGIS).

## Acceptance Criteria

1. **AC1 — Real map:** the Map tab shows a MapLibre map using the same MapTiler `topo-v2` style as the WebGIS. Without a key it falls back to the free OpenFreeMap style and says so.
2. **AC2 — Satellite:** an app-bar button toggles the MapTiler satellite style; without a key it explains that the key is missing instead of failing. The hazard layers are redrawn after a style change.
3. **AC3 — Hazards:** verified areas from `/api/v1/landslides/active` are drawn as fill + outline, coloured by `risk_level` with the WebGIS colours (extreme `#ef4444`, high `#f97316`, medium `#eab308`, else `#10b981`). The status card shows the real count, a load error with a retry, or a loading state. The camera fits the polygons once they load.
4. **AC4 — Details:** tapping an area opens a sheet with risk level, confidence, slope, area (ha or m²), verification date and scene id; fields the server does not send are skipped.
5. **AC5 — My location:** the location button asks for permission, shows the blue dot and moves the camera to the current position; denial or failure shows a message. Location stays on the phone.
6. **AC6 — Config:** the MapTiler key comes from `--dart-define=MAPTILER_KEY=...`; it is never written to the repo.

## Tasks / Subtasks

- [x] **Task 1: Dependency and config** (AC: #1, #2, #6) — `maplibre_gl`, `AppEnv.mapTilerKey/topoStyleUrl/satelliteStyleUrl`, Android location permissions.
- [x] **Task 2: Data** (AC: #3, #4) — `HazardRepository`, `HazardInfo` (labels, colours, area/date display), `hazardBounds`.
- [x] **Task 3: Screen** (AC: #1-#5) — rewritten `map_screen.dart` (replaces the static mock from the design branch).
- [x] **Task 4: Tests and build** — `test/map_test.dart` (7 tests); `flutter analyze` clean, `flutter test` 23/23, `flutter build apk --debug` succeeds with the native plugin.

## Dev Notes

- Response shape verified against the live server: FeatureCollection of MultiPolygons with properties `event_id, risk_level, confidence, slope, area_m2, scene_id, verified_at`.
- Run with the key: `--dart-define=MAPTILER_KEY=<key>` (keep it out of git; restrict or revoke the key after the defence).
- **Deferred:** 3D terrain/tilt like the WebGIS (needs a terrain source in the style; verify plugin support), offline tiles, clustering and filters, community-report markers.
- The plugin is native; first Android build is slower.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

- Not verified on a phone: map rendering, tapping a polygon, satellite switch and the location button (build, analyzer and unit tests only).
- Whether `onStyleLoadedCallback` fires again after a style switch (assumed so that the layers are redrawn) must be checked on a device.

### File List

- apps/mobile/pubspec.yaml, pubspec.lock (maplibre_gl)
- apps/mobile/android/app/src/main/AndroidManifest.xml (location permissions)
- apps/mobile/lib/core/config/env.dart
- apps/mobile/lib/features/map/data/hazard_models.dart (new), hazard_repository.dart (new)
- apps/mobile/lib/features/map/presentation/map_screen.dart
- apps/mobile/test/map_test.dart (new)
- _bmad-output/implementation-artifacts/5-9-mobile-hazard-map.md, sprint-status.yaml
