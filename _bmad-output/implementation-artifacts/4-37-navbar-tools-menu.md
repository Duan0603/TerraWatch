---
baseline_commit: 3509470
---
# Story 4.37: "Công cụ" menu in the top bar

Status: review

## Story

As an officer or admin on a 1440 px laptop,
I want the top bar to keep its text labels instead of icons only,
so that I do not have to guess what each icon does.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-37-navbar-tools-menu`
**Branch:** `feature/webgis-tools-menu`, **stacked on** `feature/webgis-split-dashboard` (Story 4.36) because both change `Navbar.jsx`; merge 4.36 first, then this PR shows only its own diff.

## Acceptance Criteria

1. **AC1:** Five shared tools (Xuất báo cáo, Lịch sử lệnh, Nhật ký thẩm định, Báo cáo hiện trường, Thẻ mô hình) move into one drop-down "Công cụ" with a one-line hint each. Same dialogs, same permissions.
2. **AC2:** The drop-down code is a generic `NavMenu`; `AdminMenu` ("Quản trị") now uses it too. Click outside or Escape closes it; `aria-haspopup`/`aria-expanded` as before.
3. **AC3:** Icon-only mode starts at 1280 px instead of 1520 px. At 1440 px both officer and admin bars show text labels and do not overflow. The button keeps `aria-label`.
4. **AC4:** e2e helper `openTool(page, name)`; existing specs use it. New e2e: at 1440 px labels are visible, no overflow, the menu lists 5 items, Escape closes it. All 21 e2e pass.

## Known limits

- Tools are one click further away than before (open the menu, then pick). The two buttons used most (sound, "Phát cảnh báo") stay on the bar.
- Widths between 1024 and 1280 px stay icon-only, as before.
