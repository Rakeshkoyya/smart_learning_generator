-- Workflow runs table for batch processing
CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    chain_id UUID NOT NULL REFERENCES prompt_chains(id) ON DELETE CASCADE,
    output_format VARCHAR(10) NOT NULL,
    filename_prefix VARCHAR(200) NOT NULL,
    model VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    source_ids JSONB NOT NULL,
    total_files INTEGER NOT NULL DEFAULT 0,
    completed_files INTEGER NOT NULL DEFAULT 0,
    current_file_index INTEGER NOT NULL DEFAULT 0,
    current_step_index INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 0,
    current_file_name VARCHAR(500),
    error_message TEXT,
    results JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id ON workflow_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);

-- RLS policies
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_runs_user_select ON workflow_runs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY workflow_runs_user_insert ON workflow_runs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY workflow_runs_user_update ON workflow_runs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY workflow_runs_service_all ON workflow_runs
    FOR ALL USING (auth.role() = 'service_role');
