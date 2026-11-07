---
baseline_commit: a0525dd
---
# Story 4.10: Admin user management and account lock

Status: review

## Story

As an admin,
I want to list users, filter them, lock or unlock an account, change a role and decide officer requests,
so that staff accounts are controlled by the team and a misused account can be shut off.

**Epic:** Epic 4: Forecast orchestration, WebGIS and warnings
**Sprint key:** `4-10-admin-user-management`
**Origin:** merged in PR #60 (`0d1dc02`) without a story file. Written after the fact on 2026-11-07 from the code and the live review of `main` a0525dd; fixes found in that review are in Stories 4.7-4.9.

## Acceptance Criteria

1. `GET /api/v1/admin/users` (admin only; anonymous 401, officer and citizen 403) lists users with `search`, `role`, `isActive`, `approvalStatus` filters.
2. `PATCH /admin/users/{id}/status` locks or unlocks; a locked account cannot sign in and its existing token stops working (Story 4.7). An admin cannot lock themselves.
3. `PATCH /admin/users/{id}/role` changes the role (admin, officer, citizen); an admin cannot change their own role (Story 4.7).
4. `POST /admin/users/{id}/approve` and `/reject` answer a pending officer request only (409 otherwise); requests come from Story 4.8.
5. The WebGIS "Quản lý người dùng" modal shows counters, filters and the actions above; the gateway routes `/api/v1/admin/**` (Story 4.7).

## Where it lives

`AdminUserController`, `AdminUserService`, migration V11 (`is_active`, `approval_status`), `UserManagementModal.jsx`, `adminApi.js`.

## Tests and known gaps

`AdminUserApiTest` (role gating, filter, lock/unlock, self-lock, approve/reject, own role, stale token). Gap: no web test for the modal.
