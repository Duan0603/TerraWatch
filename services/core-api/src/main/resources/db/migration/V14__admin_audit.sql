-- Story 4.27: who did what in the admin console (lock/unlock, role change, officer approval, alert broadcast/revoke).
-- No foreign key on purpose: the log must survive the deletion of the account it talks about.
CREATE TABLE IF NOT EXISTS core_schema.admin_audit (
    audit_id     BIGSERIAL PRIMARY KEY,
    actor_id     UUID,
    actor_email  VARCHAR(255),
    action       VARCHAR(40) NOT NULL,
    target_type  VARCHAR(30),
    target_id    VARCHAR(64),
    target_label VARCHAR(255),
    detail       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON core_schema.admin_audit (created_at DESC);
