---
baseline_commit: d68b2c0
---
# Story 4.8: Officer account request and admin approval flow

Status: review

## Story

As a field officer without an account,
I want to send an officer account request from the WebGIS sign-up screen,
so that an admin can verify who I am and approve me, without the system letting anyone become staff on their own.

**Epic:** Epic 4 (with Story 1.1 for auth)
**Sprint key:** `4-8-officer-registration-request-flow`
**Branch:** `feature/officer-registration-flow` (based on `feature/fullstack-review-fixes`, Story 4.7).
**Why:** Story 4.7 stopped `/auth/register` from accepting a `role` (Story 1.1 AC1). The WebGIS officer sign-up then had no real path and the admin approval queue (PR #60) could never receive a request.

## Acceptance Criteria

1. **AC1 (separate endpoint):** `POST /api/v1/auth/officer-requests` (public, rate-limited by the gateway) takes `fullName`, `email`, `password`, `phoneNumber`, `phoneToken`, `departmentUnit`. It never goes through `/auth/register`, which still always creates a citizen.
2. **AC2 (verified phone):** the phone number must be backed by a Firebase phone token for the same number (Story 4.6 check); a missing token, a token for another number or a missing unit gives 400.
3. **AC3 (pending):** the account is created as `officer` with `approval_status = pending`, the response carries `requestId` (the new user id) and `approvalStatus: pending` and no token. A duplicate email gives 409.
4. **AC4 (no access):** until an admin approves, login returns 403 ("chờ Quản trị viên phê duyệt") and any token for the account is rejected (Story 4.7 AC4).
5. **AC5 (admin sees the unit):** migration V12 adds `department_unit`; `GET /admin/users` returns `departmentUnit` and the user-management table shows "Đơn vị: ..." so the admin can judge the request. Approve/reject keep the Story 4.7 rules (pending only).
6. **AC6 (web):** the officer sign-up asks for the unit, verifies the phone by OTP, calls the new endpoint and shows the real `requestId` with the message that approval is pending. Errors use clear Vietnamese messages (`registerErrorMessage`), covered by a node test.

## Tasks

- [x] Task 1: V12 migration (+ copy in `database/migrations`), `User.departmentUnit`, `AdminUserItem.departmentUnit`
- [x] Task 2: `OfficerRequest`/`OfficerRequestResponse`, `AuthService.requestOfficer`, controller route, security permitAll
- [x] Task 3: backend tests (`AuthControllerTest.officerRequestNeedsVerifiedPhoneAndStaysPendingUntilApproved`)
- [x] Task 4: web sign-up flow, admin table unit line, `registerError.js` + `test-register-errors.mjs`
- [x] Task 5: live check through the gateway (request -> pending -> approve -> login)

## Notes

- Not done on purpose: email verification and e-mail notification to the admin (no mail service in the project); the admin sees new requests in "Quản lý người dùng" (filter "Chờ duyệt").
- Test phone for demos: Firebase test number `+84 900 000 001` / code `123456` (real SMS needs the Blaze plan).
