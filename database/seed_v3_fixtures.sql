-- ==============================================================================
-- TerraWatch / GeoSentry - Seed Data Fixtures V3
-- Purpose: Synthetic fixtures for Pilot AOI (Bát Xát & Sa Pa, Lào Cai)
-- Story 1.2: PostGIS Forecast and Observation Schema
-- ==============================================================================

-- 1. SEED SPATIAL ASSESSMENT UNITS (LƯỚI Ô 1KM TẠI BÁT XÁT & SA PA, LÀO CAI)
-- ------------------------------------------------------------------------------
INSERT INTO gis_schema.spatial_assessment_units (
    unit_id, area_id, unit_name, admin_province, admin_district, admin_commune,
    geom, slope_avg, slope_max, elevation_avg, relief_m, dem_source
) VALUES
('VN_LC_BATXAT_0001', 1, 'Ô 001 - Sườn Ta-luy Dốc Bản Qua', 'Lào Cai', 'Bát Xát', 'Bản Qua',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.850, 22.520),
     ST_MakePoint(103.860, 22.520),
     ST_MakePoint(103.860, 22.530),
     ST_MakePoint(103.850, 22.530),
     ST_MakePoint(103.850, 22.520)
 ])), 4326), 34.5, 48.2, 720.0, 260.0, 'SRTM_30M'),

('VN_LC_BATXAT_0002', 1, 'Ô 002 - Lưu Vực Suối Ngòi Phát', 'Lào Cai', 'Bát Xát', 'Quang Kim',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.860, 22.520),
     ST_MakePoint(103.870, 22.520),
     ST_MakePoint(103.870, 22.530),
     ST_MakePoint(103.860, 22.530),
     ST_MakePoint(103.860, 22.520)
 ])), 4326), 28.3, 39.1, 580.0, 190.0, 'SRTM_30M'),

('VN_LC_BATXAT_0003', 1, 'Ô 003 - Dốc Tỉnh Lộ 156B', 'Lào Cai', 'Bát Xát', 'Bản Xèo',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.840, 22.510),
     ST_MakePoint(103.850, 22.510),
     ST_MakePoint(103.850, 22.520),
     ST_MakePoint(103.840, 22.520),
     ST_MakePoint(103.840, 22.510)
 ])), 4326), 41.2, 53.0, 890.0, 340.0, 'SRTM_30M'),

('VN_LC_SAPA_0004', 1, 'Ô 004 - Thung Lũng Mường Hoa', 'Lào Cai', 'Sa Pa', 'Mường Hoa',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.870, 22.310),
     ST_MakePoint(103.880, 22.310),
     ST_MakePoint(103.880, 22.320),
     ST_MakePoint(103.870, 22.320),
     ST_MakePoint(103.870, 22.310)
 ])), 4326), 36.8, 51.5, 1250.0, 410.0, 'SRTM_30M'),

('VN_LC_SAPA_0005', 1, 'Ô 005 - Ta-luy Đèo Ô Quy Hồ', 'Lào Cai', 'Sa Pa', 'Ô Quy Hồ',
 ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
     ST_MakePoint(103.780, 22.350),
     ST_MakePoint(103.790, 22.350),
     ST_MakePoint(103.790, 22.360),
     ST_MakePoint(103.780, 22.360),
     ST_MakePoint(103.780, 22.350)
 ])), 4326), 46.5, 62.0, 1850.0, 580.0, 'SRTM_30M')
ON CONFLICT (unit_id) DO NOTHING;

-- 2. SEED QUAN TRẮC LƯỢNG MƯA LỊCH SỬ (OPEN-METEO)
-- ------------------------------------------------------------------------------
INSERT INTO gis_schema.rainfall_observations (
    unit_id, interval_start, interval_end, available_at, rainfall_mm, source_provider, quality_flag
) VALUES
('VN_LC_BATXAT_0001', CURRENT_TIMESTAMP - INTERVAL '24 hours', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 115.4, 'OPEN_METEO', 'good'),
('VN_LC_BATXAT_0002', CURRENT_TIMESTAMP - INTERVAL '24 hours', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 82.0, 'OPEN_METEO', 'good'),
('VN_LC_BATXAT_0003', CURRENT_TIMESTAMP - INTERVAL '24 hours', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 142.8, 'OPEN_METEO', 'good'),
('VN_LC_SAPA_0004', CURRENT_TIMESTAMP - INTERVAL '24 hours', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 98.6, 'OPEN_METEO', 'good'),
('VN_LC_SAPA_0005', CURRENT_TIMESTAMP - INTERVAL '24 hours', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 168.2, 'OPEN_METEO', 'good')
ON CONFLICT (unit_id, interval_start, interval_end, source_provider, source_revision) DO NOTHING;

-- 3. SEED DỰ BÁO LƯỢNG MƯA 24H TIẾP THEO
-- ------------------------------------------------------------------------------
INSERT INTO gis_schema.rainfall_forecasts (
    unit_id, provider_run_id, provider_name, issued_at, valid_from, valid_until, available_at, predicted_rain_24h_mm
) VALUES
('VN_LC_BATXAT_0001', 'RUN_20261014_00Z', 'OPEN_METEO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP, 130.5),
('VN_LC_BATXAT_0002', 'RUN_20261014_00Z', 'OPEN_METEO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP, 75.0),
('VN_LC_BATXAT_0003', 'RUN_20261014_00Z', 'OPEN_METEO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP, 155.0),
('VN_LC_SAPA_0004', 'RUN_20261014_00Z', 'OPEN_METEO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP, 110.0),
('VN_LC_SAPA_0005', 'RUN_20261014_00Z', 'OPEN_METEO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP, 185.0)
ON CONFLICT (unit_id, provider_run_id, valid_from, valid_until) DO NOTHING;

-- 4. SEED FEATURE SNAPSHOT MẪU CHO AI INFERENCE
-- ------------------------------------------------------------------------------
INSERT INTO gis_schema.feature_snapshots (
    snapshot_id, unit_id, as_of_time, features, coverage_quality
) VALUES
('11111111-1111-1111-1111-111111111111', 'VN_LC_BATXAT_0003', CURRENT_TIMESTAMP, 
 '{"slope_avg": 41.2, "relief_m": 340.0, "rain_1h_mm": 22.5, "rain_24h_acc_mm": 142.8, "rain_72h_acc_mm": 230.0, "rain_7d_acc_mm": 310.0, "forecast_next_24h_mm": 155.0}'::jsonb, 
 'good')
ON CONFLICT (unit_id, unit_version, as_of_time, schema_version) DO NOTHING;

-- 5. SEED DỰ BÁO SẠT LỞ MẪU (FORECAST RUN)
-- ------------------------------------------------------------------------------
INSERT INTO core_schema.forecast_runs (
    run_id, snapshot_id, unit_id, issued_at, valid_from, valid_until, horizon_hours,
    probability, experimental_score, hazard_level, model_version, threshold_version,
    contributing_factors, review_status, is_active
) VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'VN_LC_BATXAT_0003',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours', 24,
 0.88, 0.88, 'high', 'xgboost-baseline-v1', 'th-v1',
 '[{"factor": "forecast_rain_24h", "val": 155.0, "weight": 0.45}, {"factor": "slope", "val": 41.2, "weight": 0.35}]'::jsonb,
 'pending', TRUE)
ON CONFLICT (run_id) DO NOTHING;
