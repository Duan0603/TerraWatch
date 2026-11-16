-- Demo officer shows as "Cán bộ Thẩm định" (no province) in the dashboard header.
UPDATE core_schema.users
SET full_name = 'Cán bộ Thẩm định'
WHERE email = 'officer.yenbai@terrawatch.vn' AND full_name = 'Cán bộ Thẩm định Yên Bái';
