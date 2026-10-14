# GeoSentry — Epics and User Stories

**Revised:** 2026-10-13 | **MVP:** rainfall + terrain, next 24 hours.

[PRD](prd.md) and [architecture](architecture.md) define the target. Story numbers are retained for traceability; changed sprint keys map to the same numbers. These criteria describe future implementation, not completed features. Re-estimate the original five-week schedule after data feasibility. Roles remain admin/officer/citizen.

## Epic 1: Foundation, identity and forecast data contracts

### Story 1.1: Multi-role registration and JWT

**Owner:** Thuận; Huy, Lâm
**Sprint key:** 1-1-multi-role-user-registration-authentication-register-login-jwt

Users authenticate with role-specific access.

**Acceptance criteria:**
- Register defaults to citizen with BCrypt; only admin assigns privileged roles.
- Login/Me return identity from a validated JWT; protected endpoints reject invalid tokens with 401 and insufficient roles with 403.
- Keep the existing ready-for-dev story; align route checks with new forecast endpoints.

### Story 1.2: PostGIS forecast and observation schema

**Owner:** Tú, Thuận
**Sprint key:** 1-2-postgis-schema-per-service-migration-spatial-indexes

Engineers can retain separate predictions, observed incidents and source snapshots.

**Acceptance criteria:**
- Add new migrations for rainfall, terrain, assessment units, feature snapshots, forecast runs and reviews; preserve V1/V2 and historical incidents.
- Store source/availability/issue/valid times, quality, versions, geometry and idempotency constraints; index spatial and time queries.
- Include existing planned subscriptions, device tokens, broadcasts/deliveries; seed explicitly synthetic forecast fixtures.

### Story 1.3: Gateway routing and access

**Owner:** Thuận
**Sprint key:** 1-3-api-gateway-reverse-proxy-rate-limiting

Clients access Core consistently through port 8080.

**Acceptance criteria:**
- Route auth, existing incidents and new /api/v1/forecasts explicitly; test direct versus gateway paths.
- Enforce intended role/service access and CORS; retain rate limiting.
- Keep internal forecast/ingestion mutation endpoints off public unauthenticated routes.

## Epic 2: Rainfall, terrain and historical evidence

### Story 2.1: Observed and forecast rainfall ingestion

**Owner:** Tú
**Sprint key:** 2-1-rainfall-observation-forecast-ingestion

Data engineers obtain rainfall with trustworthy provenance and timing.

**Acceptance criteria:**
- Select pilot/source candidates after verifying access, license, units, latency, coverage and historical forecast archives.
- Persist observations and forecasts separately, including provider run, valid interval, available_at, ingestion time and revision.
- Normalize mm and accumulated fields safely, detect duplicate/revised/late records and missing intervals; do not fill gaps with zero.
- Refresh when a qualifying provider run is available; missing archive data blocks claims of forecast validation.

### Story 2.2: DEM terrain and assessment units

**Owner:** Tú
**Sprint key:** 2-2-dem-terrain-feature-extraction

AI receives versioned terrain features for spatial units.

**Acceptance criteria:**
- Derive slope, elevation and relief using appropriate metric distances; validate nodata and CRS.
- Version geometry/DEM/features and retain source/effective resolutions; agree unit scale with label and rain coverage.
- Optional soil/geology/land-cover layers require provenance and a separately evaluated feature schema.

### Story 2.3: As-of feature snapshots

**Owner:** Tú, Duẫn
**Sprint key:** 2-3-as-of-rainfall-terrain-feature-snapshots

Training and inference use the same time/space alignment.

**Acceptance criteria:**
- Compute supported antecedent rainfall windows and next-24-hour forecast accumulation; record required coverage and quality.
- Require source availability <= prediction issue time; handle observation latency, forecast cycles and resets explicitly.
- Publish immutable snapshot/schema/unit versions; missing required inputs yield unavailable.
- Provide known-value tests for rainfall totals, timestamp boundaries and forecast interval selection.

### Story 2.4: Field reports and event inventory

**Owner:** Thuận, Tú, Duẫn; Lâm
**Sprint key:** 2-4-community-field-report-api-gps-photo-upload

Officers can use field observations as evidence and curate labels.

**Acceptance criteria:**
- Retain photo/GPS report API, authenticated identity, occurrence time/interval, reported_at and provenance.
- Review location/time uncertainty and deduplicate events; forecast approval alone is not a positive label.
- Define reliable negative/background sampling and ambiguous-event policy; missing reports are not automatically confirmed non-events.

## Epic 3: 24-hour forecasting and measured model quality

### Story 3.1: Historical dataset and baseline

**Owner:** Duẫn, Tú
**Sprint key:** 3-1-historical-dataset-and-rainfall-terrain-baseline

The team establishes a reproducible forecast baseline.

