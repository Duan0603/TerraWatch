---
baseline_commit: aefe417
---
# Story 4.9: Field-report photos need an officer or admin login

Status: review

## Story

As a citizen who sends a field report with a photo,
I want that photo to be visible only to officers and admins,
so that a photo of my home or my face is not reachable by anyone who learns or guesses its link.

**Epic:** Epic 4 / Epic 2 (field reports, Story 2.4)
**Sprint key:** `4-9-field-report-photos-need-login`
**Branch:** `feature/officer-registration-flow`
**Source:** review of main a0525dd (photo URLs were public "by unguessable id", kept public in Story 4.7).

## Acceptance Criteria

1. **AC1:** `GET /api/v1/community-reports/photos/{id}` returns 401 without a token, 403 for a citizen (even the uploader) and the image for officer/admin. The response is cached `private` for one hour, no longer `public`.
2. **AC2:** the WebGIS field-report screen loads photos through `AuthImage` (axios with the token, shown as a blob URL), so thumbnails and the zoom view still work and also work on the Vite dev server.
3. **AC3:** the mobile app is not affected: it uploads photos and never reads them back (checked: no use of `image_url` in `apps/mobile/lib`).

## Tasks

- [x] Task 1: SecurityConfig matcher + private cache header
- [x] Task 2: `AuthImage` component and use in `FieldReportsModal`
- [x] Task 3: update `FieldReportApiTest` (401 / 403 / officer 200 / unknown id 404)
