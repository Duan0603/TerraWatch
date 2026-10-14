# GeoSentry (TerraWatch)

## Rainfall and terrain based landslide hazard forecasting

**Direction updated 2026-10-13:** use recent rainfall, next-24-hour rainfall forecasts and terrain to predict **landslide hazard over the next 24 hours**. Officers review the evidence; administrators decide whether to send SMS/App warnings.

The AI estimates landslide hazard using weather data; building a weather forecasting model is outside scope. “Accuracy” must be measured on held-out historical events and as-issued inputs. No trained 24-hour model or validated accuracy is currently available.

## Product flow

Rain observations/estimates + issued weather forecasts + DEM → aligned feature snapshots → 24h hazard model → WebGIS review → admin-confirmed SMS/FCM → expiry-aware mobile cache/geofencing.

A forecast area is not an observed landslide footprint. Forecasts carry issue/expiry times; stale or missing data must not appear as a current low-hazard assessment.

## Current implementation versus target

| Component | Existing code | Revised target |
| --- | --- | --- |
| Core API | Java 17 / Spring Boot 3.2.4, PostGIS queries and incident review; auth incomplete, notification mock. | Forecast runs/reviews separate from incidents, JWT/RBAC, persisted jobs and real alert delivery. |
| AI | FastAPI slope/NDVI formula and synthetic geometry. | Validated rainfall/terrain baseline/model, 24h predictions, provenance and quality. |
| GIS | Sample satellite scenes, grid helper, empty vector tiles. | Rainfall observations/forecasts, DEM features, time/space alignment and snapshots. |
| WebGIS | React 18 / Vite dashboard, fixed sample events and CSS map. | Rainfall/terrain/hazard map, evidence review and valid-time display. |
| Mobile | Flutter static screen, standalone geometry algorithms. | Auth/subscriptions, alerts/reports, SQLite geofencing with expiry. |
| Infrastructure | PostgreSQL/PostGIS, Redis, Nginx and Docker Compose. | Reuse the stack; add forecast routing and reliable orchestration. |

DeepLabV3+/Landslide4Sense segmentation, 8-channel patches and before/after satellite comparison are deferred from the MVP. Their old metrics do not demonstrate forecast skill. Runtime code has not yet been migrated to the new contracts.

## Authoritative planning documents

- [PRD v5](./_bmad-output/planning-artifacts/prd.md): scope, roles, requirements and acceptance.
- [Architecture](./_bmad-output/planning-artifacts/architecture.md): source timing, separate forecast/incident data and failure behavior.
- [Epics and stories](./_bmad-output/planning-artifacts/epics.md) and [sprint status](./_bmad-output/implementation-artifacts/sprint-status.yaml).
- [Model card](./docs/AI_MODEL_CARD.md): dataset/model status, evaluation and NASA/ECMWF references.
- [Existing and planned API contracts](./docs/API_SPECIFICATION.md).
- [Change analysis](./_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-13.md): old/new scope and implementation handoff.

## Team

| Member | Focus | Plan |
| --- | --- | --- |
| Duẫn | AI forecasting, labels, baseline and evaluation | [AI](./_bmad-output/planning-artifacts/members/duan-ai/epics.md) |
| Tú | Rainfall data, DEM, GIS and feature snapshots | [GIS](./_bmad-output/planning-artifacts/members/tu-gis/epics.md) |
| Thuận | Backend, auth, forecasts, delivery and infrastructure | [Backend](./_bmad-output/planning-artifacts/members/thuan-backend/epics.md) |
| Huy | WebGIS, rainfall charts and warning review | [WebGIS](./_bmad-output/planning-artifacts/members/huy-webgis/epics.md) |
| Lâm | Mobile, subscriptions and expiring offline geofencing | [Mobile](./_bmad-output/planning-artifacts/members/lam-mobile/epics.md) |

## Repository

- apps/webgis, apps/mobile: clients.
- services/core-api, services/ai-service, services/gis-service: services.
- database: schema/seed and migration copies; Core resources contain Flyway migrations.
- gateway: Nginx.
- scripts, run.ps1, Makefile: development utilities.
- _bmad-output: requirements, backlog and tracking.
- docs: technical docs; older presentation/office files are historical until regenerated.

## Run the existing prototype

Requires Docker with Compose. From the repository root:

```powershell
.\run.ps1 up
.\run.ps1 ps
.\run.ps1 logs
```

Equivalent startup: docker compose up -d --build. Startup launches the current prototype, not the future rainfall predictor.

| Service | Address |
| --- | --- |
| Gateway / WebGIS | http://localhost:8080 |
| Core Swagger via gateway | http://localhost:8080/swagger-ui/index.html |
| AI docs | http://localhost:8001/docs |
| GIS docs | http://localhost:8002/docs |
| Direct WebGIS / Core | localhost:5173 / localhost:3000 |
| PostgreSQL / Redis | localhost:5432 / localhost:6379 |

Stop with .\run.ps1 down. Rebuild one service with .\run.ps1 rebuild-core (or rebuild-ai, rebuild-gis, rebuild-web, rebuild-gateway). Python containers mount source for reload; Java/WebGIS changes require rebuilding.

Compose currently embeds connection defaults. A root .env or subservice .env file is not automatically consumed by every application: inspect docker-compose.yml and each service's actual environment reads. AI source configuration and model artifacts for the new predictor remain future work. Core currently receives REDIS_URL while its YAML reads REDIS_HOST/REDIS_PORT; align these in Story 4.1.

For local development: run docker compose up -d postgres redis; install the service's declared dependencies; use mvn spring-boot:run in services/core-api, npm install then npm run dev in apps/webgis, or uvicorn app.main:app with port 8001/8002 in the corresponding Python service. Maven Wrapper files are not present. Mobile platform scaffolding/integration is incomplete.

## Database and development

Core Flyway manages schema migrations; Hibernate ddl-auto is none. Existing migration copies live in database/migrations and services/core-api/src/main/resources/db/migration. Add a new version when implementing the pivot; do not rewrite applied V1/V2.

.\run.ps1 migrate and .\run.ps1 db-status wrap the separate Python migration helper. It tracks public.schema_migrations, separately from Flyway; do not assume both histories are interchangeable. Keep schema copies synchronized and choose one migration path for a given environment.

The existing clean command removes database volumes; use it only for an intentional reset. CI currently compiles Core/builds WebGIS and installs AI dependencies; this is not evidence of end-to-end or model testing.

Follow [CONTRIBUTING.md](./CONTRIBUTING.md). Auth Story 1.1 remains ready-for-dev; changed forecast stories remain backlog. Before modeling, confirm the pilot AOI, event inventory and archived weather forecasts.
