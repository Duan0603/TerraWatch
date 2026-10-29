-- Story 5.1: push registration and broadcasts that carry validity.
-- One row per phone (FCM token); a token registered by another account moves to that account.
CREATE TABLE IF NOT EXISTS core_schema.device_tokens (
    fcm_token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES core_schema.users(user_id) ON DELETE CASCADE,
    device_type VARCHAR(20) NOT NULL DEFAULT 'android',
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON core_schema.device_tokens (user_id);

-- A broadcast targets one monitoring area, is valid for a window and can be revoked.
ALTER TABLE core_schema.alert_broadcasts
    ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES gis_schema.monitoring_areas(area_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_deliveries_user ON core_schema.alert_deliveries (user_id);
