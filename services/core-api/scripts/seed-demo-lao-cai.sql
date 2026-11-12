-- Local/demo use only (Story 5.4). Current forecast runs on the named Lào Cai assessment units of
-- database/seed_v3_fixtures.sql (Bát Xát & Sa Pa, area 2). Run through `.\run.ps1 demo-seed`, which first loads
-- those units, extracts their DEM terrain and ingests as-of rainfall, so the evidence panel has data issued before
-- these runs. model_version 'demo' marks every probability below as demo data, not a model output.
--   VN_LC_SAPA_0005    approved, high    -> shown to citizens and officers
--   VN_LC_BATXAT_0003  approved, medium  -> shown to citizens and officers
--   VN_LC_BATXAT_0001  pending,  medium  -> officers only (review queue)
-- Re-running refreshes the 24 h validity. job_status 'completed' keeps ForecastRecoveryPoller from resending the
-- rows to the AI service and marking them "unavailable".
INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, probability, hazard_level,
                                       model_version, threshold_version, review_status, is_active, availability, job_status)
VALUES
 ('d0000000-0000-4000-8000-000000000101', 'VN_LC_SAPA_0005',   now(), now(), now() + interval '24 hours', 0.82, 'high',   'demo', 'demo', 'approved', TRUE, 'available', 'completed'),
 ('d0000000-0000-4000-8000-000000000102', 'VN_LC_BATXAT_0003', now(), now(), now() + interval '24 hours', 0.64, 'medium', 'demo', 'demo', 'approved', TRUE, 'available', 'completed'),
 ('d0000000-0000-4000-8000-000000000103', 'VN_LC_BATXAT_0001', now(), now(), now() + interval '24 hours', 0.55, 'medium', 'demo', 'demo', 'pending',  TRUE, 'available', 'completed')
ON CONFLICT (run_id) DO UPDATE SET issued_at = EXCLUDED.issued_at, valid_from = EXCLUDED.valid_from,
    valid_until = EXCLUDED.valid_until, review_status = EXCLUDED.review_status, is_active = TRUE,
    availability = 'available', unavailability_reason = NULL, job_status = 'completed';
