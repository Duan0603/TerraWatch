-- Story 4.43: Làng Nủ (Phúc Khánh, Bảo Yên, Lào Cai) as a monitoring area, so citizens can follow it and admins can
-- broadcast to it. It is the one site with the calibrated rain-threshold warning and debris-flow extent (Story 4.41).
-- The box covers the 2024 track from the scar (~786 m) down to the village and the valley floor below it.
INSERT INTO gis_schema.monitoring_areas (name, geom, description, is_active)
VALUES (
    'Vùng trọng điểm 4: Làng Nủ (Lào Cai)',
    ST_Multi(ST_GeomFromText('POLYGON((104.512 22.108, 104.548 22.108, 104.548 22.152, 104.512 22.152, 104.512 22.108))', 4326)),
    'Thung lũng Làng Nủ, xã Phúc Khánh: lũ bùn đá 10/9/2024 (67 người thiệt mạng). Có cảnh báo theo ngưỡng mưa riêng và mô hình phạm vi dòng bùn đá.',
    TRUE
)
ON CONFLICT (name) DO NOTHING;
