-- ============================================================
-- REDESIGN: Prompt Folders, Prompt-Format Pairing, Prompt Chains
-- ============================================================

-- ============================================================
-- PROMPT FOLDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prompt_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_folders_user ON public.prompt_folders(user_id);

-- Create the default folder
INSERT INTO public.prompt_folders (user_id, name, is_default)
VALUES (NULL, 'Default', true);

-- ============================================================
-- ADD COLUMNS TO PROMPTS
-- ============================================================
ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.prompt_folders(id) ON DELETE SET NULL;
ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS response_format_id UUID REFERENCES public.response_formats(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prompts_folder ON public.prompts(folder_id);

-- Move existing default prompts into the default folder
UPDATE public.prompts
SET folder_id = (SELECT id FROM public.prompt_folders WHERE is_default = true LIMIT 1)
WHERE is_default = true AND folder_id IS NULL;

-- ============================================================
-- PROMPT CHAINS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prompt_chains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_chains_user ON public.prompt_chains(user_id);

-- ============================================================
-- PROMPT CHAIN STEPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prompt_chain_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_id UUID NOT NULL REFERENCES public.prompt_chains(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  response_format_id UUID REFERENCES public.response_formats(id) ON DELETE SET NULL,
  UNIQUE (chain_id, step_order)
);

CREATE INDEX idx_prompt_chain_steps_chain ON public.prompt_chain_steps(chain_id);

-- ============================================================
-- ADD CHAIN REFERENCE TO GENERATIONS
-- ============================================================
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS prompt_chain_id UUID REFERENCES public.prompt_chains(id) ON DELETE SET NULL;

-- ============================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================
ALTER TABLE public.prompt_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_chain_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage prompt folders" ON public.prompt_folders FOR ALL USING (true);
CREATE POLICY "Users manage prompt chains" ON public.prompt_chains FOR ALL USING (true);
CREATE POLICY "Users manage chain steps" ON public.prompt_chain_steps FOR ALL USING (true);
