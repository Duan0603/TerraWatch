# Sprint Change Proposal — Rainfall and Terrain Forecasting

**Date:** 2026-10-13
**Project:** GeoSentry / TerraWatch
**Classification:** major product/AI replan, retaining the existing service stack.
**Direction authorization:** owner requested rainfall + terrain prediction; owner explicitly selected the next 24 hours.
**This deliverable:** revised planning documents and implementation handoff. Runtime/model implementation remains backlog. Provider, pilot AOI, model family and numeric release thresholds are not yet selected or approved as final choices.

## 1. Trigger and evidence

The owner changed the AI objective from satellite-image landslide segmentation to rainfall monitoring combined with terrain for prediction. The prior PRD v4, Epic 2/3 and model card described DeepLabV3+, spectral tensors and mask polygons. Actual inference code remains a slope/NDVI heuristic with synthetic geometry; GIS returns sample scenes; WebGIS/mobile are prototypes. This makes the pivot feasible without discarding a trained production model, but does not eliminate data engineering and validation work.

The product now predicts occurrence within a monitored spatial unit during [issued_at, issued_at+24h). The actual warning lead time must be measured, not assumed equal to the horizon.

## 2. Impact and old → new proposals

| Artifact/section | Previous direction | Revised direction and reason |
| --- | --- | --- |
| PRD FR1 | Sentinel-2 ingestion, cloud masking and image patches | Observed/estimated rain, issued weather forecasts, DEM terrain and as-of snapshots; supports a future window. |
| PRD FR2 | DeepLabV3+ segmentation and F1/IoU | 24h occurrence model, baseline comparison, event recall/false alarms/calibration and lead time; measures the new target. |
| PRD FR3 | Approve detected landslide polygons | Review forecast-based warning proposals; keep confirmed incidents separate to avoid false ground truth. |
| PRD FR4 / mobile | Broadcast/cached hazard polygons | Retain admin SMS/FCM and subscriptions; add forecast references, validity, stale-data behavior and sync reconciliation. |
| Architecture | Scene → mask → polygon → incident | Rain + terrain → snapshot → forecast run → review → warning. Add forecast records beside incident records. |
| API | Scene ID, bbox, NDVI, synthetic detection | Separate planned snapshot/forecast endpoints with issue/valid time, quality, unit/model versions and unavailable result. |
| WebGIS | Satellite before/after imagery | Observed/forecast rainfall charts, terrain, hazard window and data freshness. |
| Model card | Claimed segmentation benchmark/speeds | Explicitly untrained/unvalidated forecast model; data candidates, leakage-safe evaluation and release evidence. |
| README/member plans | Image-centric assignment and finished-sounding claims | Forecast scope, actual prototype status and canonical story assignments. |

### Story mapping

Story numbers remain stable; sprint keys change only where the meaning changes. No completed status is assigned by this documentation update.

| Stories | Old → new |
| --- | --- |
| 1.1 | Auth/JWT retained; existing ready-for-dev story retained. |
| 1.2–1.3 | Spatial DB/gateway → add forecast storage and explicit new routing, retaining existing functionality. |
| 2.1 | Sentinel ingestion/cloud mask → rain observation/forecast ingestion. |
| 2.2 | DEM + before/after NDVI → versioned terrain and spatial assessment units. |
| 2.3 | 128×128 patch tiling → as-of rainfall/terrain feature snapshots. |
| 2.4 | Field report API retained → occurrence time, provenance and curated labels added. |
| 3.1 | ONNX pretrained loading → historical dataset and rainfall/terrain baseline. |
| 3.2 | Spectral mask inference → model training/calibration/backtesting. |
| 3.3 | Mask polygonization → versioned 24h inference contract. |
| 3.4 | Slope/residential risk score → validated hazard levels, factors and quality; exposure remains separate. |
| 4.1 | Redis/circuit breaker → persisted job recovery, Redis notifications and bounded service calls. |
| 4.2–4.3 | Detection queue / before-after map → forecast review / rainfall–terrain dashboard. |
| 4.4 | Admin alert flow retained with validity/forecast reference and reliable delivery. |
| 5.1–5.2 | Subscriptions/reports retained with validity and occurrence/report time distinctions. |
| 5.3–5.4 | Static offline polygons / image-based demo → expiring cache / 24h forecast integration. |
| 6.1–6.2 | IoT/SAR remain optional post-MVP improvements. |
| 6.3 | Antecedent rain promoted to 2.1/2.3/3.1; slot becomes optional additional horizons. |
| 7.1–7.2 | Performance/audit retained; optimize measured bottlenecks; full event sourcing not a prerequisite. |
| 8.1–8.2 | Pilot/defense retained with forecast evidence and refreshed presentation artifacts. |

