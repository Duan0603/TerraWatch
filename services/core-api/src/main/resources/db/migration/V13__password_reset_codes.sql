-- Story 4.21: forgot password by an e-mailed 6-digit code. Only hashes are stored.
CREATE TABLE IF NOT EXISTS core_schema.password_reset_codes (
    reset_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES core_schema.users(user_id) ON DELETE CASCADE,
    code_hash        VARCHAR(100) NOT NULL,          -- bcrypt of the 6-digit code
    reset_token_hash VARCHAR(100),                   -- sha-256 of the token handed out after the code is right
    attempts         INT NOT NULL DEFAULT 0,
    expires_at       TIMESTAMPTZ NOT NULL,
    verified_at      TIMESTAMPTZ,
    used_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON core_schema.password_reset_codes (user_id, created_at DESC);
