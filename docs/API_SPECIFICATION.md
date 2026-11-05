# GeoSentry API — existing prototype and target forecast contract

**Updated:** 2026-10-13. New forecast endpoints below are **planned, not implemented**. The pivot does not silently change existing runtime requests.

## 1. Existing prototype

| Service | Route | Current meaning |
| --- | --- | --- |
| Core :3000 | GET /api/v1/landslides/queue | Pending incident records from PostGIS. |
| Core | PATCH /api/v1/landslides/{id}/verify | Change an incident's review state. |
| Core | GET /api/v1/landslides/active | Incident GeoJSON. |
| Core | GET /api/v1/landslides/geofence | Server-side spatial query; not the target continuous citizen tracking flow. |
| Core | GET /api/v1/landslides/offline-sync | Legacy incident export without the new forecast contract. |
| AI :8001 | POST /api/v1/inference | Legacy bbox call. A bbox carries no imagery, so it returns `status: no_imagery` and no polygon (the old simulation was removed). |
| AI | POST /api/v1/inference/scene | Landslide candidates (GeoJSON schema 2.0) from post/pre GeoTIFFs inside `SCENE_DIR`, model v1.0 ONNX. Candidates need human verification; not 24h forecasting. |
| AI | GET /api/v1/models/info | Reads `model_card.json` (modes, std floor, metrics) and checks the ONNX sha256. `ready: false` until the model files are installed. |
| GIS :8002 | POST /api/v1/gis/query-satellite | Fixed sample scene response. |
| GIS | POST /api/v1/gis/tiling | Geographic grid generation, not rainfall feature engineering. |
| GIS | GET /api/v1/gis/mvt/{z}/{x}/{y}.pbf | Empty tile prototype. |

Auth and SMS/FCM are not completed. Existing Swagger is served by each service; the target contract below must be implemented and tested before clients depend on it.

## 2. Planned endpoints

| Access | Route | Purpose |
| --- | --- | --- |
| Internal GIS | POST /api/v1/gis/feature-snapshots | Build an immutable as-of rainfall/terrain snapshot for a unit. |
| Internal AI | POST /api/v1/forecasts | Evaluate a validated snapshot for the next 24h. |
| Core officer/admin | POST /api/v1/forecasts | Persist a job to compute/recompute an eligible forecast. |
| Core officer/admin | GET /api/v1/forecasts/queue | Review forecast proposals with quality/validity. |
| Core officer/admin | PATCH /api/v1/forecasts/{id}/review | Approve/reject a warning proposal, not an event occurrence. |
| Core authorized clients | GET /api/v1/forecasts/active | Published, approved and currently valid forecast geometries. |
| Core authorized clients | GET /api/v1/forecasts/offline-sync | **Implemented (Story 5.3).** Signed-in users; full snapshot `{serverTime, items[]}` of approved, active, available, unexpired runs with Polygon geometry and UTC validity. A run no longer listed was revoked or superseded: clients replace their cache. |

The AI and Core share a route name on different hosts. Public /api/v1/forecasts targets Core. If internal AI routing uses the current gateway prefix rewrite, /api/v1/ai/forecasts maps to AI /api/v1/forecasts; service authentication/network restriction is required. The gateway now routes /api/v1/forecasts to Core (added with offline-sync).

Existing auth, reports, subscriptions/device and alert capabilities remain required; see PRD/epics for implementation status. Forecast/incident coexistence is intentional.

## 3. Snapshot and time requirements

GIS snapshot fields: snapshot_id, schema_version, assessment_unit_id, assessment_unit_version, as_of, source records/revisions, terrain version, required feature values/units, coverage, quality and effective resolution.

Each observation records interval_start/end, available_at and ingested_at. Each weather forecast also records provider_issued_at and provider_run_id. Reject incompatible units/geometry/schema or source information unavailable at as_of. A delayed observation is not evidence of dry weather.

