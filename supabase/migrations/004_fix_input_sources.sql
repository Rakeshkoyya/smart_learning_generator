-- ============================================================
-- FIX: Add missing columns and enum type for input_sources
-- ============================================================

-- Create source_type enum
DO $$ BEGIN
  CREATE TYPE source_type AS ENUM ('pdf', 'image', 'text', 'excel', 'csv', 'document', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add updated_at column to input_sources if it doesn't exist
ALTER TABLE input_sources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Update existing rows to have updated_at same as created_at
UPDATE input_sources SET updated_at = created_at WHERE updated_at IS NULL;

-- Drop the old check constraint (if exists) and convert type column from TEXT to enum
-- First, we need to handle the existing constraint on the type column
DO $$
BEGIN
  -- Drop existing check constraint if it exists
  ALTER TABLE input_sources DROP CONSTRAINT IF EXISTS input_sources_type_check;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Alter the type column to use the enum (this handles conversion from TEXT)
ALTER TABLE input_sources 
  ALTER COLUMN type TYPE source_type USING type::source_type;
