-- Story 1.5: profile update and per-area alert subscriptions.
-- users.auth_provider lets clients hide "change password" for Google-only accounts.
ALTER TABLE core_schema.users
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'email';

-- Subscriptions by monitoring area (gis_schema.monitoring_areas) with per-channel preferences.
ALTER TABLE core_schema.alert_subscriptions ALTER COLUMN province DROP NOT NULL;
ALTER TABLE core_schema.alert_subscriptions
    ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES gis_schema.monitoring_areas(area_id) ON DELETE CASCADE;
ALTER TABLE core_schema.alert_subscriptions
    ADD COLUMN IF NOT EXISTS channel_push BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE core_schema.alert_subscriptions
    ADD COLUMN IF NOT EXISTS channel_sms BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_user_area_subscription
    ON core_schema.alert_subscriptions (user_id, area_id) WHERE area_id IS NOT NULL;
