-- Local/demo use only (Story 5.3). Creates three demo forecast zones around a point:
--   DEMO_NOW      approved, valid for the next 24 h  -> the phone must warn when standing in it
--   DEMO_EXPIRED  approved, expired 1 h ago          -> never returned by /forecasts/offline-sync
--   DEMO_PENDING  not yet approved                   -> never returned
-- Default centre is Hanoi; pass your own position with -v lon=<longitude> -v lat=<latitude>.
-- Run from repository root (PowerShell):
--   Get-Content services/core-api/scripts/seed-demo-forecasts.sql -Raw | docker exec -i terrawatch-postgis psql -U postgres -d terrawatch -v ON_ERROR_STOP=1 -v lon=105.8342 -v lat=21.0278
-- Re-running refreshes the validity windows. To remove: DELETE FROM gis_schema.spatial_assessment_units WHERE unit_id LIKE 'DEMO_%';
\if :{?lon} \else \set lon 105.8342 \endif
\if :{?lat} \else \set lat 21.0278 \endif

INSERT INTO gis_schema.spatial_assessment_units (unit_id, unit_name, admin_province, admin_district, geom)
VALUES
 ('DEMO_NOW',     'Demo zone (valid)',   'Demo', 'Demo', ST_MakeEnvelope(:lon - 0.01, :lat - 0.01, :lon + 0.01, :lat + 0.01, 4326)),
 ('DEMO_EXPIRED', 'Demo zone (expired)', 'Demo', 'Demo', ST_MakeEnvelope(:lon + 0.04, :lat - 0.01, :lon + 0.06, :lat + 0.01, 4326)),
 ('DEMO_PENDING', 'Demo zone (pending)', 'Demo', 'Demo', ST_MakeEnvelope(:lon - 0.06, :lat - 0.01, :lon - 0.04, :lat + 0.01, 4326))
ON CONFLICT (unit_id) DO UPDATE SET geom = EXCLUDED.geom;

INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, probability, hazard_level,
                                       model_version, threshold_version, review_status, is_active)
VALUES
 ('d0000000-0000-4000-8000-000000000001', 'DEMO_NOW',     now(),                      now(),                      now() + interval '24 hours', 0.88, 'high',   'demo', 'demo', 'approved', TRUE),
 ('d0000000-0000-4000-8000-000000000002', 'DEMO_EXPIRED', now() - interval '25 hours', now() - interval '25 hours', now() - interval '1 hour',  0.75, 'medium', 'demo', 'demo', 'approved', TRUE),
 ('d0000000-0000-4000-8000-000000000003', 'DEMO_PENDING', now(),                      now(),                      now() + interval '24 hours', 0.60, 'medium', 'demo', 'demo', 'pending',  TRUE)
ON CONFLICT (run_id) DO UPDATE SET issued_at = EXCLUDED.issued_at, valid_from = EXCLUDED.valid_from,
    valid_until = EXCLUDED.valid_until, review_status = EXCLUDED.review_status, is_active = TRUE;
