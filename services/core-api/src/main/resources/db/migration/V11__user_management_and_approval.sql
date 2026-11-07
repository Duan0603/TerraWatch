-- Story: Admin User Management & Officer Approval
ALTER TABLE core_schema.users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved';

CREATE INDEX IF NOT EXISTS idx_users_active_status ON core_schema.users (is_active, approval_status);
