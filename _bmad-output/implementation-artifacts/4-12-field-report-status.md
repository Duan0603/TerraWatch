---
baseline_commit: a0525dd
---
# Story 4.12: Officer field-report screen and status updates

Status: review

## Story

As an officer or admin,
I want to read citizens' field reports and mark them submitted, processed or archived,
so that reports are triaged and the team can see which ones were handled.

**Epic:** Epic 4: Forecast orchestration, WebGIS and warnings
**Sprint key:** `4-12-field-report-status`
**Origin:** merged in PR #60 (`a0afe2e`) without a story file. Written after the fact on 2026-11-07 from the code and the live review of `main` a0525dd; fixes found in that review are in Stories 4.7-4.9.

## Acceptance Criteria

1. `GET /community-reports` returns the list with submitter name, phone, GPS and photo link to officer/admin only (Story 4.7).
2. `PATCH /community-reports/{id}/status` accepts `submitted`, `processed`, `archived` (officer/admin; citizen 403, anonymous 401, other values 400, unknown id 404).
3. The WebGIS "Báo cáo hiện trường" modal searches, filters by status, shows photos (Story 4.9) and changes the status.

## Where it lives

`CommunityReportController`, `FieldReportService`, `FieldReportsModal.jsx`, `AuthImage.jsx`.

## Tests and known gaps

`FieldReportApiTest.officerCanUpdateReportStatusToProcessed` and the access tests. Gap: no web test.
