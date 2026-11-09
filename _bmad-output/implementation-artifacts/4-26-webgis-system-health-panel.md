---
baseline_commit: 6906fc2
---
# Story 4.26: System health and data freshness panel (admin)

Status: review

## Story

As an admin,
I want to see whether the database, Redis, AI and GIS services are alive and how old the latest rain and forecast data is,
so that I notice a stuck data pipeline before officers act on stale numbers.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-26-webgis-system-health-panel`
**Branch:** `feature/webgis-system-health` (from `main`). Roadmap item 1 of `review-2026-11-07-and-roadmap.md` section 5 (PRD: show data quality and freshness).

## Acceptance Criteria

1. **AC1:** `GET /api/v1/admin/system-health` is admin-only (401 anonymous, 403 officer/citizen).
2. **AC2:** it returns four components (db, redis, ai, gis), each with `status` ok | degraded | down, a short Vietnamese `detail` and `latencyMs`. A service that answers `/health` with `model_ready=false` is `degraded`. A dead or hanging service shows `down` within about 3 s and never freezes the response; no host names or stack traces are returned.
3. **AC3:** it returns the freshness of four data sources (rain observed, rain forecast, AI feature snapshot, forecast run): latest timestamp and age in minutes, `null` when there is no data.
4. **AC4:** the dashboard has an admin-only button "Tình trạng hệ thống" opening a modal with the four components and four freshness rows and a refresh button. The age reads "x phút / x giờ / x ngày trước", amber over 6 hours and red over 24 hours.
5. **AC5:** backend test `AdminSystemHealthApiTest`; web helper `ageLabel` covered by `tests/test-system-health.mjs`.

## Notes

- No new dependency: the existing `/health` routes of AI and GIS, `JdbcTemplate`, `StringRedisTemplate`.
- Shortcut: checks run one after another (worst case about 10 s when everything hangs); parallel checks are the upgrade if the panel is opened often.
- Thresholds (6 h amber, 24 h red) are a UI hint, not a product rule.
