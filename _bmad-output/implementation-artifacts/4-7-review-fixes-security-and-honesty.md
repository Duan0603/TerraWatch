---
baseline_commit: a0525dd
---
# Story 4.7: Fixes from the full review of main a0525dd (P0-P2)

Status: review

## Story

As the team (Thuan backend, Huy web, Lam mobile),
I want the privacy, access-control and honesty defects found in the 2026-11-07 review of `main` a0525dd fixed,
so that user management works through the gateway, citizens' data is not public and no screen or API contradicts the PRD.

**Epic:** Epic 4 (with Story 1.1 for auth)
**Sprint key:** `4-7-review-fixes-security-and-honesty`
**Branch:** `feature/fullstack-review-fixes` from `main` a0525dd (never push `main`).
**Source:** review report `bao-cao-ra-soat-main-a0525dd.md` (live curl and browser evidence).

## Acceptance Criteria

1. **AC1 (P0, gateway):** `/api/v1/admin/**` is routed to core-api; without a token it returns 401 (not the SPA HTML / 405). `gateway/check-routes.sh` checks it.
2. **AC2 (P0, privacy):** `GET /api/v1/community-reports` needs an officer or admin token (anonymous 401, citizen 403). Citizens still see their own reports through `/mine`.
3. **AC3 (P1, register):** `POST /auth/register` always creates a `citizen` (a `role` field is ignored), restoring Story 1.1 AC1. Officer/admin accounts are made by an admin (role change on a user).
4. **AC4 (P1, live account state):** every authenticated request re-reads the user: a locked, pending or rejected account gets 401, and the role used for authorization is the one stored in the database, not the one inside an old token.
5. **AC5 (P1, admin rules):** an admin cannot change their own role or lock themselves, the last active admin cannot be demoted, and approve/reject apply only to a pending officer request.
6. **AC6 (P2, Google):** Google sign-in refuses locked, pending and rejected accounts with 403 and the same messages as password login.
7. **AC7 (P1, deliveries):** `GET /notifications/broadcast/{id}/deliveries` no longer returns FCM tokens.
8. **AC8 (P1, mobile register):** the mobile sign-up form no longer sends a phone number it cannot verify (the server requires a Firebase phone token); a phone can be added in the profile screen.
9. **AC9 (P2, web):** registration errors show a clear Vietnamese message (409 = "Email đã được đăng ký"); the success card shows the real user id, never a made-up one; photos load on the dev server; the comparison modal never invents a `high` level.
10. **AC10 (P2, docs/data):** `database/migrations` holds copies of V8-V11; `sprint-status.yaml` lists 4-6 and 4-7.

## Out of scope (reported, not changed)

- `maven-wrapper.jar` / `mvnw.cmd` stay tracked (removing them may break other members' scripts).
- Story files for the six features merged in PR #60 (user management, AOI, field-report status, forecast comparison, review audit, broadcast revoke/deliveries) are still missing.
- Photo URLs under `/community-reports/photos/{uuid}` stay public (unguessable ids, needed by `<img>`).

## Tasks

- [x] Task 1: gateway route + check-routes (AC1)
- [x] Task 2: community-reports access (AC2)
- [x] Task 3: auth hardening and tests (AC3-AC6)
- [x] Task 4: deliveries without FCM token (AC7)
- [x] Task 5: mobile register (AC8)
- [x] Task 6: web fixes (AC9)
- [x] Task 7: migration copies, sprint-status (AC10)
- [x] Task 8: re-test (core-api once, web tests and build, flutter)
