-- Sample seed data for development and testing

-- 1. Sample Users (password: Admin@123 / Officer@123 / Citizen@123 - bcrypt hash placeholder)
INSERT INTO users (user_id, full_name, email, password_hash, role, phone_number)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'System Administrator', 'admin@terrawatch.vn', '$2b$10$w0M/44Z6F4Yw8YgJ22Jd.OTJjYp4EKnSvy/3o1sVepvI7fL50d2tq', 'admin', '0901234567'),
    ('22222222-2222-2222-2222-222222222222', 'Cán bộ Kiểm định Yên Bái', 'officer@terrawatch.vn', '$2b$10$w0M/44Z6F4Yw8YgJ22Jd.OTJjYp4EKnSvy/3o1sVepvI7fL50d2tq', 'officer', '0912345678'),
    ('33333333-3333-3333-3333-333333333333', 'Người dân Mù Cang Chải', 'citizen@terrawatch.vn', '$2b$10$w0M/44Z6F4Yw8YgJ22Jd.OTJjYp4EKnSvy/3o1sVepvI7fL50d2tq', 'citizen', '0987654321')
ON CONFLICT (email) DO NOTHING;

-- 2. Sample Monitoring Area (AOI - Mù Cang Chải, Yên Bái)
INSERT INTO monitoring_areas (name, geom, description, is_active)
VALUES (
    'Khu vực trọng điểm Mù Cang Chải',
    ST_Multi(ST_GeomFromText('POLYGON((104.05 21.80, 104.20 21.80, 104.20 21.90, 104.05 21.90, 104.05 21.80))', 4326)),
    'Vùng đồi núi có độ dốc cao > 30 độ, nguy cơ sạt lở cao trong mùa mưa lũ',
    true
) ON CONFLICT DO NOTHING;

-- 3. Sample Landslide Events
-- Event 1: Pending verification
INSERT INTO landslide_events (
    event_id,
    geom,
    risk_level,
    status,
    confidence_score,
    slope_degrees,
    ndvi_drop,
    satellite_scene_id
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    ST_Multi(ST_GeomFromText('POLYGON((104.085 21.845, 104.088 21.845, 104.088 21.848, 104.085 21.848, 104.085 21.845))', 4326)),
    'high',
    'pending',
    0.88,
    34.5,
    -0.42,
    'S2A_MSIL2A_20261001T033531_N0500_R104'
) ON CONFLICT (event_id) DO NOTHING;

-- Event 2: Verified event
INSERT INTO landslide_events (
    event_id,
    geom,
    risk_level,
    status,
    confidence_score,
    slope_degrees,
    ndvi_drop,
    officer_note,
    verified_by,
    verified_at,
    satellite_scene_id
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ST_Multi(ST_GeomFromText('POLYGON((104.110 21.860, 104.115 21.860, 104.115 21.865, 104.110 21.865, 104.110 21.860))', 4326)),
    'extreme',
    'verified',
    0.95,
    42.0,
    -0.58,
    'Đã xác nhận sạt lở ta-luy dương chia cắt đường liên xã, cần sơ tán khẩn cấp',
    '22222222-2222-2222-2222-222222222222',
    NOW(),
    'S2B_MSIL2A_20260928T033529_N0500_R104'
) ON CONFLICT (event_id) DO NOTHING;

-- 4. Sample Community Report
INSERT INTO community_reports (user_id, location, image_url, description, status)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    ST_SetSRID(ST_MakePoint(104.112, 21.862), 4326),
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
    'Đất đá tràn xuống mặt đường khoảng 50m, xe máy không qua lại được.',
    'submitted'
);
