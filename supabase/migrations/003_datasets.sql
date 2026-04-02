-- Create datasets table
CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);

-- Add dataset_id to input_sources
ALTER TABLE input_sources ADD COLUMN IF NOT EXISTS dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_input_sources_dataset_id ON input_sources(dataset_id);

-- Enable RLS
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own datasets"
  ON datasets FOR ALL
  USING (user_id = auth.uid());