**Acceptance criteria:**
- Define the label as occurrence within a versioned unit during [issued_at, issued_at+24h).
- Create a dataset/split manifest with archived as-issued inputs and a documented label uncertainty policy.
- Implement an interpretable rainfall/terrain baseline; no future observed rain used as a substitute for a weather forecast.
- Separate storms/time periods and spatial groups; account for overlapping windows across splits.

### Story 3.2: Candidate model and backtesting

**Owner:** Duẫn
**Sprint key:** 3-2-24h-model-training-calibration-and-backtesting

The team chooses a model from measured results.

**Acceptance criteria:**
- Compare a tabular ML candidate such as gradient-boosted trees against the baseline on identical held-out evaluation units.
- Tune/calibrate on validation data only; freeze thresholds before final testing.
- Report event recall, precision, false-alarm burden, PR-AUC, probability calibration/Brier where applicable and lead time with sample counts/uncertainty.
- Agree numeric release targets before final test; do not reuse old segmentation F1/IoU or call an uncalibrated score a probability.

### Story 3.3: Versioned forecast inference

**Owner:** Duẫn, Thuận
**Sprint key:** 3-3-versioned-24h-forecast-inference-contract

Core can request a reproducible prediction for 24 hours.

**Acceptance criteria:**
- Validate feature/schema/unit/model versions and horizon_hours=24; use the new contract in docs/API_SPECIFICATION.md.
- Return issue/valid times, run/snapshot/model/threshold versions, factors and calibrated probability or explicitly experimental score.
- Unavailable/stale inputs or unloaded/incompatible model return structured non-prediction states, never fabricated low hazard.
- Measure batch latency on named hardware; persist results against assessed unit geometry, not a generated landslide scar.

### Story 3.4: Hazard levels and quality policy

**Owner:** Duẫn, Tú, Thuận
**Sprint key:** 3-4-hazard-levels-explanations-and-quality-policy

Officers understand the score and its limits.

**Acceptance criteria:**
- Version level thresholds selected from validation and the agreed missed-event/false-alarm tradeoff.
- Separate occurrence hazard from population/exposure-based warning priority.
- Expose contributing input factors, freshness and quality; no causal or certainty claim from feature importance.
- Define expiry/supersession and unavailable handling for all consumers.

## Epic 4: Forecast orchestration, WebGIS and warnings

### Story 4.1: Persisted orchestration and resilience

**Owner:** Thuận; Duẫn, Tú
**Sprint key:** 4-1-persisted-forecast-jobs-redis-events-resilience

Forecast generation recovers from lost notifications and service outages.

**Acceptance criteria:**
- Persist forecast jobs before optional Redis wakeups; recovery polling resumes pending jobs after restart.
- Use idempotency keys and bounded timeout/retry for REST; Redis Pub/Sub alone is not a durable job queue.
- Persist result before HAZARD_FORECAST_READY notification; distinguish unavailable/failed from low hazard.
- Align Docker REDIS_HOST/REDIS_PORT with Spring configuration and test source/AI/Redis outage paths.

### Story 4.2: Forecast review queue

**Owner:** Huy, Thuận
**Sprint key:** 4-2-webgis-forecast-review-queue

Officers review warning proposals without declaring an incident occurred.

**Acceptance criteria:**
- List hazard level, window, rain history/forecast, terrain, factors, quality and data age.
- Approve/reject with authenticated reviewer and reason; protect against expired/superseded forecast review.
- Keep observed incidents and field reports separate; approval never becomes training truth.
- Link approved high/extreme proposals to the admin alert form without automatically sending.

### Story 4.3: Rainfall, terrain and forecast dashboard

**Owner:** Huy; Tú
**Sprint key:** 4-3-rainfall-terrain-24h-hazard-dashboard

Officers inspect the evidence behind a 24-hour forecast.

**Acceptance criteria:**
- Render real AOI/assessment geometry, terrain, hazard and field-report layers.
- Show observed-versus-forecast rainfall charts and issued/valid timestamps with timezone; compare forecast runs.
- Render missing/stale/expired states distinctly; state effective resolution rather than imply pixel-level precision.
- Replace the old before/after imagery requirement; keep map rendering responsive with measured performance.

### Story 4.4: Admin SMS/FCM broadcast

**Owner:** Thuận, Huy, Lâm
**Sprint key:** 4-4-admin-emergency-alert-broadcast-sms-app-push-notification

Admin can warn subscribed residents after an explicit decision.

**Acceptance criteria:**
- Admin-only preview/broadcast with two-step confirmation, channels, message limit/templates and scope by approved unexpired forecast, incident, AOI or all subscribers.
- Persist broadcast and delivery tasks, bounded retries, deduplication, actor and forecast validity/reference; distinguish provider accepted versus delivered.
- Select recipients by subscriptions; never require continuous citizen GPS.
- Allow a separately justified manual alert during forecast outages; measure 30s Push / 60s SMS submission targets under documented conditions.

## Epic 5: Mobile and end-to-end verification

### Story 5.1: Subscriptions and notification reception

