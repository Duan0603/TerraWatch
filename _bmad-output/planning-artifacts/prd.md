# Product Requirements Document — GeoSentry (TerraWatch)

**Version:** 5.0.0 | **Updated:** 2026-10-13

## 1. Product decision

Predict rainfall-triggered landslide hazard for the **next 24 hours**, combining recent rainfall, forecast rainfall and terrain. The owner requested this change from image segmentation and confirmed the 24-hour MVP horizon on 2026-10-13.

The system answers: **Which monitored areas are more likely to experience a rainfall-triggered landslide during the next 24 hours, and what evidence supports a warning?**

The AI consumes rainfall estimates/observations and weather forecasts; developing a weather forecasting model is outside the MVP. “Most accurate” means selecting the best validated approach on the pilot data, with measured missed events and false alarms, not guaranteeing that a landslide will or will not occur.

**Status:** target specification. Current AI/GIS and clients are prototypes. This documentation change does not deliver a trained model or operational rainfall integration.

## 2. Scope and users

| Role | Responsibilities |
| --- | --- |
| admin | Manage users/AOIs; approve and send emergency warnings. |
| officer | Inspect forecasts, quality and field evidence; review warning proposals and observed incidents. |
| citizen | Subscribe to areas, receive alerts, submit reports and use offline geofencing. |

MVP: one pilot AOI, one rainfall observation/estimate source, one forecast source, DEM terrain features, a baseline and candidate ML model, WebGIS review, SMS/FCM and expiry-aware mobile warnings. The AOI/providers remain to be selected after checking access, coverage and historical data. Existing northern Vietnam seed locations are examples, not a validated pilot.

Deferred: Sentinel-2 segmentation, before/after imagery, 128×128 spectral tensors, mask polygonization, SAR, IoT deployment and multiple prediction horizons. Rescue dispatch, SOS and other disaster types remain outside scope. Antecedent rainfall moves from former Story 6.3 into the MVP.

## 3. Prediction semantics

- Predict at least one rainfall-triggered landslide in a versioned assessment unit during the UTC interval [issued_at, issued_at + 24 hours). This is not an exact failure time, detected footprint or runout estimate.
- Store issued_at, valid_from, valid_until, horizon_hours=24, input snapshot, spatial-unit version, model version and threshold version. Preserve each run.
- Valid outputs include a hazard level (low/medium/high/extreme) and supporting factors. Publish probability only for a model with documented calibration; label any uncalibrated output an experimental score.
- Invalid, missing, stale or unsupported inputs return unavailable with a reason and null probability/level. Missing rainfall is never zero rainfall or evidence of low hazard.
- Settlement proximity/population may prioritize warning delivery; keep exposure separate from landslide occurrence probability.
- Geometry is the area assessed, not a claim that a landslide has occurred throughout that polygon.

## 4. Functional requirements

### FR1 — Rainfall and terrain monitoring

- Configure AOIs and versioned assessment units; record source and effective spatial resolution.
- Store rainfall observations/estimates with source, units, interval start/end, availability time, ingestion time, quality and revision.
- Store forecast rainfall separately with provider run/issue time and forecast valid intervals. Use only information available by prediction issue time.
- Candidate history features: supported 1/3/6/24/72-hour and 7-day rainfall totals plus antecedent rainfall index. Derive next-24-hour forecast rainfall; choose final features through validation.
- Require complete temporal coverage for each feature. Handle accumulated-field differencing, run resets and unit conversions; do not fabricate hourly observations from coarse forecasts.
- Derive slope, elevation and local relief from a DEM with valid metric-distance calculations. Optional soil moisture, geology and land cover require availability and validation.
- Configure source-specific freshness limits; recompute on qualifying new weather runs. Record gaps and revisions rather than silently filling them with zeros.

### FR2 — Forecast model and evaluation

- Build a historical inventory with occurrence time/interval, spatial uncertainty and provenance, separately from report arrival time.
- Join terrain, historical rainfall and archived weather forecasts as available at each simulated issue time. Future observed rainfall cannot substitute for an archived forecast when claiming forecast performance.
- Compare an interpretable rainfall/terrain baseline with a tabular ML candidate such as gradient-boosted trees. Model choice remains conditional on measured results.
- Hold out time periods/storms and spatial areas; prevent overlapping storm windows and neighboring correlated samples from leaking across splits.
- Tune/calibrate on validation data, freeze thresholds, then evaluate once on the final test set.
- Report event recall, precision, false alarms, PR-AUC, calibration/Brier score where applicable and warning lead time, with sample counts and uncertainty.
- Record data, feature, model and threshold versions. Previous segmentation F1/IoU numbers are not acceptance evidence.

