---
baseline_commit: 46f24b3
---
# Story 4.34: Review performance KPIs

Status: review

## Story

As an officer or admin,
I want to see how fast proposals get decided, how often they are approved and how many ran out of time unreviewed,
so that the team can see whether the review queue keeps up.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-34-review-kpi`
**Branch:** `feature/webgis-kpi-review-metrics` (from `main` at 46f24b3). Roadmap item 5.2 (deeper KPI). Computed on the server from `core_schema.forecast_reviews` and `forecast_runs`, so it is exact (not limited to the 100 rows the audit list loads).

## Acceptance Criteria

1. **AC1 (Core API):** `GET /api/v1/forecasts/reviews/metrics?days=7` (OFFICER or ADMIN; 401 without a token, 403 for a citizen) returns `windowDays` (clamped to 1..90), `approved`, `rejected`, `avgMinutes`, `medianMinutes` (issue-to-decision, null when nothing was decided, never 0) and `expiredUnreviewed` (available proposals issued in the window whose validity ended while still pending; unavailable ones cannot be approved and are not counted).
2. **AC2 (web, strip):** the KPI strip gets one card "Thẩm định 7 ngày": value = average time to decide ("42 phút", "3 giờ 5 phút", or "—" with no decisions), sub = "78% duyệt · 3 hết hạn chưa duyệt"; tone warns when proposals expired unreviewed.
3. **AC3 (web, audit dialog):** the review audit dialog gets a summary block with a 7 / 30 day switch: decided, approval rate, average and median time, expired unreviewed. The numbers are the server's, nothing is recomputed in the browser except the percentage and the text format.
4. **AC4:** a failed metrics call never breaks the queue or the strip (the card is simply absent / the block says it could not load).
5. **AC5:** tests: Core API (counts as deltas, window and clamping, roles), web helpers (duration text, rate, tone), e2e (strip card and audit summary with mocked API); all existing tests pass.

## Notes

- Shortcut: no per-reviewer breakdown, no trend chart; add if the team asks.
