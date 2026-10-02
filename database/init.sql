-- ========================================================
-- GeoSentry / TerraWatch - PostGIS Spatial Database Schema
-- Reference: Tai_Lieu_Yeu_Cau_Va_Thiet_Ke_He_Thong_Canh_Bao_Sat_Lo_Dat.docx
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
    satellite_scene_id VARCHAR(100) -- Liên kết metadata ảnh vệ tinh (Sentinel-2 / Landsat-8)
);

-- 5. Bảng báo cáo từ cộng đồng (Crowdsourcing)
CREATE TABLE IF NOT EXISTS community_reports (
    report_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    report_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    location GEOMETRY(Point, 4326) NOT NULL,
    image_url TEXT,
    description TEXT,
    status report_status DEFAULT 'submitted'
);

-- 6. Spatial Indices (GIST)
CREATE INDEX IF NOT EXISTS idx_landslide_geom ON landslide_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_landslide_centroid ON landslide_events USING GIST (centroid);
CREATE INDEX IF NOT EXISTS idx_monitoring_areas_geom ON monitoring_areas USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_reports_location ON community_reports USING GIST (location);

-- 7. Trigger tự động tính toán Centroid & Diện tích (m2)
CREATE OR REPLACE FUNCTION fn_update_landslide_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Tự động tính điểm trọng tâm WGS84
    NEW.centroid := ST_Centroid(NEW.geom);
    -- Tự động tính diện tích thực tế m2 bằng geography cast
    NEW.affected_area_m2 := ST_Area(NEW.geom::geography);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_landslide_metrics ON landslide_events;
CREATE TRIGGER trg_landslide_metrics
BEFORE INSERT OR UPDATE OF geom ON landslide_events
FOR EACH ROW EXECUTE FUNCTION fn_update_landslide_metrics();
