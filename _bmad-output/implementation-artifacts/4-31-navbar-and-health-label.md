---
baseline_commit: b39c2bb
---
# Story 4.31: Navbar fits the admin's buttons and the health panel stops repeating itself

Status: review

## Story

As an admin,
I want the top bar to stay on one line and the health panel to read cleanly,
so that every tool is reachable on a laptop screen and nothing looks like a glitch.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-31-navbar-and-health-label`
**Branch:** `fix/webgis-navbar-and-health-label` (from `main` at b39c2bb). Two small findings from looking at the live stack after Stories 4.26 and 4.27.

## Acceptance Criteria

1. **AC1:** the admin's four tools (Vùng giám sát, Quản trị người dùng, Nhật ký quản trị, Tình trạng hệ thống) sit in one "Quản trị" drop-down (`AdminMenu`): opens on click, closes on Esc, on an outside click and after a choice. Measured before the change: at 1440 px the admin's bar needed 1867 px and ran off the screen.
2. **AC2:** on screens up to 1280 px wide the buttons of the top bar show only their icons (each has a `title`) and button text never wraps; the mobile rules (≤ 768 px) are unchanged.
3. **AC3:** a healthy component in the health panel shows "Phản hồi bình thường" under its name instead of repeating "Hoạt động" next to the status.
4. **AC4:** web tests and build pass; no backend change.

## Notes

- Shortcut: the menu has no arrow-key navigation (Tab and Enter work); add it if the menu grows.
