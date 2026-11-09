---
baseline_commit: a2fb2e4
---
# Story 4.28: WebGIS end-to-end tests with Playwright

Status: review

## Story

As the team making the WebGIS dependable before adding features,
I want a few browser tests that walk the three flows that matter most (sign-in by role, forecast review, emergency broadcast),
so that a change that breaks one of them is caught by `npm run e2e` before a demo, not during it.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-28-webgis-e2e-playwright`
**Branch:** `claude/webgis-e2e-playwright-d8777b` (from `main` at `a2fb2e4`). Only `src/components/ReviewDialog.jsx` changed (bug fix below); no `data-testid` was needed.

## Acceptance Criteria

1. **AC1 (sign-in by role):** against the real gateway API, `admin`, `officer` and `citizen` demo accounts sign in; admin and officer land on the command center (Navbar with "Phát cảnh báo"), citizen lands on the citizen screen ("Cảnh báo sạt lở cho người dân"). A wrong password shows "Email hoặc mật khẩu không đúng." and stays on `/login`.
2. **AC2 (review):** an officer opens the queue, selects a pending proposal, a rejection without a reason cannot be submitted, rejects with a reason (the PATCH carries `decision: rejected` and the reason); in a second test approves another one; the card changes to "Đã từ chối" / "Đã phê duyệt".
3. **AC3 (broadcast):** an admin opens "Phát cảnh báo", picks an area, sees the recipient preview, goes to the confirmation step, the confirm button stays disabled until `XAC NHAN` is typed, then enabled. The test stops there and asserts that no `POST .../broadcast` request was made. Nothing is ever sent to FCM.
4. **AC4 (isolation):** flows 2 and 3 mock `/api/v1/**` with `page.route` (fake session in `localStorage`), so they never change the real database and do not depend on seed data. Only flow 1 talks to the real backend (sign-in only changes nothing).
5. **AC5 (ReviewDialog fix):** after one review, the next review in the same session opens with an empty reason and an enabled confirm button (test `officer can review a second proposal without reloading`).
6. **AC6 (no regression):** `npm test` and `npm run build` still pass; e2e is NOT added to CI (needs a browser and a running stack).

## Tasks

- [x] Task 1: `@playwright/test` as a dev dependency, `playwright.config.js`, script `e2e`
- [x] Task 2: `e2e/auth.spec.js` (AC1)
- [x] Task 3: `e2e/review.spec.js` (AC2) with mocked API
- [x] Task 4: `e2e/broadcast.spec.js` (AC3) with mocked API and a guard on the broadcast POST
- [x] Task 5: run `npm run e2e`, `npm test`, `npm run build`

## Result

`npm run e2e`: 8 passed. `npm test` and `npm run build` still pass. Playwright is pinned to the latest (1.65): 1.49 hangs without output on Node 24.

## Finding, fixed in this story

- **Bug in `ReviewDialog.jsx`:** the dialog stays mounted (it returns `null` when closed), so after a successful review `busy` stayed true and the typed reason stayed. The next review opened with the old reason pre-filled and the confirm button stuck on "Đang gửi...". Fix: a `useEffect` on `target` resets `reason`, `busy` and `error` each time the dialog opens for a proposal (`ReviewDialog.jsx`, no change to its props or to `DashboardPage`).

## How to run

```powershell
cd apps/webgis
npm run e2e
```

- Needs the Docker stack up (gateway on `localhost:8080`) for flow 1 only. The config starts its own Vite dev server on port **5199** (so it never collides with the `webgis` container on 5173) and reuses it if already running.
- Browser: Microsoft Edge already on the machine (`channel: 'msedge'`), so no browser download. `E2E_BROWSER=chrome` or `E2E_BROWSER=chromium` (after `npx playwright install chromium`) switch it.
- Demo accounts come from `src/config/demoLogin.js` (read by the helper, never printed); `VITE_DEMO_PASSWORD` in the environment overrides the password.

## Notes

- The core-api container may run an older build than `main`; flow 1 only uses sign-in, which exists in every build.
- If a sign-in ever shows a reCAPTCHA the test must stop and be reported; the tests never try to solve one.
