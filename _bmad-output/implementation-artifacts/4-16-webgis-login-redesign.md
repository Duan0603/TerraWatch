---
baseline_commit: 1652a8f
---
# Story 4.16: Redesigned WebGIS login page with a rain-and-cloud background

Status: review

## Story

As an officer, admin or citizen opening the WebGIS (and as the team presenting it to the thesis committee),
I want a login page that looks like a landslide early-warning system and is easy to use,
so that the first screen explains the product, reads clearly on any device and does not overstate what the system knows.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-16-webgis-login-redesign`
**Branch:** `feature/webgis-login-redesign` (from `feature/officer-registration-flow`). Web owner: Huy (inform before merge).
**Design contract:** `_bmad-output/planning-artifacts/ux-designs/ux-TerraWatch-2026-11-07/` (`DESIGN.md`, `EXPERIENCE.md`, `mockups/login-mock.html`). The two spine files win over the mock.

## Acceptance Criteria

1. **AC1 (scene):** a dark night-storm background with drifting clouds, falling rain (canvas) and a static mountain ridge; it is `aria-hidden`, never takes focus or clicks, and does not flash (no lightning).
2. **AC2 (reduced motion and cost):** with `prefers-reduced-motion: reduce` the rain is not drawn and the clouds stand still; the rain count scales with the viewport (70-220 drops, pixel ratio capped at 2) and pauses with the hidden tab.
3. **AC3 (layout):** two columns above 900px (hero left, glass card right); at 900px and below one column with the form first, no horizontal scroll, the primary button visible without scrolling at 375x812.
4. **AC4 (content kept):** email and password sign-in, "Xem demo mô hình" link, three quick demo chips (fill demo email and password, move focus to the submit button, do not sign in), citizen sign-up and officer account request (both open the existing dialogs, logic unchanged).
5. **AC5 (honesty):** the hero says what the system does and a visible note says the score is experimental and not a calibrated probability; no invented statistics.
6. **AC6 (states):** submit shows "Đang đăng nhập…" and disables the button; 401 shows "Email hoặc mật khẩu không đúng." and clears and focuses the password; no response shows "Không kết nối được máy chủ. Thử lại sau."; 403 shows the server's Vietnamese message; the error uses `role="alert"`.
7. **AC7 (accessibility):** visible labels tied to inputs, 44px minimum targets, focus rings, contrast per DESIGN.md, usable at 200% zoom.

## Tasks

- [x] Task 1: `LoginBackdrop.jsx` (clouds, rain canvas, ridge) and `login.css`
- [x] Task 2: rebuild the card and hero in `LoginPage.jsx`; keep the dialogs and the auth logic
- [x] Task 3: error and loading states, chip focus behaviour
- [x] Task 4: check desktop 1400x850, mobile 375x812, wrong password, real sign-in, sign-up dialog

## Notes

- The static mountain ridge was not in the first request (rain and clouds only); it grounds the scene and is one `<svg>` in `LoginBackdrop.jsx` to delete if unwanted.
- Not covered: automated test of the animation (visual, checked by hand); the registration dialogs keep their old inline styles.
