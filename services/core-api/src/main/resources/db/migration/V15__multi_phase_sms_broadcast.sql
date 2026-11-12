-- Story 4.39: Multi-phase SMS broadcast support

-- 1. Incident phase on broadcasts
ALTER TABLE core_schema.alert_broadcasts
    ADD COLUMN IF NOT EXISTS incident_phase VARCHAR(30) NOT NULL DEFAULT 'during_incident'
        CHECK (incident_phase IN ('pre_incident', 'during_incident', 'post_incident')),
    ADD COLUMN IF NOT EXISTS total_sms_recipients INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS successful_sms INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS failed_sms INT DEFAULT 0;

-- 2. Channel + provider tracking on deliveries
ALTER TABLE core_schema.alert_deliveries
    ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'app_push'
        CHECK (channel IN ('app_push', 'sms')),
    ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(100);

-- 3. Seed: verified Twilio test phone on citizen Hoàng Văn Dũng
UPDATE core_schema.users SET phone_number = '0854346968'
WHERE user_id = '33333333-3333-3333-3333-333333333333';

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_broadcasts_phase ON core_schema.alert_broadcasts(incident_phase);
CREATE INDEX IF NOT EXISTS idx_deliveries_channel_status ON core_schema.alert_deliveries(channel, status);

