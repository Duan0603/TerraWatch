-- ========================================================
-- GeoSentry / TerraWatch - Seed Data (Vietnam Focus)
-- Areas: Mù Cang Chải (Yên Bái), Sa Pa (Lào Cai), Hoàng Su Phì (Hà Giang)
-- ========================================================

-- 1. Users (BCrypt hashed passwords for Admin, Officer, Citizen)
INSERT INTO users (user_id, full_name, email, password_hash, role, phone_number)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Ban Chỉ Đạo Quốc Gia PCTT', 'admin@terrawatch.vn', '$2b$10$w0M/44Z6F4Yw8YgJ22Jd.OTJjYp4EKnSvy/3o1sVepvI7fL50d2tq', 'admin', '0901234567'),
    ('22222222-2222-2222-2222-222222222222', 'Cán bộ Thẩm định Yên Bái', 'officer.yenbai@terrawatch.vn', '$2b$10$w0M/44Z6F4Yw8YgJ22Jd.OTJjYp4EKnSvy/3o1sVepvI7fL50d2tq', 'officer', '0912345678'),
    ('33333333-3333-3333-3333-333333333333', 'Hoàng Văn Dũng (Bản Lìm Mông)', 'citizen.limmong@terrawatch.vn', '$2b$10$w0M/44Z6F4Yw8YgJ22Jd.OTJjYp4EKnSvy/3o1sVepvI7fL50d2tq', 'citizen', '0987654321')
ON CONFLICT (email) DO NOTHING;

-- 2. Monitoring Areas (AOIs)
INSERT INTO monitoring_areas (name, geom, description, is_active)
VALUES 
    (
        'Vùng trọng điểm 1: Mù Cang Chải (Yên Bái)',
        ST_Multi(ST_GeomFromText('POLYGON((104.05 21.80, 104.22 21.80, 104.22 21.92, 104.05 21.92, 104.05 21.80))', 4326)),
        'Vùng đồi núi dốc trên 35 độ, đất phong hóa dày, nguy cơ sạt lở cực lớn khi mưa kéo dài',
        true
    ),
    (
        'Vùng trọng điểm 2: Sa Pa & Bát Xát (Lào Cai)',
        ST_Multi(ST_GeomFromText('POLYGON((103.75 22.30, 103.90 22.30, 103.90 22.45, 103.75 22.45, 103.75 22.30))', 4326)),
        'Khu vực đèo Ô Quy Hồ và sườn đông Hoàng Liên Sơn',
        true
    ),
    (
        'Vùng trọng điểm 3: Hoàng Su Phì (Hà Giang)',
        ST_Multi(ST_GeomFromText('POLYGON((104.60 22.65, 104.75 22.65, 104.75 22.80, 104.60 22.80, 104.60 22.65))', 4326)),
        'Địa hình chia cắt mạnh, độ dốc lớn kết hợp thảm thực vật suy giảm',
        true
    )
ON CONFLICT DO NOTHING;

-- 3. Landslide Events
-- Event A: Chờ thẩm định (Pending) - Mù Cang Chải
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
    ST_Multi(ST_GeomFromText('POLYGON((104.085 21.845, 104.089 21.845, 104.089 21.849, 104.085 21.849, 104.085 21.845))', 4326)),
    'high',
    'pending',
    0.89,
    37.2,
    -0.48,
    'S2A_MSIL2A_20261001T033531_N0500_R104'
) ON CONFLICT (event_id) DO NOTHING;

-- Event B: Đã phê duyệt (Verified Extreme) - Khau Phạ
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
    ST_Multi(ST_GeomFromText('POLYGON((104.110 21.860, 104.116 21.860, 104.116 21.867, 104.110 21.867, 104.110 21.860))', 4326)),
    'extreme',
    'verified',
    0.96,
    43.5,
    -0.62,
    'Sạt trượt taluy dương đứt gãy 200m đường QL32, đã phát lệnh sơ tán khẩn cấp 15 hộ dân bản Dế Xu Phình',
    '22222222-2222-2222-2222-222222222222',
    NOW() - INTERVAL '2 hours',
    'S2B_MSIL2A_20260928T033529_N0500_R104'
) ON CONFLICT (event_id) DO NOTHING;

-- Event C: Đã phê duyệt (Verified Medium) - Sa Pa
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
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    ST_Multi(ST_GeomFromText('POLYGON((103.820 22.340, 103.824 22.340, 103.824 22.344, 103.820 22.344, 103.820 22.340))', 4326)),
    'medium',
    'verified',
    0.78,
    28.0,
    -0.35,
    'Sạt lở nhẹ ta-luy đường bê tông nông thôn bản Tả Phìn, xe máy di chuyển thận trọng',
    '22222222-2222-2222-2222-222222222222',
    NOW() - INTERVAL '5 hours',
    'S2A_MSIL2A_20260926T034000_N0500_R061'
) ON CONFLICT (event_id) DO NOTHING;

-- 4. Community Reports (Crowdsourcing)
INSERT INTO community_reports (user_id, location, image_url, description, status)
VALUES 
    (
        '33333333-3333-3333-3333-333333333333',
        ST_SetSRID(ST_MakePoint(104.113, 21.864), 4326),
        'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
        'Đất đá tràn qua đường liên xã, có vết nứt dài trên sườn đồi, nguy cơ tiếp tục sạt.',
        'submitted'
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        ST_SetSRID(ST_MakePoint(103.822, 22.342), 4326),
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23',
        'Nước bùn đất chảy xiết qua cống tràn bản Tả Phìn, đã cảnh báo người dân.',
        'processed'
    );
