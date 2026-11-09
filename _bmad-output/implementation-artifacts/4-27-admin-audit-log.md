---
baseline_commit: 6906fc2
---
# Story 4.27: Admin action audit log

Status: review

## Story

As an admin,
I want a log of who locked an account, changed a role, approved an officer, sent or revoked an alert,
so that every sensitive action can be traced afterwards.

**Epic:** Epic 4 (WebGIS); supports the traceability goal of Story 7.2
**Sprint key:** `4-27-admin-audit-log`
**Branch:** `feature/admin-audit-log` (from `main`). Roadmap item 5 of `review-2026-11-07-and-roadmap.md` section 5. Extends the forecast review log (which only covers forecast decisions).

## Acceptance Criteria

1. **AC1:** migration V14 creates `core_schema.admin_audit` (actor id and e-mail, action code, target type/id/label, detail, time). No foreign key, so rows outlive the account they describe.
2. **AC2:** these successful admin actions write one row each: lock, unlock, role change, officer approve, officer reject, broadcast send (with its result status, area and risk level), broadcast revoke. A refused action (404/400/409) writes nothing.
3. **AC3:** `GET /api/v1/admin/audit?limit=` returns the rows newest first (default 200, at most 500), admin-only (401 anonymous, 403 officer).
4. **AC4:** a failure to write the log never undoes the admin action; it is logged as an error on the server.
5. **AC5:** the dashboard has an admin-only button "Nhật ký quản trị" opening a table with a filter by action and a CSV export.
6. **AC6:** backend `AdminAuditApiTest`; web labels and CSV columns in `tests/test-admin-audit.mjs`.

## Notes

- Not logged: logins, forecast reviews (they already have their own log), edits of monitoring areas. Adding an action is one `audit.record(...)` call.
- Shortcut: rows are never deleted or paged beyond 500; archiving is the upgrade when the table grows.
- Core was not rebuilt in Docker for this story, so the button has not been seen against a live server.
