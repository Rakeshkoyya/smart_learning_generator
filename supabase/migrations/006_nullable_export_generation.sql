-- Allow exported_documents without a generation (e.g. infographics)
ALTER TABLE public.exported_documents
  ALTER COLUMN generation_id DROP NOT NULL;
