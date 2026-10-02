-- ========================================================
-- GeoSentry / TerraWatch - PostGIS Spatial Database Schema
-- Enterprise-grade Academic Specification for Capstone Defense
-- ========================================================

-- Kích hoạt tiện ích mở rộng cần thiết
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Định nghĩa các kiểu dữ liệu Enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'officer', 'citizen');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'extreme');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected', 'false_alarm');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('submitted', 'processed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Bảng người dùng và cán bộ
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role DEFAULT 'citizen',
    phone_number VARCHAR(20),
    fcm_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng các khu vực cần giám sát (AOI - Area of Interest)
CREATE TABLE IF NOT EXISTS monitoring_areas (
    area_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng lưu trữ sự kiện sạt lở (Kết quả từ AI & Thẩm định)
CREATE TABLE IF NOT EXISTS landslide_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    detection_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    centroid GEOMETRY(Point, 4326),
    risk_level risk_level DEFAULT 'medium',
    status verification_status DEFAULT 'pending',
    confidence_score FLOAT DEFAULT 0.0,
    slope_degrees FLOAT,
    ndvi_drop FLOAT,
    affected_area_m2 FLOAT,
    officer_note TEXT,
    verified_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    satellite_scene_id VARCHAR(100), -- Liên kết metadata ảnh vệ tinh (Sentinel-2 / Landsat-8)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bảng lịch sử kiểm định (Audit Trail) - Phục vụ truy vết pháp lý và khoa học
CREATE TABLE IF NOT EXISTS landslide_event_history (
    history_id SERIAL PRIMARY KEY,
    event_id UUID REFERENCES landslide_events(event_id) ON DELETE CASCADE,
    previous_status verification_status,
    new_status verification_status,
    changed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    note TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bảng báo cáo từ cộng đồng (Crowdsourcing)
CREATE TABLE IF NOT EXISTS community_reports (
    report_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    report_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    location GEOMETRY(Point, 4326) NOT NULL,
    image_url TEXT,
    description TEXT,
    status report_status DEFAULT 'submitted'
);

-- 7. Spatial Indices (GIST) - Tối ưu truy vấn không gian chuẩn OGC
CREATE INDEX IF NOT EXISTS idx_landslide_geom ON landslide_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_landslide_centroid ON landslide_events USING GIST (centroid);
CREATE INDEX IF NOT EXISTS idx_monitoring_areas_geom ON monitoring_areas USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_reports_location ON community_reports USING GIST (location);

-- 8. Trigger tự động tính toán Centroid & Diện tích thực tế (m²)
CREATE OR REPLACE FUNCTION fn_update_landslide_metrics()
RETURNS TRIGGER AS $$
BEGIN
    NEW.centroid := ST_Centroid(NEW.geom);
    NEW.affected_area_m2 := ST_Area(NEW.geom::geography);
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_landslide_metrics ON landslide_events;
CREATE TRIGGER trg_landslide_metrics
BEFORE INSERT OR UPDATE OF geom ON landslide_events
FOR EACH ROW EXECUTE FUNCTION fn_update_landslide_metrics();

-- 9. Trigger tự động ghi nhật ký thẩm định (Audit History Trigger)
CREATE OR REPLACE FUNCTION fn_log_landslide_verification()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO landslide_event_history (event_id, previous_status, new_status, changed_by, note)
        VALUES (NEW.event_id, OLD.status, NEW.status, NEW.verified_by, NEW.officer_note);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_verification ON landslide_events;
CREATE TRIGGER trg_log_verification
AFTER UPDATE ON landslide_events
FOR EACH ROW EXECUTE FUNCTION fn_log_landslide_verification();

-- 10. Spatial View: Vùng đệm nguy hiểm 500m phục vụ cảnh báo nhanh
CREATE OR REPLACE VIEW v_active_landslide_zones AS
SELECT 
    event_id,
    risk_level,
    affected_area_m2,
    slope_degrees,
    geom,
    centroid,
    ST_Buffer(geom::geography, 500)::geometry AS danger_buffer_500m
FROM landslide_events
WHERE status = 'verified';
