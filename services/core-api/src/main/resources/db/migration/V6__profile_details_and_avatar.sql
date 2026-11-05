-- Story 1.6: optional personal details, emergency contact and avatar.
ALTER TABLE core_schema.users
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
    ADD COLUMN IF NOT EXISTS province VARCHAR(100),
    ADD COLUMN IF NOT EXISTS district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS commune VARCHAR(100),
    ADD COLUMN IF NOT EXISTS address_line VARCHAR(200),
    ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(50),
    ADD COLUMN IF NOT EXISTS has_avatar BOOLEAN NOT NULL DEFAULT FALSE;

-- The image lives in its own table so ordinary user reads never carry the picture.
-- shortcut: base64 text in Postgres (client resizes to about 256 px, capped at 200 KB); move to object storage if photos grow.
CREATE TABLE IF NOT EXISTS core_schema.user_avatars (
    user_id UUID PRIMARY KEY REFERENCES core_schema.users(user_id) ON DELETE CASCADE,
    image_base64 TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
