---
baseline_commit: 6906fc2
---
# Story 4.25: Polish the AOI drawing map (on top of PR #67)

Status: review

## Story

As an admin,
I want the monitoring-area map to be forgiving and informative,
so that I can fix one wrong point, see how big the area is and line it up with its neighbours.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-25-aoi-draw-polish`
**Branch:** `feature/webgis-aoi-draw-polish` (from `main` at 6906fc2). Replaces the earlier own drawing tool (kept off `main` on purpose): Minh Huy's `AoiDrawMap` from PR #67 is the base, this story only adds what it lacked.

## Acceptance Criteria

1. **AC1:** clicking an existing point never adds a new point (the marker swallows the click).
2. **AC2:** double-clicking a point deletes that point; double-click no longer zooms the map.
3. **AC3:** points are numbered on the map; the hint shows the approximate area in km² once there are 3 points.
4. **AC4:** the other monitoring areas are drawn as grey dashed context (the area being edited is excluded).
5. **AC5:** `areaKm2` is covered by `tests/test-aoi-csv-kpi.mjs`; PR #67's logic, API and backend validation are unchanged.

## Notes

- Not verified by eye: the embedded browser pane is hidden, so MapLibre never renders there; clicking, double-clicking and the context layer need a person to try them on the real page.
- Shortcut: points are still only added at the end of the ring (no insert between two points).
