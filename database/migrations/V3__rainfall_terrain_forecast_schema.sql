-- ==============================================================================
-- TerraWatch / GeoSentry - PostGIS Migration V3
-- Epic 1 / Story 1.2: PostGIS Forecast and Observation Schema & Spatial Indexes
-- Purpose: Schema additions for 24h Rainfall-Terrain Landslide Forecasting
-- Architecture: Logical Schema-per-Service (gis_schema & core_schema)
-- ==============================================================================

-- 1. ENUM TYPES CREATION (Safe idempotency pattern)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE core_schema.forecast_review_status AS ENUM ('pending', 'approved', 'rejected', 'superseded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE core_schema.alert_delivery_status AS ENUM ('pending', 'sent', 'delivered', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. GIS SCHEMA: SPATIAL ASSESSMENT UNITS (LƯỚI ĐÁNH GIÁ NGUY CƠ 1KM X 1KM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gis_schema.spatial_assessment_units (
    unit_id VARCHAR(50) PRIMARY KEY,
    area_id INT REFERENCES gis_schema.monitoring_areas(area_id) ON DELETE SET NULL,
    unit_name VARCHAR(150),
    admin_province VARCHAR(100) NOT NULL,
    admin_district VARCHAR(100) NOT NULL,
    admin_commune VARCHAR(100),
    unit_version VARCHAR(20) DEFAULT 'v1',
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    centroid GEOMETRY(Point, 4326),
    area_m2 FLOAT,
    slope_avg FLOAT,
    slope_max FLOAT,
    elevation_avg FLOAT,
    relief_m FLOAT,
    dem_source VARCHAR(100) DEFAULT 'SRTM_30M',
    dem_resolution_m FLOAT DEFAULT 30.0,
    effective_resolution_m FLOAT DEFAULT 1000.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger tự động cập nhật Centroid và Diện tích (m²) cho Assessment Unit
CREATE OR REPLACE FUNCTION gis_schema.fn_update_assessment_unit_metrics()
RETURNS TRIGGER AS $$
BEGIN
    NEW.centroid := ST_Centroid(NEW.geom);
    NEW.area_m2 := ST_Area(NEW.geom::geography);
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assessment_unit_metrics ON gis_schema.spatial_assessment_units;
CREATE TRIGGER trg_assessment_unit_metrics
BEFORE INSERT OR UPDATE OF geom ON gis_schema.spatial_assessment_units
FOR EACH ROW EXECUTE FUNCTION gis_schema.fn_update_assessment_unit_metrics();

-- 3. GIS SCHEMA: QUAN TRẮC LƯỢNG MƯA LỊCH SỬ (HISTORICAL OBSERVATIONS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gis_schema.rainfall_observations (
    observation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id VARCHAR(50) NOT NULL REFERENCES gis_schema.spatial_assessment_units(unit_id) ON DELETE CASCADE,
    interval_start TIMESTAMP WITH TIME ZONE NOT NULL,
    interval_end TIMESTAMP WITH TIME ZONE NOT NULL,
    available_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rainfall_mm FLOAT, -- NULL when quality_flag = 'missing'; never substitute 0.0 for missing data
    source_provider VARCHAR(50) NOT NULL, -- e.g., 'OPEN_METEO', 'NASA_GPM_IMERG'
    source_revision VARCHAR(50) DEFAULT 'v1',
    quality_flag VARCHAR(30) DEFAULT 'good', -- 'good', 'estimated', 'stale', 'missing'
    is_gap_filled BOOLEAN DEFAULT FALSE,
    CONSTRAINT uq_rainfall_obs UNIQUE (unit_id, interval_start, interval_end, source_provider, source_revision)
);

-- 4. GIS SCHEMA: DỰ BÁO LƯỢNG MƯA THỜI TIẾT 24H (WEATHER FORECASTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gis_schema.rainfall_forecasts (
    forecast_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id VARCHAR(50) NOT NULL REFERENCES gis_schema.spatial_assessment_units(unit_id) ON DELETE CASCADE,
    provider_run_id VARCHAR(100) NOT NULL, -- e.g., 'OPEN_METEO_RUN_20261014_00Z'
    provider_name VARCHAR(50) NOT NULL, -- e.g., 'OPEN_METEO', 'ECMWF_OPEN_DATA'
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    available_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    predicted_rain_24h_mm FLOAT NOT NULL,
    accumulation_interval_hours INT DEFAULT 24,
    quality_flag VARCHAR(30) DEFAULT 'good',
    CONSTRAINT uq_rainfall_forecast UNIQUE (unit_id, provider_run_id, valid_from, valid_until)
);

-- 5. GIS SCHEMA: ẢNH CHỤP ĐẶC TRƯNG BẤT BIẾN (FEATURE SNAPSHOTS CHO AI)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gis_schema.feature_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_version VARCHAR(50) DEFAULT 'rainfall-terrain-24h.v1',
    unit_id VARCHAR(50) NOT NULL REFERENCES gis_schema.spatial_assessment_units(unit_id) ON DELETE CASCADE,
    unit_version VARCHAR(20) DEFAULT 'v1',
    as_of_time TIMESTAMP WITH TIME ZONE NOT NULL,
    features JSONB NOT NULL,
    coverage_quality VARCHAR(30) DEFAULT 'good', -- 'good', 'stale', 'missing'
    source_references JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_feature_snapshot UNIQUE (unit_id, unit_version, as_of_time, schema_version)
);

-- 6. CORE SCHEMA: DỰ BÁO SẠT LỞ 24H (FORECAST RUNS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_schema.forecast_runs (
    run_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID REFERENCES gis_schema.feature_snapshots(snapshot_id) ON DELETE SET NULL,
    unit_id VARCHAR(50) NOT NULL REFERENCES gis_schema.spatial_assessment_units(unit_id) ON DELETE CASCADE,
    unit_version VARCHAR(20) DEFAULT 'v1',
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    horizon_hours INT DEFAULT 24,
    availability VARCHAR(30) DEFAULT 'available' CHECK (availability IN ('available', 'unavailable')),
    unavailability_reason TEXT,
    probability FLOAT, -- Calibrated probability [0.0, 1.0]
    experimental_score FLOAT, -- Baseline heuristic score [0.0, 1.0]
    hazard_level core_schema.risk_level DEFAULT 'medium',
    model_version VARCHAR(50) NOT NULL,
    threshold_version VARCHAR(50) NOT NULL,
    contributing_factors JSONB,
    input_quality JSONB,
    review_status core_schema.forecast_review_status DEFAULT 'pending',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. CORE SCHEMA: NHẬT KÝ THẨM ĐỊNH CỦA CÁN BỘ (AUDIT REVIEWS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_schema.forecast_reviews (
    review_id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES core_schema.forecast_runs(run_id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES core_schema.users(user_id) ON DELETE SET NULL,
    decision core_schema.forecast_review_status NOT NULL CHECK (decision IN ('approved', 'rejected')),
    reason_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. CORE SCHEMA: ĐĂNG KÝ CẢNH BÁO CỦA CÔNG DÂN & PHÁT LỆNH KHẨN CẤP
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_schema.alert_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core_schema.users(user_id) ON DELETE CASCADE,
    province VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    commune VARCHAR(100),
    unit_id VARCHAR(50) REFERENCES gis_schema.spatial_assessment_units(unit_id) ON DELETE CASCADE,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT uq_user_subscription_base UNIQUE (user_id, province, district, commune)
);

-- Partial unique index handles NULL district/commune correctly (NULL != NULL in standard UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_user_subscription
    ON core_schema.alert_subscriptions (user_id, province, COALESCE(district, ''), COALESCE(commune, ''));

CREATE TABLE IF NOT EXISTS core_schema.alert_broadcasts (
    broadcast_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES core_schema.forecast_runs(run_id) ON DELETE SET NULL,
    unit_id VARCHAR(50) REFERENCES gis_schema.spatial_assessment_units(unit_id) ON DELETE SET NULL,
    sender_id UUID REFERENCES core_schema.users(user_id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity core_schema.risk_level DEFAULT 'high',
    target_channel VARCHAR(30) DEFAULT 'all', -- 'all', 'app_push', 'sms'
    idempotency_key VARCHAR(100) UNIQUE,
    broadcast_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_recipients INT DEFAULT 0,
    successful_deliveries INT DEFAULT 0,
    failed_deliveries INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS core_schema.alert_deliveries (
    delivery_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broadcast_id UUID NOT NULL REFERENCES core_schema.alert_broadcasts(broadcast_id) ON DELETE CASCADE,
    user_id UUID REFERENCES core_schema.users(user_id) ON DELETE SET NULL,
    phone_number VARCHAR(20),
    fcm_token TEXT,
    status core_schema.alert_delivery_status DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. SPATIAL & PERFORMANCE INDEXES (GIST & COMPOSITE B-TREE)
-- ------------------------------------------------------------------------------
-- Spatial GIST Indexes
CREATE INDEX IF NOT EXISTS idx_assessment_units_geom ON gis_schema.spatial_assessment_units USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_assessment_units_centroid ON gis_schema.spatial_assessment_units USING GIST (centroid);

-- B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_rainfall_obs_unit_time ON gis_schema.rainfall_observations (unit_id, interval_end DESC);
CREATE INDEX IF NOT EXISTS idx_rainfall_forecast_valid ON gis_schema.rainfall_forecasts (unit_id, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_feature_snapshot_asof ON gis_schema.feature_snapshots (unit_id, as_of_time DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_runs_validity ON core_schema.forecast_runs (valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_forecast_runs_status ON core_schema.forecast_runs (review_status, is_active);
CREATE INDEX IF NOT EXISTS idx_forecast_runs_unit ON core_schema.forecast_runs (unit_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON core_schema.alert_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_broadcast ON core_schema.alert_deliveries (broadcast_id);

-- 10. SPATIAL VIEW: VÙNG NGUY CƠ DỰ BÁO ĐÃ PHÊ DUYỆT (CHO WEBGIS & MOBILE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW core_schema.v_active_forecast_hazards AS
SELECT 
    f.run_id,
    f.unit_id,
    u.unit_name,
    u.admin_province,
    u.admin_district,
    f.hazard_level,
    f.probability,
    f.experimental_score,
    f.valid_from,
    f.valid_until,
    f.horizon_hours,
    f.model_version,
    f.contributing_factors,
    u.geom,
    u.centroid,
    u.slope_avg,
    u.elevation_avg
FROM core_schema.forecast_runs f
JOIN gis_schema.spatial_assessment_units u ON f.unit_id = u.unit_id
WHERE f.review_status = 'approved' 
  AND f.is_active = TRUE
  AND CURRENT_TIMESTAMP BETWEEN f.valid_from AND f.valid_until;
