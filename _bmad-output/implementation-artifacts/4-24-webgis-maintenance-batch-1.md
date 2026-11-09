---
baseline_commit: 1da6580
---
# Story 4.24: WebGIS maintenance batch 1

Status: review

## Story

As the team preparing the demo,
I want five small honesty, safety and tidiness fixes in the WebGIS,
so that a production build ships no demo password, no screen calls a low risk "safe", and no control offers an action the server refuses.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-24-webgis-maintenance-batch-1`
**Branch:** `feature/webgis-maintenance-batch1` (from `feature/security-review-round2`). Items A1-A4 and A6 of the maintenance table in `review-2026-11-07-and-roadmap.md`.

## Acceptance Criteria

1. **AC1 (A1, demo password):** the "Diễn tập nhanh" buttons and the demo password exist only in `npm run dev` or in a build made with `VITE_DEMO_LOGIN=true`; a normal production build contains neither the password nor the demo e-mails (checked with `grep` on the built JavaScript: 0 matches, and 1 match with the flag on). `.env.example` documents `VITE_DEMO_LOGIN` and `VITE_DEMO_PASSWORD`.
2. **AC2 (A2, wording):** the forecast comparison no longer labels a low level "THẤP / AN TOÀN": low is "NGUY CƠ THẤP" and the unused `safe` entry is "NGUY CƠ RẤT THẤP" (PRD section 3: a low score is not an all-clear).
3. **AC3 (A3, citizen form):** the citizen sign-up has no "khu vực" field and no `areaOfInterest` in the request (the server never stored it).
4. **AC4 (A4, own account):** in user management the role dropdown and the lock button are disabled, with an explanation, on the signed-in admin's own row (the server refuses both, Story 4.7).
5. **AC5 (A6, dead code):** unused OTP state (`generatedOtp`, `isRealSms`, `smsWarning`) and five unused icons removed from `LoginPage.jsx`.

## Tasks

- [x] Task 1: `config/demoLogin.js`, login page and `.env.example`
- [x] Task 2: comparison labels
- [x] Task 3: citizen form without the area field; EXPERIENCE.md updated
- [x] Task 4: own-row controls in `UserManagementModal.jsx`
- [x] Task 5: cleanup; web tests and build; live check (dev: 3 demo chips and a citizen form without the area field; own row disabled, other rows enabled)

## Notes

- For a rehearsal on the Docker build (port 8080) put `VITE_DEMO_LOGIN=true` in `apps/webgis/.env` before `docker compose build webgis`; without it the demo buttons are hidden there.
- `registerOfficerRequest` in `authApi.js` is NOT dead code (Story 4.8 uses it); the earlier table was wrong about that.
