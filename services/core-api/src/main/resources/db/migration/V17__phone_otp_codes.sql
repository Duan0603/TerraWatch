-- Story 4.44: 6-digit phone codes sent by our own SMS gateway (replaces Firebase Phone Auth on the web). Only hashes are stored.
CREATE TABLE IF NOT EXISTS core_schema.phone_otp_codes (
    otp_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone       VARCHAR(20)  NOT NULL,          -- E.164, e.g. +84912345678
    code_hash   VARCHAR(100) NOT NULL,          -- bcrypt of the code
    token_hash  VARCHAR(100),                   -- sha-256 of the one-time phone token handed out after the right code
    attempts    INT NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phone_otp_phone ON core_schema.phone_otp_codes (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_otp_created ON core_schema.phone_otp_codes (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_otp_token ON core_schema.phone_otp_codes (token_hash) WHERE token_hash IS NOT NULL;
