# TerraWatch Mobile Offline Geospatial Math & Geofencing Verification

## 1. Purpose

The mobile client (`apps/mobile`) performs local point-in-polygon checks against SQLite-cached hazard zones (`ForecastZone`) so citizens receive emergency alerts when entering a hazardous perimeter even without network connectivity.

---

## 2. Algorithms (`GeoMath`)

Implemented in `apps/mobile/lib/core/utils/geo_math.dart` using Earth radius $R = 6{,}371{,}000\text{ m}$ (`AppConstants.earthRadiusMeters`):

1. **Haversine Distance (`calculateDistanceMeters`):**
   - Computes great-circle surface distance between `(lat1, lon1)` and `(lat2, lon2)` in meters without network geocoding.
2. **Ray-Casting (`isPointInPolygon`):**
   - Evaluates interior containment against polygon vertices ordered as `[lon, lat]`.
3. **Boundary-Inclusive Ray-Casting (`isPointInOrOnPolygon`):**
   - Uses a cross-product bounding-box tolerance $\epsilon = 10^{-12}$ ($\sim 10\,\mu\text{m}$ over a $1\text{ km}$ edge) before falling back to `isPointInPolygon`, ensuring GPS points lying directly on zone edges or vertices evaluate inside.

---

## 3. Offline Expiry & Staleness Safeguards (`GeofenceEvaluator`)

Evaluated locally in `apps/mobile/lib/features/geofence/data/geofence_evaluator.dart`:
- Cached active hazard zones (`status == GeofenceStatus.warning`) always trigger alerts ahead of staleness banners so no active risk is suppressed.
- Sync age exceeding `GeofenceEvaluator.maxSyncAge` (24 hours) or missing sync state degrades safely to `GeofenceStatus.stale` rather than reporting a false-safe zone.

---

## 4. Verification

```bash
cd apps/mobile
flutter test test/geo_math_test.dart test/primary_button_test.dart test/offline_geofence_test.dart
```
