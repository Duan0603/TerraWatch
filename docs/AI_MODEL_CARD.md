# Model Card — GeoSentry Rainfall–Terrain 24h Hazard

**Updated:** 2026-10-13
**Status:** design / untrained / not validated.
**Intended task:** predict rainfall-triggered landslide occurrence within a versioned spatial unit during the next 24 hours.
**Owner:** Duẫn (AI), with Tú (data/GIS).
**Released model, dataset version and calibrated thresholds:** none.

## 1. Task and scope

The owner selected a 24-hour MVP. Inputs combine rainfall history, issued precipitation forecasts and terrain. Predictions support officer review and admin warnings; they do not confirm that an event occurred, locate a precise landslide scar or determine an exact failure time.

`services/ai-service` no longer contains the old slope/NDVI formula or synthetic polygon. It runs a different model: the frozen DeepLabV3+ scar-segmentation model, whose output is candidates for human review (see `services/ai-service/models/model_card.json`). The old fixed F1/IoU values were never evaluation results and were removed. No trained rainfall/terrain model is supplied in this revision.

## 2. Scientific reference and data candidates

NASA's LHASA work combines rainfall and environmental susceptibility variables. Its forecasting extension explicitly introduces precipitation forecasts and evaluates against event inventories. This supports the research direction; it does not validate GeoSentry or guarantee transfer to Vietnam. [NASA LHASA forecasting research](https://ntrs.nasa.gov/citations/20220008839)

| Need | Candidate and selection condition |
| --- | --- |
| Recent rainfall | A licensed local gauge/radar source if accessible, or NASA GPM IMERG. Check local bias, missingness and availability timestamps. |
| Future rainfall | An issued forecast provider such as ECMWF Open Data; historical as-issued runs must be obtainable for backtesting. |
| Terrain | DEM (SRTM or another documented source); verify coverage, CRS, nodata and derived slope/relief. |
| Labels | A curated inventory with occurrence times/intervals, locations/uncertainty and provenance; validate candidate local/national/global records before use. |
| Optional covariates | Soil moisture, geology and land cover, each with a measured incremental benefit and as-of availability. |

IMERG estimates are available at half-hour cadence, but Early Run has approximately four-hour latency. Products differ in processing and units: mm/h rates and mm accumulations are not interchangeable. It is rainfall estimation, not next-day weather forecasting. [NASA IMERG documentation](https://gpm.nasa.gov/data/imerg)

ECMWF's open subset is generally distributed at 0.25-degree resolution. The public rolling store retains recent runs, so historical archive access must be established separately before a historical forecasting experiment. [ECMWF Open Data](https://www.ecmwf.int/en/forecasts/datasets/open-data)

Providers/AOI are candidates, not contracted integrations. Fine DEM pixels do not imply equally fine rainfall information or location accuracy.

## 3. Features and output

Candidate features: supported historical rainfall totals (1/3/6/24/72h and 7d), antecedent rainfall index, next-24h forecast accumulation and available forecast intensity summaries; slope, elevation and relief. Do not require 1h features from a provider that cannot support them.

Every feature set includes input snapshot/schema, source versions, issue/valid/available times, unit geometry/version, resolution and quality/coverage. Missing observations are not zeros. Observation-to-issue latency must be explicitly modeled or flagged.

Output: run/unit/window, hazard level, contributing factors, quality, model/threshold versions. A calibrated model may output landslide probability; an uncalibrated baseline supplies an explicitly experimental score. Invalid inputs produce unavailable with null probability/level. Exposure/population is a separate prioritization layer.

## 4. Training and evaluation plan

1. Audit labels; distinguish occurrence date from reporting date. Exclude or explicitly handle ambiguous timing/geometry. Missing reports alone are not reliable negative labels.
2. Build reproducible unit–issue-time examples and targets for [t,t+24h). Join only inputs available by t, including archived weather forecasts.
3. Reserve held-out storms/time periods and spatial areas. Group overlapping windows and correlated samples to avoid leakage. Fit preprocessing only on training data.
4. Establish an interpretable rainfall/terrain baseline. Compare a tabular ML candidate (for example gradient-boosted trees); select complexity from evidence.
5. Calibrate/select thresholds on validation data. Agree minimum event recall and maximum false-alarm burden before final testing, then freeze decisions.
6. Evaluate event recall, precision, PR-AUC, false alarms per area/time, lead time and calibration/Brier where applicable. Report event/sample counts, split details and uncertainty; explain the mapping from unit predictions to event-level metrics.
7. Test on data-source latency/missingness representative of operation. Do not replace unavailable historical forecasts with realized future rain and label the result a forecasting benchmark.

Using revised/reanalysis data to explore associations is permissible only when clearly labeled retrospective; it is not evidence of as-issued 24-hour forecast skill. Approval of a warning is not a positive landslide label. Feature importance explains model behavior, not causation.

## 5. Current results and release gate

| Item | Current status |
| --- | --- |
| Pilot inventory and forecast archive | Not selected/verified |
| Baseline and candidate trained artifacts | Not available |
| Recall, precision, PR-AUC, false alarms, lead time | Not measured |
| Calibration and numeric release thresholds | Not set |
| Batch latency and supported hardware | Not measured |

Release requires versioned dataset/splits, archived-input feasibility, a reproducible evaluation report, agreed quality limits, a baseline comparison and expiry/outage tests. Previous F1=0.768, IoU=0.642 and inference speed claims from the segmentation design are withdrawn as project evidence.

## 6. Limitations and operation

Rainfall/terrain alone do not encode every trigger, ground condition or human alteration. Unsupported regions or data conditions must be marked explicitly. A 24-hour window does not imply a 24-hour guaranteed warning lead time.

Show valid_until and last sync in clients; offline cached predictions can expire and cannot receive revisions while disconnected. Preserve current manual warning/review workflows.

[PRD](../_bmad-output/planning-artifacts/prd.md) · [Architecture](../_bmad-output/planning-artifacts/architecture.md) · [API contract](API_SPECIFICATION.md)
