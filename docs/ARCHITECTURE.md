# GeoSentry architecture entry point

**Updated:** 2026-10-13.

The authoritative architecture is [Rainfall and terrain forecasting](../_bmad-output/planning-artifacts/architecture.md). It supersedes the previous Sentinel-2 segmentation/C4 narrative in this file.

The system retains Core API (Java/Spring Boot), AI/GIS (Python/FastAPI), WebGIS (React), mobile (Flutter), PostgreSQL/PostGIS, Redis and Nginx. The new target is next-24-hour rainfall-triggered landslide hazard, with as-of input snapshots, forecast/incident separation, review, explicit warning decisions and expiry-aware offline data.

See [PRD](../_bmad-output/planning-artifacts/prd.md), [API status and contracts](API_SPECIFICATION.md) and [model card](AI_MODEL_CARD.md). The source still contains prototypes; these documents do not assert that the forecast pipeline is already implemented.
