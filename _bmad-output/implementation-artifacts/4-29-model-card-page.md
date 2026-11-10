---
baseline_commit: bd4c46a
---
# Story 4.29: Model card page for officers and admins

Status: review

## Story

As an officer or admin,
I want to read what the landslide models are, what they were tested on and what they must not be used for,
so that I treat their output as a candidate to verify, not as a fact.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-29-model-card-page`
**Branch:** `feature/webgis-model-card` (from `main` at bd4c46a). Roadmap item 5.7. Every number on the page comes from the AI service's own `model_card.json` and GRU card; the page invents nothing and shows "chưa có" when the AI service cannot answer.

## Acceptance Criteria

1. **AC1 (AI service):** `GET /api/v1/models/info` also returns `version`, `status`, `trained_on` and `input_channels` from the card; `GET /api/v1/models/gru/info` also returns `runtime`, `trained_history_provider`, `trained_forecast_provider` and `calibrated_probability` from the GRU card.
2. **AC2 (Core API):** `GET /api/v1/model-card` (OFFICER or ADMIN only; 401 without a token, 403 for a citizen) returns `{segmentation, gru}`, each exactly what the AI service returned, or `{ready:false}` when the AI service is down. The gateway routes `/api/v1/model-card` to Core API; `/api/v1/ai/**` stays closed.
3. **AC3 (web):** a "Thẻ mô hình" button in the top bar (officer and admin) opens a dialog with: experimental-status banner, identity (name, version, hash check, training data, input channels), the three operating modes with thresholds, the key metrics (L4S official test, VN013 operating point of the default mode with regions, false regions per km², pixel precision and recall), the temporal-check rule, the GRU card (providers, "chưa hiệu chuẩn thành xác suất") and the cautions the card states.
4. **AC4:** when the AI service is unavailable the dialog says so and shows no numbers; the top bar still fits one line at 1440 px for an admin.
5. **AC5:** tests: AI contract test, Core API test (roles, shape, AI-down), web unit tests for the formatting helpers; build passes.

## Notes

- Shortcut: no history of earlier model versions (the card describes only the version in use).
- The CRLF warnings on Windows are harmless.
