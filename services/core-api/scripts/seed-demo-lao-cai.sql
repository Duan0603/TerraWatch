-- Local/demo use only (Story 5.4). Current forecast runs on the named Lào Cai assessment units of
-- database/seed_v3_fixtures.sql (Bát Xát & Sa Pa, area 2). Run through `.\run.ps1 demo-seed`, which first loads
-- those units, extracts their DEM terrain and ingests as-of rainfall, so the evidence panel has data issued before
-- these runs. model_version 'demo' marks every probability below as demo data, not a model output.
--   VN_LC_SAPA_0005    approved, high    -> shown to citizens and officers
--   VN_LC_BATXAT_0003  approved, medium  -> shown to citizens and officers
--   VN_LC_BATXAT_0001  pending,  medium  -> officers only (review queue)
--   VN_LC_BATXAT_0002  pending,  high    -> approving it opens the admin's broadcast prompt
--   VN_LC_SAPA_0004    pending,  low     -> a case to reject (reason required)
-- Ô 002 is also its own monitoring area, so a citizen can follow just that cell: only its card then counts them and
-- a broadcast cited on it reaches only them. Subscriptions are per area, so this is data, not a code change.
INSERT INTO gis_schema.monitoring_areas (name, geom, description)
SELECT 'Vùng trọng điểm 5: Suối Ngòi Phát - Ô 002 (Lào Cai)', ST_Multi(geom), 'Demo: một ô đánh giá làm vùng riêng'
FROM gis_schema.spatial_assessment_units WHERE unit_id = 'VN_LC_BATXAT_0002'
ON CONFLICT (name) DO UPDATE SET geom = EXCLUDED.geom, is_active = TRUE;
UPDATE gis_schema.spatial_assessment_units
SET area_id = (SELECT area_id FROM gis_schema.monitoring_areas WHERE name = 'Vùng trọng điểm 5: Suối Ngòi Phát - Ô 002 (Lào Cai)')
WHERE unit_id = 'VN_LC_BATXAT_0002';

-- Re-running refreshes the 24 h validity. job_status 'completed' keeps ForecastRecoveryPoller from resending the
-- rows to the AI service and marking them "unavailable".
INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, probability, hazard_level,
                                       model_version, threshold_version, review_status, is_active, availability, job_status)
VALUES
 ('d0000000-0000-4000-8000-000000000101', 'VN_LC_SAPA_0005',   now(), now(), now() + interval '24 hours', 0.82, 'high',   'demo', 'demo', 'approved', TRUE, 'available', 'completed'),
 ('d0000000-0000-4000-8000-000000000102', 'VN_LC_BATXAT_0003', now(), now(), now() + interval '24 hours', 0.64, 'medium', 'demo', 'demo', 'approved', TRUE, 'available', 'completed'),
 ('d0000000-0000-4000-8000-000000000103', 'VN_LC_BATXAT_0001', now(), now(), now() + interval '24 hours', 0.55, 'medium', 'demo', 'demo', 'pending',  TRUE, 'available', 'completed'),
 ('d0000000-0000-4000-8000-000000000104', 'VN_LC_BATXAT_0002', now(), now(), now() + interval '24 hours', 0.78, 'high',   'demo', 'demo', 'pending',  TRUE, 'available', 'completed'),
 ('d0000000-0000-4000-8000-000000000105', 'VN_LC_SAPA_0004',   now(), now(), now() + interval '24 hours', 0.31, 'low',    'demo', 'demo', 'pending',  TRUE, 'available', 'completed')
ON CONFLICT (run_id) DO UPDATE SET issued_at = EXCLUDED.issued_at, valid_from = EXCLUDED.valid_from,
    valid_until = EXCLUDED.valid_until, review_status = EXCLUDED.review_status, is_active = TRUE,
    availability = 'available', unavailability_reason = NULL, job_status = 'completed';
