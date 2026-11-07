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

1. **AC1 (open):** the dialog grows out of the pressed card (position taken from the button), the overlay fades in, the sign-in card and hero recede behind it.
2. **AC2 (close):** the dialog shrinks back to the button and fades; the card returns; the dialog is removed only after the animation (260 ms); repeated closes during it are ignored.
3. **AC3 (steps):** a step change slides the new content in (right when forward, left when going back) and the dialog height changes smoothly (ResizeObserver).
4. **AC4 (reduced motion):** with `prefers-reduced-motion: reduce` there is no animation and closing is immediate.
5. **AC5 (no regression):** sign-up logic, validation and endpoints unchanged; no horizontal scroll.

## Tasks

- [x] Task 1: `AutoHeight`, step-direction pane, open origin and close-with-exit in `LoginPage.jsx`
- [x] Task 2: keyframes and transitions in `login.css`
- [x] Task 3: EXPERIENCE.md "Transitions"
- [x] Task 4: check in the browser: open (computed transform goes from the button position, scale .5 to .95 and on), close removes the dialog after the animation, card returns

## Notes

- Not verified: the step-to-step slide and height change in a live run. The OTP step needs a real Firebase SMS and Google showed a reCAPTCHA image challenge to the automated browser, which must be solved by a person; the CSS and the class switching (`lg-pane-fwd` / `lg-pane-back`) are in place.
