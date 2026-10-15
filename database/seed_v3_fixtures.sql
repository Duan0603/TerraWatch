-- ==============================================================================
-- TerraWatch / GeoSentry - Seed Data Fixtures V3
-- Purpose: Synthetic fixtures for Pilot AOI (Bát Xát & Sa Pa, Lào Cai)
-- Story 1.2: PostGIS Forecast and Observation Schema
-- ==============================================================================

-- 1. SEED SPATIAL ASSESSMENT UNITS (LƯỚI Ô 1KM TẠI BÁT XÁT & SA PA, LÀO CAI)
-- area_id = 2 -> "Vùng trọng điểm 2: Sa Pa & Bát Xát (Lào Cai)" (gis_schema.monitoring_areas)
-- ------------------------------------------------------------------------------
INSERT INTO gis_schema.spatial_assessment_units (
    unit_id, area_id, unit_name, admin_province, admin_district, admin_commune,
    geom, slope_avg, slope_max, elevation_avg, relief_m, dem_source
) VALUES
('VN_LC_BATXAT_0001', 2, 'Ô 001 - Sườn Ta-luy Dốc Bản Qua', 'Lào Cai', 'Bát Xát', 'Bản Qua',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.850, 22.520),
     ST_MakePoint(103.860, 22.520),
     ST_MakePoint(103.860, 22.530),
     ST_MakePoint(103.850, 22.530),
     ST_MakePoint(103.850, 22.520)
 ])), 4326), 34.5, 48.2, 720.0, 260.0, 'SRTM_30M'),

('VN_LC_BATXAT_0002', 2, 'Ô 002 - Lưu Vực Suối Ngòi Phát', 'Lào Cai', 'Bát Xát', 'Quang Kim',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.860, 22.520),
     ST_MakePoint(103.870, 22.520),
     ST_MakePoint(103.870, 22.530),
     ST_MakePoint(103.860, 22.530),
     ST_MakePoint(103.860, 22.520)
 ])), 4326), 28.3, 39.1, 580.0, 190.0, 'SRTM_30M'),

('VN_LC_BATXAT_0003', 2, 'Ô 003 - Dốc Tỉnh Lộ 156B', 'Lào Cai', 'Bát Xát', 'Bản Xèo',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.840, 22.510),
     ST_MakePoint(103.850, 22.510),
     ST_MakePoint(103.850, 22.520),
     ST_MakePoint(103.840, 22.520),
     ST_MakePoint(103.840, 22.510)
 ])), 4326), 41.2, 53.0, 890.0, 340.0, 'SRTM_30M'),

('VN_LC_SAPA_0004', 2, 'Ô 004 - Thung Lũng Mường Hoa', 'Lào Cai', 'Sa Pa', 'Mường Hoa',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.870, 22.310),
     ST_MakePoint(103.880, 22.310),
     ST_MakePoint(103.880, 22.320),
     ST_MakePoint(103.870, 22.320),
     ST_MakePoint(103.870, 22.310)
 ])), 4326), 36.8, 51.5, 1250.0, 410.0, 'SRTM_30M'),

('VN_LC_SAPA_0005', 2, 'Ô 005 - Ta-luy Đèo Ô Quy Hồ', 'Lào Cai', 'Sa Pa', 'Ô Quy Hồ',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.780, 22.350),
     ST_MakePoint(103.790, 22.350),
     ST_MakePoint(103.790, 22.360),
     ST_MakePoint(103.780, 22.360),
     ST_MakePoint(103.780, 22.350)
 ])), 4326), 46.5, 62.0, 1850.0, 580.0, 'SRTM_30M'),

('VN_LC_BATXAT_0006', 2, 'Ô 006 - Sườn Dốc Trịnh Tường', 'Lào Cai', 'Bát Xát', 'Trịnh Tường',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.820, 22.560),
     ST_MakePoint(103.830, 22.560),
     ST_MakePoint(103.830, 22.570),
     ST_MakePoint(103.820, 22.570),
     ST_MakePoint(103.820, 22.560)
 ])), 4326), 38.9, 50.4, 650.0, 230.0, 'SRTM_30M'),

