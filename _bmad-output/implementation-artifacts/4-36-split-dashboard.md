---
baseline_commit: 3509470
---
# Story 4.36: Split the big dashboard files (no behaviour change)

Status: review

## Story

As a developer,
I want `DashboardPage` and `Navbar` smaller and without repeated code,
so that the next feature (for example a top-bar menu) touches few lines and is easy to review.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-36-split-dashboard`
**Branch:** `feature/webgis-split-dashboard` (from main 3509470). Roadmap: "split big files while e2e is green".

## Acceptance Criteria

1. **AC1:** All data loading (queue, field reports, review KPIs, broadcast history, AOI, 60 s refresh, live stream) moves into the hook `hooks/useDashboardData.js`. `DashboardPage` keeps only UI state.
2. **AC2:** The nine "is open" booleans become one `dialogs` object. Escape closes them in the same order as before, then the alert prompt.
3. **AC3:** The mobile tab bar is its own component `MobileTabBar`. In `Navbar`, the connection chip text is computed by `connectionStatus()` and the five repeated ghost buttons come from one list (same labels, titles and aria-labels).
4. **AC4:** No visible change. Existing unit tests and all 15 e2e tests stay green; new e2e `dialogs.spec.js` proves four dialogs still open and Escape closes each.

## Result

`DashboardPage.jsx` 272 -> 171 lines, `Navbar.jsx` 184 -> 152 lines. New: `useDashboardData.js`, `MobileTabBar.jsx`, `e2e/dialogs.spec.js`.

## Known limits

- Two dialogs can still be open together (history + new broadcast), as before; Escape closes the first in `DIALOG_ORDER`.
- `DetailPanel`, `MapViewer` (697 lines) and the large modals are not split here.
