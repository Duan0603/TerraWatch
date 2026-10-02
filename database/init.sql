-- ========================================================
-- GeoSentry / TerraWatch - PostGIS Spatial Database Schema
-- Architecture: Logical Schema-per-Service (Phương án A)
-- Enterprise-grade Academic Specification for Capstone Defense
-- ========================================================

-- Kích hoạt tiện ích mở rộng không gian PostGIS & UUID tại schema public
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "postgis" SCHEMA public;

-- Khởi tạo Logical Schemas cho Microservices (Phương án A)
CREATE SCHEMA IF NOT EXISTS core_schema;
CREATE SCHEMA IF NOT EXISTS gis_schema;

-- Thiết lập search_path mặc định
SET search_path TO core_schema, gis_schema, public;

-- ========================================================
-- 1. CORE SCHEMA (Quản lý User, Event Sạt lở, Thẩm định, Báo cáo)
-- ========================================================

-- Định nghĩa các kiểu dữ liệu Enum trong core_schema
DO $$ BEGIN
    CREATE TYPE core_schema.user_role AS ENUM ('admin', 'officer', 'citizen');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE core_schema.risk_level AS ENUM ('low', 'medium', 'high', 'extreme');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE core_schema.verification_status AS ENUM ('pending', 'verified', 'rejected', 'false_alarm');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE core_schema.report_status AS ENUM ('submitted', 'processed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bảng người dùng và cán bộ (core_schema.users)
CREATE TABLE IF NOT EXISTS core_schema.users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role core_schema.user_role DEFAULT 'citizen',
    phone_number VARCHAR(20),
    fcm_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lưu trữ sự kiện sạt lở (core_schema.landslide_events)
CREATE TABLE IF NOT EXISTS core_schema.landslide_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    detection_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    centroid GEOMETRY(Point, 4326),
    risk_level core_schema.risk_level DEFAULT 'medium',
    status core_schema.verification_status DEFAULT 'pending',
    confidence_score FLOAT DEFAULT 0.0,
    slope_degrees FLOAT,
    ndvi_drop FLOAT,
    affected_area_m2 FLOAT,
    officer_note TEXT,
    verified_by UUID REFERENCES core_schema.users(user_id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    satellite_scene_id VARCHAR(100), -- Liên kết metadata ảnh vệ tinh (Sentinel-2 / Landsat-8)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lịch sử kiểm định (Audit Trail) - Phục vụ truy vết pháp lý và khoa học
CREATE TABLE IF NOT EXISTS core_schema.landslide_event_history (
    history_id SERIAL PRIMARY KEY,
    event_id UUID REFERENCES core_schema.landslide_events(event_id) ON DELETE CASCADE,
    previous_status core_schema.verification_status,
    new_status core_schema.verification_status,
    changed_by UUID REFERENCES core_schema.users(user_id) ON DELETE SET NULL,
    note TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng báo cáo từ cộng đồng (core_schema.community_reports)
CREATE TABLE IF NOT EXISTS core_schema.community_reports (
    report_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES core_schema.users(user_id) ON DELETE SET NULL,
    report_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    location GEOMETRY(Point, 4326) NOT NULL,
    image_url TEXT,
    description TEXT,
    status core_schema.report_status DEFAULT 'submitted'
);

-- Spatial Indices (GIST) cho core_schema
CREATE INDEX IF NOT EXISTS idx_landslide_geom ON core_schema.landslide_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_landslide_centroid ON core_schema.landslide_events USING GIST (centroid);
CREATE INDEX IF NOT EXISTS idx_reports_location ON core_schema.community_reports USING GIST (location);

-- Trigger tự động tính toán Centroid & Diện tích thực tế (m²)
CREATE OR REPLACE FUNCTION core_schema.fn_update_landslide_metrics()
RETURNS TRIGGER AS $$
BEGIN
    NEW.centroid := ST_Centroid(NEW.geom);
    NEW.affected_area_m2 := ST_Area(NEW.geom::geography);
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_landslide_metrics ON core_schema.landslide_events;
CREATE TRIGGER trg_landslide_metrics
BEFORE INSERT OR UPDATE OF geom ON core_schema.landslide_events
FOR EACH ROW EXECUTE FUNCTION core_schema.fn_update_landslide_metrics();

-- Trigger tự động ghi nhật ký thẩm định (Audit History Trigger)
CREATE OR REPLACE FUNCTION core_schema.fn_log_landslide_verification()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO core_schema.landslide_event_history (event_id, previous_status, new_status, changed_by, note)
        VALUES (NEW.event_id, OLD.status, NEW.status, NEW.verified_by, NEW.officer_note);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_verification ON core_schema.landslide_events;
CREATE TRIGGER trg_log_verification
AFTER UPDATE ON core_schema.landslide_events
FOR EACH ROW EXECUTE FUNCTION core_schema.fn_log_landslide_verification();

-- Spatial View: Vùng đệm nguy hiểm 500m phục vụ cảnh báo nhanh
CREATE OR REPLACE VIEW core_schema.v_active_landslide_zones AS
SELECT 
    event_id,
    risk_level,
    affected_area_m2,
    slope_degrees,
    geom,
    centroid,
    ST_Buffer(geom::geography, 500)::geometry AS danger_buffer_500m
FROM core_schema.landslide_events
WHERE status = 'verified';

-- ========================================================
-- 2. GIS SCHEMA (Quản lý Khu vực Giám sát AOI & Vector Tiles)
-- ========================================================

-- Bảng các khu vực cần giám sát (gis_schema.monitoring_areas)
CREATE TABLE IF NOT EXISTS gis_schema.monitoring_areas (
    area_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Spatial Index (GIST) cho gis_schema
CREATE INDEX IF NOT EXISTS idx_monitoring_areas_geom ON gis_schema.monitoring_areas USING GIST (geom);