## 3. Chosen approach

**Hybrid: direct adjustment plus MVP review.** Reuse service boundaries, database/geospatial operations, auth plan and alert workflows. Re-scope rain/terrain/data/model stories and defer image segmentation. No source-code rollback is required.

- Direct adjustment: feasible; medium-to-high implementation effort, especially datasets and evaluation.
- Rollback: not selected; the affected inference/client implementations are prototypes and no production model needs reverting.
- MVP review: required; one pilot AOI and one source of each weather input, fixed 24h horizon. Optional inputs/horizons must demonstrate added value.
- Schedule: previous five weeks is provisional. Gate 1 is historical forecast and event-label feasibility; no defensible numeric delivery estimate until access, inventory size and quality are known.

If historical forecasts are unavailable, observed-rain monitoring or an experimental baseline can be demonstrated with explicit limitations. It cannot be reported as a validated next-day forecasting result.

## 4. Data/model decisions still open

| Decision | Owner / evidence needed |
| --- | --- |
| Pilot AOI and unit scale | Tú + product owner; source resolution, label spatial accuracy and local coverage. |
| Rain/forecast provider | Tú; access/license, units, issue/availability times, latency, archival runs and missingness. |
| Inventory/negative sampling | Duẫn + Tú; occurrence times, provenance, ambiguity and reporting bias. |
| Model family | Duẫn; compare interpretable baseline with a tabular ML candidate on fixed splits. |
| Release limits | Product owner + domain reviewer + Duẫn; numeric minimum recall and maximum false-alarm burden before final test. |
| Update cadence/freshness | Tú + Thuận; provider release schedule and measured delay; no arbitrary real-time claim. |

[Model card](../../docs/AI_MODEL_CARD.md) records checked NASA/ECMWF references. Provider options are technical candidates; no data subscription, account or external service was activated.

## 5. Implementation handoff

| Owner | Next work / completion evidence |
| --- | --- |
| Duẫn | Inventory/split manifest, baseline, candidate/calibration, evaluation report and model artifact. |
| Tú | Pilot/source feasibility, as-issued archive, terrain units, ingestion/feature contracts and quality tests. |
| Thuận | Auth, new migrations/routes, persisted jobs/retry, forecast review and real delivery adapters. |
| Huy | API-backed rainfall/terrain/hazard UI with quality/validity and warning confirmation. |
| Lâm | Subscriptions/device tokens, reports and expiry-aware cache/geofencing tests. |

Handoff is documented here and in member assignment files; no message or issue was sent to another person. Recommended order: data feasibility/contracts → ingestion/labels/features → baseline/backtest → runtime model/orchestration → review/delivery/mobile → integration and shadow evaluation.

Success requires measured performance on held-out storms/areas, agreed quality limits, clear missing/stale behavior, traceable forecast versions, authenticated review/admin broadcast, and correct offline expiration. A forecast approval must not become a label that a landslide happened.

## 6. Checklist record

| Checklist IDs | Status / outcome |
| --- | --- |
| 1.1 | N/A — stakeholder pivot, not a failing implementation story. |
| 1.2–1.3 | Done — request and prototype/spec mismatch establish trigger and impact. |
| 2.1–2.5 | Done — all eight epics reviewed; IDs retained, rainfall promoted, segmentation deferred. |
| 3.1–3.4 | Done — PRD/architecture/API/UI/CI/deployment/model and presentation impacts identified. No separate UX/spec/index/project-context files found in the planning inputs. |
| 4.1–4.4 | Done — alternatives assessed; direct adjustment plus MVP review selected. |
| 5.1–5.5 | Done — issue, impact, approach, MVP and named responsibilities documented. |
| 6.1–6.2 | Done — consistency checks cover story mapping, links and documentation-only scope. |
| 6.3 | Direction and 24h horizon explicitly authorized. Provider/model/release-limit decisions remain proposed/open; do not infer approval of those choices. |
| 6.4 | Done — changed sprint keys updated; existing status preserved, no story marked complete. |
| 6.5 | Done for this documentation handoff — responsibilities and next gates recorded; implementation is not claimed complete. |

## 7. Artifact status

Updated: README, PRD, architecture, epics, sprint tracking, five member plans, model card, API specification and architecture entry point. Historical setup/presentation text is marked as such. DOCX/PPTX files and slide-generation scripts still represent older material and require later regeneration under Story 8.2. Runtime source, SQL migrations and deployment configuration have not been altered in this direction-setting change.
