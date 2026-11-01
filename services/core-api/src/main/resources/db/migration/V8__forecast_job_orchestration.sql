-- ==============================================================================
-- TerraWatch - PostGIS Migration V8
-- Story 4.1: Persisted Forecast Job Orchestration
-- Adds job lifecycle columns to forecast_runs for recovery polling & idempotency
-- ==============================================================================

-- Add orchestration columns to forecast_runs (using VARCHAR, not custom enum — simpler JPA mapping)
ALTER TABLE core_schema.forecast_runs
    ADD COLUMN IF NOT EXISTS job_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3,
    ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Idempotency unique index (prevents duplicate jobs for same unit+version+time+model)
CREATE UNIQUE INDEX IF NOT EXISTS idx_forecast_runs_idempotency
    ON core_schema.forecast_runs (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Recovery polling index (find stuck/pending jobs)
CREATE INDEX IF NOT EXISTS idx_forecast_runs_job_status
    ON core_schema.forecast_runs (job_status) WHERE job_status IN ('pending', 'running');

-- Backfill existing rows as 'completed' (they have results already)
UPDATE core_schema.forecast_runs
    SET job_status = 'completed', completed_at = created_at
    WHERE job_status = 'pending' AND availability IS NOT NULL AND review_status != 'pending';


-- Implicit casts for Hibernate varchar to custom Postgres types
DO $$ BEGIN
    CREATE CAST (varchar AS jsonb) WITH INOUT AS IMPLICIT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE CAST (varchar AS core_schema.forecast_review_status) WITH INOUT AS IMPLICIT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE CAST (varchar AS core_schema.risk_level) WITH INOUT AS IMPLICIT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
