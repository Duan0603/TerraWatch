-- Local/demo use only. All three accounts use password: TerraWatch@2026
-- Run from repository root:
-- Get-Content services/core-api/scripts/seed-demo-users.sql -Raw | docker exec -i terrawatch-postgis psql -U postgres -d terrawatch -v ON_ERROR_STOP=1
-- Existing accounts and passwords are preserved on repeated runs.
INSERT INTO core_schema.users (full_name, email, password_hash, role)
VALUES
    ('Demo Admin', 'demo.admin@terrawatch.vn', '$2a$10$f89iAlInz0tjvg53Y6gOuuG.esQGxek7FUASeLtFd2.72lC1R49jy', 'admin'),
    ('Demo Officer', 'demo.officer@terrawatch.vn', '$2a$10$f89iAlInz0tjvg53Y6gOuuG.esQGxek7FUASeLtFd2.72lC1R49jy', 'officer'),
    ('Demo Citizen', 'demo.citizen@terrawatch.vn', '$2a$10$f89iAlInz0tjvg53Y6gOuuG.esQGxek7FUASeLtFd2.72lC1R49jy', 'citizen')
ON CONFLICT (email) DO NOTHING;