### FR3 — WebGIS review

- Show forecast units/window, observed versus forecast rain, terrain, data age/quality and contributing factors.
- An officer approves a warning proposal, not the occurrence of a landslide. Approval must not automatically create a positive training label.
- Keep observed incidents and community reports as distinct evidence layers; record authenticated reviewer identity and audit history.
- Clearly mark unavailable, expired and superseded forecasts. Retain past runs for evaluation.
- Replace satellite before/after comparison with rainfall history/forecast charts and forecast-run comparison.

### FR4 — Admin emergency alerts

- Only admin may broadcast; other roles receive 403. Scope may reference approved unexpired forecast units, a confirmed incident with configured buffer, AOIs or all subscribers.
- SMS, FCM or both; templates, severity, two-step confirmation and recipient preview. Retain the existing 160-character application limit while accounting for provider encoding/segmentation.
- Select recipients from registered interest areas, not continuous citizen GPS tracking. Preserve scope, forecast/incident references, actor and message.
- Persist delivery tasks/results per recipient/channel; bounded retry and idempotency. Distinguish provider acceptance from confirmed device delivery.
- AI scores never send emergency messages automatically. Admin-authored warnings are possible when forecasts are unavailable, with reason and evidence recorded.
- Retain delivery targets: Push within 30 seconds and SMS gateway submission within 60 seconds after confirmation, measured with provider/device conditions.

### FR5 — Mobile and offline behavior

- Authentication, subscriptions, device tokens and explicit photo/GPS reports; offline report queue with stable IDs.
- SQLite caches approved forecast geometry, issue/expiry times and supersession metadata. Test capacity with at least 10,000 geometries; this is not an accuracy result.
- Geofencing runs locally. Expired forecasts show stale status, not a fresh hazard prediction or an all-clear.
- Offline devices cannot receive new forecasts or revocations until reconnected; display last sync and reconcile on reconnect.
- Audio/vibration follows supported OS permissions; verify behavior on target devices rather than guaranteeing silent-mode override.
- Continuous location stays on-device; coordinates sent with a field report are an explicit user action.

## 5. Acceptance and release

| Area | Evidence required |
| --- | --- |
| Data feasibility | Dated event inventory, coverage/uncertainty assessment, historical weather forecast availability and pilot AOI decision. |
| Model quality | Reproducible baseline/candidate comparison, temporal/spatial split manifest, event recall and false-alarm analysis; no unsupported accuracy percentage. |
| Release threshold | Agree numeric minimum recall and maximum false-alarm burden before final testing. Candidate must satisfy these and improve the chosen primary metric over baseline. Until then, experimental only. |
| Performance | Measure ingestion-to-publication and batch latency on named hardware; remove per-image speed claims. |
| Reliability | Test stale/missing/revised data, expiry, provider outage, restart/retry, duplicate delivery, unauthorized access and offline resync. |

Missing reports are not automatically trustworthy negative labels. Ambiguous occurrence dates/locations require an explicit exclusion or uncertainty policy.

## 6. Owners and sequencing

| Owner | Revised focus |
| --- | --- |
| Duẫn — AI | Labels, baseline, candidate model, calibration, backtesting, prediction service. |
| Tú — GIS/Data | Rainfall observations/forecasts, DEM features, spatial/time alignment, quality, snapshots. |
| Thuận — Backend | Auth, distinct forecast/incident storage, review, scheduling/retry, delivery and audit. |
| Huy — WebGIS | Rainfall/terrain dashboard, forecast validity, review and alert controls. |
| Lâm — Mobile | Subscriptions, expiring offline cache, notifications, field reports. |

The previous five-week schedule is a planning envelope: (1) data feasibility/auth/contracts, (2) ingestion/features/labels, (3) baseline/model/backtest, (4) review/delivery, (5) integration and demo. Re-estimate after archive/label access is established. If data is insufficient, present an experimental monitoring/baseline demo, not a validated forecast product.

## 7. References

[Architecture](architecture.md) · [Epics](epics.md) · [Change analysis](sprint-change-proposal-2026-10-13.md) · [Model card](../../docs/AI_MODEL_CARD.md) · [API contract](../../docs/API_SPECIFICATION.md)
