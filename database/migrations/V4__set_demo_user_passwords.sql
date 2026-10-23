-- ==============================================================================
-- TerraWatch / GeoSentry - Migration V4
-- Purpose: Set a known demo password for the three V2-seeded accounts so the
--          login page can actually demo admin/officer/citizen roles end to end.
--          The V2 seed's original password_hash had no recorded plaintext.
-- Demo password for all three accounts below: Terrawatch@2026
-- Hash computed by the app's own BCryptPasswordEncoder (not hand-rolled) via a
-- real POST /api/v1/auth/register call against this schema, then copied here.
-- ==============================================================================

UPDATE core_schema.users
SET password_hash = '$2a$10$FHtArUHHrS5MYmIG51t0EuLKRjXVD3HKg.HidHsU29PdaOt.a6gRS'
WHERE email IN (
    'admin@terrawatch.vn',
    'officer.yenbai@terrawatch.vn',
    'citizen.limmong@terrawatch.vn'
);
