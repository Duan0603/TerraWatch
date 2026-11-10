---
baseline_commit: 47f172f
---
# Story 4.40: Map overlays that never overlap (info card, map buttons, popups)

Status: review

## Story

As an officer or admin,
I want the info card, the map buttons and the popups on the map to stay apart,
so that the dashboard looks tidy and I can read every popup.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-40-map-overlay-layout`
**Branch:** `feature/webgis-map-layout`, **stacked on** `feature/webgis-confirmed-fixes` (Story 4.39); merge 4.39 first. Source: user screenshots 2026-11-10 (popup text under the "Khu vực đang xem" selector; two popups on top of each other).

## Acceptance Criteria

1. **AC1:** The map area is a CSS size container. Below 1350 px of *map* width (not window width) the map buttons show their icon only and the selector hides its "Khu vực đang xem" label, so the buttons never reach the info card (tested at 1100, 1280, 1440, 1600 and 1920 px window width; at 1440 px the old layout overlapped).
2. **AC2:** "Sạt lở đã xác nhận" shows its count in a small badge that stays visible in icon-only mode; the accessible name is unchanged ("Sạt lở đã xác nhận (N)").
3. **AC3:** Popups sit above every overlay (z-index 20). When the clicked point is closer than 260 px to the top of the map, the map eases down so the popup opens below the top controls (field-report, confirmed-landslide and coordinate popups).
4. **AC4:** A click on a field-report pin that lies on top of a confirmed landslide opens only the pin's popup, not both.
5. **AC5:** e2e `maplayout.spec.js` (5 widths); all 30 e2e pass. Live check with real data at 1440 and 1900 px: one popup, fully below the controls.

## Known limits

- In icon-only mode the button names are in tooltips and aria-labels only.
- When a field-report pin covers a confirmed point, the confirmed popup is reached by clicking the area around it (zoom in).