('VN_LC_BATXAT_0007', 2, 'Ô 007 - Lưu Vực Suối A Mú Sung', 'Lào Cai', 'Bát Xát', 'A Mú Sung',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.790, 22.580),
     ST_MakePoint(103.800, 22.580),
     ST_MakePoint(103.800, 22.590),
     ST_MakePoint(103.790, 22.590),
     ST_MakePoint(103.790, 22.580)
 ])), 4326), 32.1, 44.6, 540.0, 175.0, 'SRTM_30M'),

('VN_LC_SAPA_0008', 2, 'Ô 008 - Bản Khoang Ta-luy Âm', 'Lào Cai', 'Sa Pa', 'Bản Khoang',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.830, 22.400),
     ST_MakePoint(103.840, 22.400),
     ST_MakePoint(103.840, 22.410),
     ST_MakePoint(103.830, 22.410),
     ST_MakePoint(103.830, 22.400)
 ])), 4326), 43.7, 58.3, 1480.0, 470.0, 'SRTM_30M'),

('VN_LC_SAPA_0009', 2, 'Ô 009 - Tả Van Sườn Tây', 'Lào Cai', 'Sa Pa', 'Tả Van',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.900, 22.300),
     ST_MakePoint(103.910, 22.300),
     ST_MakePoint(103.910, 22.310),
     ST_MakePoint(103.900, 22.310),
     ST_MakePoint(103.900, 22.300)
 ])), 4326), 39.4, 52.8, 1100.0, 350.0, 'SRTM_30M'),

('VN_LC_SAPA_0010', 2, 'Ô 010 - Hầu Thào Ta-luy Dương', 'Lào Cai', 'Sa Pa', 'Hầu Thào',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.860, 22.280),
     ST_MakePoint(103.870, 22.280),
     ST_MakePoint(103.870, 22.290),
     ST_MakePoint(103.860, 22.290),
     ST_MakePoint(103.860, 22.280)
 ])), 4326), 44.9, 59.6, 1620.0, 505.0, 'SRTM_30M')
ON CONFLICT (unit_id) DO NOTHING;

