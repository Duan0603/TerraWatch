-- Story 4.5: database/seed.sql (Postgres container init) and Flyway V2 both seed the same three monitoring
-- areas, and nothing made names unique, so every fresh install listed each area twice (and a citizen could
-- subscribe to one copy while an admin broadcast to the other). Keep the lowest id per name, move every
-- reference to it, delete the copies, then make names unique so it cannot happen again.
CREATE TEMP TABLE area_duplicates AS
SELECT a.area_id AS duplicate_id, k.keep_id
FROM gis_schema.monitoring_areas a
JOIN (SELECT name, MIN(area_id) AS keep_id FROM gis_schema.monitoring_areas GROUP BY name HAVING COUNT(*) > 1) k
  ON k.name = a.name
WHERE a.area_id <> k.keep_id;

-- A citizen subscribed to both copies keeps only the subscription on the kept area.
UPDATE core_schema.alert_subscriptions s SET area_id = d.keep_id
FROM area_duplicates d
WHERE s.area_id = d.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM core_schema.alert_subscriptions x WHERE x.user_id = s.user_id AND x.area_id = d.keep_id);
DELETE FROM core_schema.alert_subscriptions s USING area_duplicates d WHERE s.area_id = d.duplicate_id;

UPDATE gis_schema.spatial_assessment_units u SET area_id = d.keep_id FROM area_duplicates d WHERE u.area_id = d.duplicate_id;
UPDATE core_schema.alert_broadcasts b SET area_id = d.keep_id FROM area_duplicates d WHERE b.area_id = d.duplicate_id;

DELETE FROM gis_schema.monitoring_areas a USING area_duplicates d WHERE a.area_id = d.duplicate_id;
DROP TABLE area_duplicates;

CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_monitoring_area_name ON gis_schema.monitoring_areas (name);
