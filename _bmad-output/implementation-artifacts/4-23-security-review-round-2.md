---
baseline_commit: d7603c6
---
# Story 4.23: Second review of main + our branch: legacy endpoints, error status, exposed ports, docs

Status: review

## Story

As the team,
I want the second full review of the project to close the access-control holes it found,
so that nothing an anonymous visitor or a citizen can reach can change incident data, publish events or reach the database.

**Epic:** Epic 4 (with Story 1.3 and Story 1.1)
**Sprint key:** `4-23-security-review-round-2`
**Branch:** `feature/security-review-round2` (from `feature/webgis-login-preload`).

## Findings and fixes

1. **P0 - anyone could approve or reject an incident.** `PATCH /api/v1/landslides/{id}/verify` was covered only by the blanket `permitAll`; the reviewer id came from the request body (default: the demo officer). Reproduced on 2026-11-07: an anonymous call rejected the pending demo incident (the row was restored afterwards). Fix: officer/admin only, and the reviewer is the signed-in user, never a client value.
2. **P1 - the legacy incident queue was public.** `GET /api/v1/landslides/queue` (pending, unreviewed incidents) now needs officer/admin. `/active`, `/geofence`, `/offline-sync` stay public.
3. **P1 - any signed-in citizen could push events onto the Redis bus.** `/api/v1/diagnostic/**` (event-bus publish, circuit-breaker demos) is now admin only.
4. **P1 - database and Redis reachable from the network.** `docker-compose.yml` published Postgres (default password) and Redis (no password) on all interfaces; both, and the direct WebGIS port, are now bound to `127.0.0.1`. The gateway port 8080 stays open so a phone on the same Wi-Fi can still reach the API.
5. **P2 - the 401-instead-of-real-status trap came back a third time.** A controller missing from `AuthExceptionHandler.assignableTypes` turned its 400/404 into a bare 401 (first `AdminUserController`, now `LandslideEventController`). The handler now covers the whole controller package and `/error` is permitted.
6. **P2 - AI scene name check on Windows paths.** `inference._check_name` let `..\x.tif` through on Linux (and on Windows it is a real traversal); a backslash is now rejected on every OS (AI test 14/14).
7. **P2 - a test broken by Story 4.9.** `ErrorStatusOverHttpTest` still expected an anonymous 404 for an unknown photo; it now checks 401 (anonymous), 403 (citizen) and 404 (officer).
8. **P2 - verifying an incident without a risk level was always a 500** (untyped SQL parameter `? IS NOT NULL`), and an unknown id, a bad id or a bad status were 500s too. Now: null keeps the old level, unknown id 404, bad id or status 400.
9. **P2 - docs drift.** `docs/API_SPECIFICATION.md` had none of the endpoints added since 2026-11 (new section 1b) and `README.md` still said Auth Story 1.1 was ready-for-dev.

## Not changed (recommendations in the review report)

CORS `*` with credentials (the API uses bearer tokens, not cookies); stateless JWT without revocation; the default-open `/api/v1/**` rule (every new route is public unless listed: flip to deny-by-default); GIS database tests need the fixtures in `database/seed_v3_fixtures.sql` (they fail on a database without them).

## Tasks

- [x] Task 1: SecurityConfig rules, controller/service reviewer from the principal, handler for the whole package
- [x] Task 2: tests (`AuthControllerTest.legacyIncidentReviewAndDiagnosticsAreStaffOnly`, `ErrorStatusOverHttpTest`)
- [x] Task 3: compose ports, AI path check, docs
- [x] Task 4: full Core API suite 113 tests green (second run after the fixes), AI 14/14, web tests and build, flutter 102/102; live check through the gateway: anonymous verify 401, citizen 403, officer queue 200, citizen event-bus 403, unknown id 404, bad status 400
- [x] Task 5: CI runs the web unit tests (it only compiled before)

## Applying the compose change on this machine

`docker compose up -d postgres redis webgis` recreates those containers with the new localhost-only ports (data volumes are kept). It was not run automatically so the running database is not interrupted.
