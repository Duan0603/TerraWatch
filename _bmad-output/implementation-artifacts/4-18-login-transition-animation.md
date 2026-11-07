---
baseline_commit: 9d1f9cb
---
# Story 4.18: Smooth transition between the sign-in card and the registration dialogs

Status: review

## Story

As a user opening the sign-up from the login page,
I want the screen to change smoothly instead of popping,
so that I always understand where the dialog came from and which step I am on.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-18-login-transition-animation`
**Branch:** `feature/login-transition-animation` (from `feature/webgis-login-redesign`). Design: EXPERIENCE.md "Transitions".

## Acceptance Criteria

1. **AC1 (same frame):** the sign-up is the second panel of the sign-in card (no overlay or pop-up). Opening slides the sign-in panel out to the left and the sign-up panel in from the right in 0.55 s; the frame height and width ease to the new panel.
2. **AC2 (back):** "Quay lại đăng nhập", Esc and the result-step button slide back; the sign-up form is cleared only after it has left the frame; reopening during that time keeps the state.
3. **AC3 (steps):** a step change slides the new content in (right when forward, left when going back) and the height eases.
4. **AC4 (accessibility):** the hidden panel is `inert` and `aria-hidden`; focus moves to the first field on open.
5. **AC5 (reduced motion):** no animation and no delayed clearing.
6. **AC6 (no regression):** sign-up logic, validation and endpoints unchanged; no horizontal scroll at 375px; the tallest form (officer) fits a 1400x900 screen.

## Tasks

- [x] Task 1: `SlidePanels`, `AutoHeight`, view state, open/close/Esc/focus in `LoginPage.jsx`
- [x] Task 2: slide, frame-size and step transitions in `login.css`; tighter form (hidden legends, no area hint) so it fits
- [x] Task 3: EXPERIENCE.md "Transitions" and DESIGN.md "Registration panel"
- [x] Task 4: browser check: panel slide classes and transforms, focus lands on the name field, back returns and clears the form, no overflow at 375px

## Notes

- Replaces the first version of this story (dialog growing out of the pressed card), which was not what was wanted.
- Not verified live: the step-to-step slide (the OTP step needs a real SMS, and Google showed a reCAPTCHA image challenge to the automated browser, which only a person may solve). The embedded browser pane also throttles animations, so timings were checked from computed styles, not by eye.
