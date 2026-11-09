---
baseline_commit: bd4c46a
---
# Story 4.33: Top-bar buttons keep their name when only the icon shows

Status: review

## Story

As a screen-reader user (and as the e2e tests),
I want each top-bar button to keep its own name when the text label is hidden on a narrow screen,
so that "Phát cảnh báo" is never announced as "Cần quyền Admin".

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-33-navbar-aria-labels`
**Branch:** `fix/webgis-navbar-aria-labels` (from `main` at bd4c46a). Found by the full e2e run: at 1280 px (Playwright's default) Story 4.31 hides `.btn-label`, so the button's accessible name fell back to its `title`, which for a non-admin is "Cần quyền Admin".

## Acceptance Criteria

1. **AC1:** the five text buttons of the top bar and the "Quản trị" menu button carry an `aria-label` equal to their visible label; `title` stays as the longer hint.
2. **AC2:** `npm run e2e` is 8/8 at the default 1280 px viewport; `npm test` and the build pass.
