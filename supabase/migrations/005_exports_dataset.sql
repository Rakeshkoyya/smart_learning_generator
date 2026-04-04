-- ============================================================
-- Add dataset_id to exported_documents table
-- ============================================================

-- Add dataset_id column to exported_documents
ALTER TABLE exported_documents 
ADD COLUMN IF NOT EXISTS dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL;

-- Create index for dataset_id
CREATE INDEX IF NOT EXISTS idx_exported_documents_dataset_id ON exported_documents(dataset_id);
