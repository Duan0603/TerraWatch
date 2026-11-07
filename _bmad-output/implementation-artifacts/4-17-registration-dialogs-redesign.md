---
baseline_commit: 0830230
---
# Story 4.17: Redesigned registration dialogs (citizen and officer)

Status: review

## Story

As a citizen or a field officer signing up from the WebGIS login page,
I want a clear, good-looking form with a visible progress and an easy code entry,
so that I can finish the sign-up without confusion and trust the screen.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-17-registration-dialogs-redesign`
**Branch:** `feature/webgis-login-redesign`. Web owner: Huy (inform before merge).
**Design contract:** `_bmad-output/planning-artifacts/ux-designs/ux-TerraWatch-2026-11-07/` (DESIGN.md components, EXPERIENCE.md "Registration dialogs").
**Why:** the old dialogs had near-invisible dark fields, 11px labels, white browser-autofill boxes, a simulated-SMS banner and a pre-filled unit/area that could be submitted by mistake.

## Acceptance Criteria

1. **AC1 (look):** both dialogs use the sign-in card's tokens: glass panel, icon tile header, readable labels (13.5px), 46px fields with a visible border and focus ring; autofill keeps the dark fill.
2. **AC2 (progress):** a 3-step indicator (Thông tin, Xác minh SĐT, Hoàn tất) shows the current and finished steps.
3. **AC3 (form):** fields grouped in sections; unit and area start empty; phone helper text; show/hide password and a live match message; the area field is marked optional.
4. **AC4 (OTP):** six digit boxes with auto-advance, paste of a full code, Backspace back; confirm disabled until six digits; resend after 60 s; "Sửa thông tin" keeps the typed values.
5. **AC5 (honesty):** the simulated-SMS banner and the auto-fill OTP shortcut are gone; the result step shows the real request code.
6. **AC6 (behaviour kept):** same endpoints and validation as Stories 4.6/4.8 (OTP check, officer request, citizen register, clear error messages).
7. **AC7 (responsive and accessible):** one column and no horizontal scroll at 375px; dialog is `aria-modal` with a labelled title; Esc/overlay/close button close it.

## Tasks

- [x] Task 1: new markup for the three steps in `LoginPage.jsx` and the `OtpBoxes` component
- [x] Task 2: styles in `login.css` (overlay, modal, steps, groups, OTP boxes, result, autofill, phone breakpoints)
- [x] Task 3: update DESIGN.md and EXPERIENCE.md
- [x] Task 4: live check: officer flow with the Firebase test number (form, mismatch message, 6 boxes, request sent, code shown), mobile 375

## Notes

- Not done: citizen flow was not run to completion in this check (same code path as the officer one except the endpoint); no automated test for the dialog markup.