The model manifest identifies its required feature schema. The endpoint consumes a snapshot reference; services resolve it through authenticated internal access. Clients do not supply arbitrary probabilities or identity fields.

## 4. AI request (illustrative contract)

```json
{
  "schema_version": "rainfall-terrain-24h.v1",
  "snapshot_id": "snapshot-example",
  "assessment_unit_id": "unit-example",
  "assessment_unit_version": "grid-v1",
  "issued_at": "2026-10-13T06:00:00Z",
  "horizon_hours": 24,
  "model_version": "baseline-experimental-v1"
}
```

All identifiers and values here are examples, not deployed records. The horizon is fixed at 24; valid_from equals issued_at and valid_until is 24h later.

## 5. Result envelope

```json
{
  "schema_version": "rainfall-terrain-24h.v1",
  "forecast_id": "forecast-example",
  "snapshot_id": "snapshot-example",
  "assessment_unit_id": "unit-example",
  "assessment_unit_version": "grid-v1",
  "issued_at": "2026-10-13T06:00:00Z",
  "valid_from": "2026-10-13T06:00:00Z",
  "valid_until": "2026-10-14T06:00:00Z",
  "horizon_hours": 24,
  "availability": "unavailable",
  "reason_codes": ["MODEL_NOT_RELEASED"],
  "probability": null,
  "experimental_score": null,
  "hazard_level": null,
  "model_version": null,
  "threshold_version": null,
  "input_quality": {
    "status": "not_evaluated",
    "latest_observation_end": null,
    "weather_provider_run_id": null,
    "spatial_resolution_m": null
  },
  "factors": [],
  "review_status": "not_applicable"
}
```

For an available result, provide factors with names, values and units plus actual version identifiers. A calibrated released model may populate probability in [0,1]; an uncalibrated baseline may populate experimental_score in [0,1] with its version/meaning explicitly documented. Do not present both as interchangeable. Hazard levels use versioned validation thresholds.

Availability, review state and expiry are separate: an available historical result can be expired. Core attaches assessed unit geometry as GeoJSON; geometry does not represent an observed landslide footprint. Exposure/priority is a separate optional object and cannot modify occurrence probability.

## 6. Review, alerts and offline synchronization

- Review body: decision (approved/rejected), reason. Authenticated identity is server-derived; reject stale/superseded/nonreviewable records with conflict.
- Existing incident verification stays distinct. A forecast-based warning references forecast_id/unit version and valid interval; a manually authored warning records its own justification/validity.
- Broadcast preview and send use admin authorization, subscription-based recipients, stable idempotency key and explicit confirmation; no score-triggered automatic sending.
- Offline response is a complete snapshot for the requested subscriptions, with generated_at, sync_id, features and revocations/supersessions. Apply atomically and reconcile records missing from that subscription snapshot.
- Features include run/unit/window/quality, review/publication state and geometry. Expired data is stale, never automatically safe.
- Delivery acceptance, provider response and actual delivery confirmation are distinct states.

## 7. Errors and validation (target)

| Condition | Contract |
| --- | --- |
| Missing/invalid auth or role | 401 / 403 as applicable. |
| Malformed values, unsupported horizon/schema, reversed time range | 422 with field details. |
| Unknown snapshot/unit | 404. |
| Conflicting duplicate key, expired review | 409. |
| Valid request but required rainfall stale/missing | Structured unavailable result with null probability/level and reason. |
| Model unavailable or dependency outage | 503; persist failed/retryable job state if a job exists, do not fabricate a forecast. |

For asynchronous Core creation, return 202 with persisted job ID; repeat same idempotency key returns the same job, conflicting payload yields 409. Internal AI inference is synchronous; Core owns job retries.

Before rollout: implement new migrations/routes/model loading; update clients and gateway together; add contract tests; keep/deprecate legacy inference explicitly. Do not write new forecast meaning into existing landslide_events.

[PRD](../_bmad-output/planning-artifacts/prd.md) · [Architecture](../_bmad-output/planning-artifacts/architecture.md)
