---
baseline_commit: a0525dd
---
# Story 4.14: Forecast review audit log

Status: review

## Story

As an officer or admin,
I want to see who approved or rejected which forecast, when and why,
so that warning decisions are traceable (PRD FR3).

**Epic:** Epic 4: Forecast orchestration, WebGIS and warnings
**Sprint key:** `4-14-review-audit-log`
**Origin:** merged in PR #60 (`0d1dc02`) without a story file. Written after the fact on 2026-11-07 from the code and the live review of `main` a0525dd; fixes found in that review are in Stories 4.7-4.9.

## Acceptance Criteria

1. `GET /forecasts/reviews/audit?limit=` (officer/admin; citizen 403, anonymous 401) returns the reviews newest first with reviewer, decision, reason and the run.
2. The WebGIS "Nhật ký thẩm định" modal searches and filters by decision.
3. An empty log shows an empty state, not an error.

## Where it lives

`ForecastController`, `ForecastService`, `ReviewAuditModal.jsx`, `forecastApi.js`.

## Tests and known gaps

`ForecastApiTest` (access and content). Live check 2026-11-07: modal opens, empty because no review had been made.
