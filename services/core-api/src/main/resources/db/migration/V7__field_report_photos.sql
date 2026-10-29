-- Story 2.4: field reports with photo, occurrence time vs report time, provenance and an idempotency key.
-- Existing rows are untouched (all new columns are nullable or defaulted).

-- shortcut: photo stored as base64 text in Postgres (the client shrinks it to about 1280 px); move to object storage if volume grows.
CREATE TABLE IF NOT EXISTS core_schema.report_photos (
    photo_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES core_schema.users(user_id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL,
    image_base64 TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- report_time stays the server receive time (reported_at); observed_* is when the event was seen.
ALTER TABLE core_schema.community_reports
    ADD COLUMN IF NOT EXISTS client_report_id UUID,
    ADD COLUMN IF NOT EXISTS observed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS observed_until TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS location_accuracy_m DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS photo_id UUID REFERENCES core_schema.report_photos(photo_id) ON DELETE SET NULL;

-- Sending the same report again (same user + client id) must not create a second row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_report_client_id
    ON core_schema.community_reports (user_id, client_report_id)
    WHERE client_report_id IS NOT NULL;