-- 2. SEED QUAN TRẮC LƯỢNG MƯA LỊCH SỬ (OPEN-METEO)
-- Fixed fixture anchor timestamp (NOT CURRENT_TIMESTAMP): interval_start/interval_end are part of
-- the UNIQUE(unit_id, interval_start, interval_end, source_provider, source_revision) idempotency key.
-- A moving CURRENT_TIMESTAMP would never match on re-run, so ON CONFLICT silently fails to dedupe
-- and every re-run of this script would insert a fresh set of duplicate rows.
-- ------------------------------------------------------------------------------
INSERT INTO gis_schema.rainfall_observations (
    unit_id, interval_start, interval_end, available_at, rainfall_mm, source_provider, quality_flag
) VALUES
('VN_LC_BATXAT_0001', TIMESTAMPTZ '2026-10-14 00:00:00+00' - INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', 115.4, 'OPEN_METEO', 'good'),
('VN_LC_BATXAT_0002', TIMESTAMPTZ '2026-10-14 00:00:00+00' - INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', 82.0, 'OPEN_METEO', 'good'),
('VN_LC_BATXAT_0003', TIMESTAMPTZ '2026-10-14 00:00:00+00' - INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', 142.8, 'OPEN_METEO', 'good'),
('VN_LC_SAPA_0004', TIMESTAMPTZ '2026-10-14 00:00:00+00' - INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', 98.6, 'OPEN_METEO', 'good'),
('VN_LC_SAPA_0005', TIMESTAMPTZ '2026-10-14 00:00:00+00' - INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', 168.2, 'OPEN_METEO', 'good'),
('VN_LC_BATXAT_0006', TIMESTAMPTZ '2026-10-14 00:00:00+00' - INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', 104.0, 'OPEN_METEO', 'good'),
('VN_LC_BATXAT_0007', TIMESTAMPTZ '2026-10-14 00:00:00+00' - INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', 76.5, 'OPEN_METEO', 'good'),
('VN_LC_SAPA_0008', TIMESTAMPTZ '2026-10-14 00:00:00+00' - INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', 131.0, 'OPEN_METEO', 'good'),
('VN_LC_SAPA_0009', TIMESTAMPTZ '2026-10-14 00:00:00+00' - INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', 92.4, 'OPEN_METEO', 'good'),
('VN_LC_SAPA_0010', TIMESTAMPTZ '2026-10-14 00:00:00+00' - INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', 149.7, 'OPEN_METEO', 'good')
ON CONFLICT (unit_id, interval_start, interval_end, source_provider, source_revision) DO NOTHING;

-- 3. SEED DỰ BÁO LƯỢNG MƯA 24H TIẾP THEO (same fixed-anchor rationale as above)
-- ------------------------------------------------------------------------------
INSERT INTO gis_schema.rainfall_forecasts (
    unit_id, provider_run_id, provider_name, issued_at, valid_from, valid_until, available_at, predicted_rain_24h_mm
) VALUES
('VN_LC_BATXAT_0001', 'RUN_20261014_00Z', 'OPEN_METEO', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', 130.5),
('VN_LC_BATXAT_0002', 'RUN_20261014_00Z', 'OPEN_METEO', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', 75.0),
('VN_LC_BATXAT_0003', 'RUN_20261014_00Z', 'OPEN_METEO', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', 155.0),
('VN_LC_SAPA_0004', 'RUN_20261014_00Z', 'OPEN_METEO', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', 110.0),
('VN_LC_SAPA_0005', 'RUN_20261014_00Z', 'OPEN_METEO', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', 185.0),
('VN_LC_BATXAT_0006', 'RUN_20261014_00Z', 'OPEN_METEO', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', 118.0),
('VN_LC_BATXAT_0007', 'RUN_20261014_00Z', 'OPEN_METEO', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', 70.0),
('VN_LC_SAPA_0008', 'RUN_20261014_00Z', 'OPEN_METEO', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', 140.0),
('VN_LC_SAPA_0009', 'RUN_20261014_00Z', 'OPEN_METEO', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', 88.0),
('VN_LC_SAPA_0010', 'RUN_20261014_00Z', 'OPEN_METEO', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', TIMESTAMPTZ '2026-10-14 00:00:00+00', 160.0)
ON CONFLICT (unit_id, provider_run_id, valid_from, valid_until) DO NOTHING;

-- 4. SEED FEATURE SNAPSHOT MẪU CHO AI INFERENCE
-- ------------------------------------------------------------------------------
INSERT INTO gis_schema.feature_snapshots (
    snapshot_id, unit_id, as_of_time, features, coverage_quality
) VALUES
('11111111-1111-1111-1111-111111111111', 'VN_LC_BATXAT_0003', TIMESTAMPTZ '2026-10-14 00:00:00+00',
 '{"slope_avg": 41.2, "relief_m": 340.0, "rain_1h_mm": 22.5, "rain_24h_acc_mm": 142.8, "rain_72h_acc_mm": 230.0, "rain_7d_acc_mm": 310.0, "forecast_next_24h_mm": 155.0}'::jsonb,
 'good')
-- Conflict on the real PK (snapshot_id is a fixed fixture UUID) so this script stays safely re-runnable.
ON CONFLICT (snapshot_id) DO NOTHING;

-- 5. SEED DỰ BÁO SẠT LỞ MẪU (FORECAST RUN)
-- ------------------------------------------------------------------------------
INSERT INTO core_schema.forecast_runs (
    run_id, snapshot_id, unit_id, issued_at, valid_from, valid_until, horizon_hours,
    probability, experimental_score, hazard_level, model_version, threshold_version,
    contributing_factors, review_status, is_active
) VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'VN_LC_BATXAT_0003',
 TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00', TIMESTAMPTZ '2026-10-14 00:00:00+00' + INTERVAL '24 hours', 24,
 0.88, 0.88, 'high', 'xgboost-baseline-v1', 'th-v1',
 '[{"factor": "forecast_rain_24h", "val": 155.0, "weight": 0.45}, {"factor": "slope", "val": 41.2, "weight": 0.35}]'::jsonb,
 'pending', TRUE)
ON CONFLICT (run_id) DO NOTHING;