**Owner:** Lâm, Thuận
**Sprint key:** 5-1-citizen-alert-subscription-emergency-alert-reception-push-sms

Citizens receive warnings for registered interest areas.

**Acceptance criteria:**
- Register phone/areas and device token; show alert history and forecast issue/expiry times.
- Handle duplicates, updates and superseded/revoked messages on resync.
- Test platform notification/audio permissions; SMS still requires cellular service and provider delivery.

### Story 5.2: Mobile field reports

**Owner:** Lâm, Thuận
**Sprint key:** 5-2-mobile-community-field-report-photo-gps

Citizens submit observed evidence with explicit location sharing.

**Acceptance criteria:**
- Photo, GPS, observed time/interval and description; preserve report status.
- Queue offline and retry with stable report IDs; distinguish event time from upload time.

### Story 5.3: Expiry-aware offline geofencing

**Owner:** Lâm
**Sprint key:** 5-3-expiry-aware-offline-geofencing-sqlite

Citizens can inspect cached hazards without mistaking old forecasts for current ones.

**Acceptance criteria:**
- Cache geometry/run/version/validity and last sync; test at least 10,000 geometries.
- Run geofencing locally; stale forecasts are not used as fresh predictions or an all-clear.
- Test boundary/expiry/timezone, offline-to-online sync and supersession/revocation reconciliation.
- Continuous GPS stays local; support audio/vibration within platform permissions.

### Story 5.4: 24-hour end-to-end demo

**Owner:** All five members
**Sprint key:** 5-4-24h-forecast-end-to-end-integration-demo

The team demonstrates traceable forecasts and warning behavior.

**Acceptance criteria:**
- Demonstrate data snapshot → AI → persisted forecast → officer review → admin SMS/FCM → mobile validity-aware display.
- Label fixtures as synthetic; demonstrate real provider integration and held-out model evidence separately.
- Exercise missing/stale rain, unavailable forecast, failed delivery, duplicate job, expired offline cache and reconnect.
- Publish actual test/latency results and remaining limitations; no simulated provider result presented as real delivery.

## Epic 6: Post-MVP model/data improvements

### Story 6.1: Optional local soil-moisture/IoT observations

**Owner:** Tú, Duẫn
**Sprint key:** 6-1-esp32-iot-slope-monitoring-station-vibration-soil-moisture-mqtt

Add local measurements only after data quality and incremental benefit are demonstrated.

**Acceptance criteria:**
- Version inputs and evaluate against the MVP baseline before changing release features.

### Story 6.2: Optional SAR and additional susceptibility features

**Owner:** Tú, Duẫn
**Sprint key:** 6-2-sentinel-1-sar-radar-ingestion-cloud-penetration-rainy-typhoons

Evaluate additional evidence after the rainfall/terrain MVP.

**Acceptance criteria:**
- Document acquisition latency, as-of availability and held-out incremental value.

### Story 6.3: Additional horizons and uncertainty

**Owner:** Duẫn, Tú
**Sprint key:** 6-3-multiple-horizons-and-forecast-uncertainty

Extend beyond the agreed 24-hour window only after separate validation.

**Acceptance criteria:**
- Treat 6h/72h as new targets with separate labels, calibration and metrics; not part of MVP.
- Former antecedent rainfall Story 6.3 moved to Stories 2.1/2.3/3.1.

## Epic 7: Performance and audit improvements

### Story 7.1: Spatial/query performance

**Owner:** Tú, Thuận
**Sprint key:** 7-1-postgis-spatial-partitioning-province-tile-caching

Optimize measured bottlenecks.

**Acceptance criteria:**
- Benchmark forecast reads/cache invalidation and spatial queries before adding partitioning.

### Story 7.2: Extended audit and reproducibility

**Owner:** Thuận
**Sprint key:** 7-2-comprehensive-verification-alert-audit-trail-event-sourcing

Review historical model and delivery decisions.

**Acceptance criteria:**
- Basic audit is required in MVP; extend retention/search/replay as needed, without requiring full event sourcing.

## Epic 8: Pilot and capstone evidence

### Story 8.1: Pilot evaluation

**Owner:** All five members
**Sprint key:** 8-1-real-world-early-warning-pilot-test-lao-cai-yen-bai

Evaluate an agreed region without overstating coverage.

**Acceptance criteria:**
- Select the AOI based on data access; northern Vietnam locations remain candidates.
- Run shadow evaluation and document missed events, false alarms and lead time before operational claims.

### Story 8.2: Thesis, demo and presentation

**Owner:** All five members
**Sprint key:** 8-2-capstone-thesis-documentation-demo-video-slide-deck

Present the implemented system and measured evidence accurately.

**Acceptance criteria:**
- Regenerate historical DOCX/PPTX/video/materials for the rainfall/terrain scope; mark older artifacts superseded.
- Distinguish planned, mocked and implemented functionality and disclose dataset/model limitations.
