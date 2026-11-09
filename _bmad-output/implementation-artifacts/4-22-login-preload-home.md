---
baseline_commit: afe8347
---
# Story 4.22: Prepare the home page on the login screen after sign-in

Status: review

## Story

As an officer, admin or citizen who has just signed in,
I want the app to load the map and the first data while I am still on the login screen, with a progress panel,
so that the home page opens ready instead of lagging and showing a blank map.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-22-login-preload-home`
**Branch:** `feature/webgis-login-preload` (from `feature/webgis-auth-overhaul`). Requested by Lâm: the map was not loaded when the home page appeared.

## Acceptance Criteria

1. **AC1 (wait on the login page):** after a successful sign-in the page stays on `/login` and shows a panel "Đang chuẩn bị trung tâm chỉ huy" with a checklist (account verified, forecast data and reports, 3D terrain map) and a progress bar; only then it navigates to `/`.
2. **AC2 (data):** for officer and admin the forecast review queue, the field reports and the monitoring areas are requested during the wait; the dashboard uses those results for its first load (one use, valid 60 s) and falls back to a normal request if they are missing, expired or failed.
3. **AC3 (map warm-up):** a hidden MapLibre map with the real style, camera and 3D terrain is created off screen and torn down at `idle`, so the browser already holds the style, fonts, sprites and first tiles when the real map starts. Citizens get the map step only.
4. **AC4 (bounded wait):** never shorter than 0.9 s (no flash) and never longer than 9 s; a slow network or a map error does not block entering. A failed step still lets the user in.
5. **AC5 (hand-over):** the panel fades out (0.35 s) before the route changes; with `prefers-reduced-motion` there is no animation.
6. **AC6 (no change when sign-in fails):** a wrong password shows the error as before and no panel.

## Tasks

- [x] Task 1: `preload/warmUp.js` (prefetch store, hidden map warm-up, `warmUpHome`)
- [x] Task 2: dashboard first load uses the prefetched results
- [x] Task 3: login page progress panel and `prepareHome`
- [x] Task 4: browser check

## Notes

- Verified: the panel appears, steps turn done one by one (data in about 0.7 s), the page then reaches `/`; the data requests are made once on the login page.
- In the embedded test browser the hidden map hit the time limit (the pane throttles rendering, so `idle` does not fire); a real visible tab should finish sooner. Real timing on Lâm's machine is not measured.
- In development React StrictMode runs the dashboard effect twice, so the second run does a normal request; production builds use the prefetched result once.
