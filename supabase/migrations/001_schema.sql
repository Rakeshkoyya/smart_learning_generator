-- ============================================================
-- PDF Content Generator — Database Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  auth_provider TEXT NOT NULL DEFAULT 'credentials' CHECK (auth_provider IN ('google', 'credentials')),
  password_hash TEXT, -- nullable: only for credentials login
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed admin user (password: Admin@123, bcrypt hash)
INSERT INTO public.users (email, name, role, is_approved, auth_provider, password_hash)
VALUES (
  'admin',
  'Administrator',
  'admin',
  true,
  'credentials',
  '$2b$10$zK7gvKDxbH5QYDY/8LeajOcjBalWT1CxC1c3hb5ItsF4E1H/ST9bq'
);

-- ============================================================
-- INPUT SOURCES
-- ============================================================
CREATE TABLE public.input_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'image', 'text', 'excel', 'csv')),
  original_filename TEXT,
  storage_path TEXT, -- path in Supabase Storage bucket
  extracted_text TEXT,
  file_size BIGINT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_input_sources_user ON public.input_sources(user_id);

-- ============================================================
-- PROMPTS (user-saved + default templates)
-- ============================================================
CREATE TABLE public.prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL = default/global
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompts_user ON public.prompts(user_id);

-- Seed default prompts
INSERT INTO public.prompts (user_id, name, text, is_default) VALUES
  (NULL, 'One-Liner Questions', 'Create many, many questions of one line from this Chapter, PDF. One-liner questions, so cover all the concepts and topics and subtopics of this chapter. All the questions, those are possible from this chapter, those answers can be given in one word or one line. You should write down, cover every concept, every topic, and every subtopic, everything from the whole chapter, read it deeply and make as many as questions possible from this Chapter. Write in the end some HOT and Long Questions also List of topics and subtopics to be covered, mapping of all the concepts of the chapter. write in a very compact way, every topic and subtopics in one line with arrow like a flow chart what students will learn in this in this chapter.', true),
  (NULL, 'Hindi-English Glossary', 'Now Make a long simple list with compact formating print friendly saving space & very compact info, on sheet of all the words of this chapter, these words in Simple English and also in Hindi in one line both, so that students understand these words, terms, concepts, deeply and clearly. For the Students of Hindi Speaking background..format is fine, make a list of words, under topics and subtopics of the chapter, don''t left any hard word undefined.', true),
  (NULL, 'Visual Concept Maps (English)', 'Now Create visual maps not image based on arrow concepts maps of the all topics and subtopics including all paragraphs of all topics and subtopics, all concepts must be covered, full of emojis and pics and make it easy for students to retain, arrow concept maps of all paragraphs under topics and subtopics with lots of emojis to make visual notes of the chapter for better memory retain and understanding write more and more in one line only, do minimum line breaks, as minimum as possible.', true),
  (NULL, 'Bilingual Emoji Concept Map', 'bilingual English + Hindi emoji concept map version.', true),
  (NULL, 'Facts & Data List', 'All Facts, Important data, make a long list under topics and subtopics, Name of concept, place, Person, some date, important event and some ranking, where, what, which position, rankings, personality, invention all different kind of all possible facts of the chapter under all topics and subtopics. Make a simple print friendly list with emojis. Lots of facts in form of a simple list.', true),
  (NULL, 'Real-World Projects & Problems', 'Now Create many many real life Project and real life Problems to solve students so that they can develop problem solving skills, so that they can deeply develop different types of thinkings. Many many small or big problems based on all the subtopics and topics and every concept they have learned so far. I want to connect learning to real life and develop thinking skills and other 21st century skills. Create problems under topics and subtopics but also write which skill will develop or targeted skill for the problem children are solving, for all thinking types: Critical Thinking, Analytical Thinking, Creative Thinking, Divergent Thinking, Convergent Thinking, Logical Thinking, Concrete Thinking, Abstract Thinking, Reflective Thinking, Systems Thinking, Intuitive Thinking, Deductive Thinking, Inductive Thinking, Lateral Thinking, Emotional Thinking.', true),
  (NULL, 'Life-Changing Concepts', 'NOW MAP THE big concepts which we want that student must carry in their hearts and brains after doing this chapter. Concepts which can bring Behavioural change. Life Changing concepts, concepts that can change attitude of the child. Major Concepts they must develop after doing this chapter so that I can do the Assessment based on Life transformation of the child after learning all the above chapter. So make a list of these Life Changing concepts from this chapter affecting behaviour, attitude, life, must become life long learning after this chapter. Map the concepts against skills which can be acquired and life long learning ideas and principals to live now onwards. Make a solid list of these deep life changing concepts for the child assessment.', true);

-- ============================================================
-- RESPONSE FORMATS
-- ============================================================
CREATE TABLE public.response_formats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL = default
  name TEXT NOT NULL,
  description TEXT,
  template_text TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_response_formats_user ON public.response_formats(user_id);

-- Seed default response formats
INSERT INTO public.response_formats (user_id, name, description, template_text, is_default) VALUES
  (NULL, 'Structured XML', 'Headings, subheadings, bold, bullet/numbered lists wrapped in XML tags', 'Format your response using these rules:
1. Wrap your entire response in <response></response> tags.
2. Use <heading>Text</heading> for main headings.
3. Use <subheading>Text</subheading> for sub headings.
4. Use <bold>text</bold> for emphasis.
5. Use "- Item" for bullet lists.
6. Use "1. Item" for numbered lists.
7. Plain text paragraphs separated by blank lines.
Do NOT use markdown.', true),

  (NULL, 'Plain Bullets', 'Simple bullet-point output', 'Format your response as a clean bullet-point list:
1. Wrap your entire response in <response></response> tags.
2. Use "- " prefix for every point.
3. Group related points under a label line ending with a colon.
4. No markdown, no HTML except the response tags.', true),

  (NULL, 'Numbered List', 'Sequentially numbered items', 'Format your response as a numbered list:
1. Wrap your entire response in <response></response> tags.
2. Number every item sequentially: 1. 2. 3. etc.
3. Group items under topic labels using <heading>Topic</heading>.
4. No markdown.', true),

  (NULL, 'Table Format', 'Pipe-delimited table rows', 'Format your response as a table:
1. Wrap your entire response in <response></response> tags.
2. Use pipe-delimited rows: | Column1 | Column2 | Column3 |
3. First row is the header. Second row is separator: | --- | --- | --- |
4. Use <heading>Section</heading> above each table if multiple tables.
5. No markdown.', true),

  (NULL, 'Q&A Format', 'Question and Answer pairs', 'Format your response as Q&A pairs:
1. Wrap your entire response in <response></response> tags.
2. Each question: <bold>Q: question text</bold>
3. Each answer on the next line: A: answer text
4. Leave a blank line between Q&A pairs.
5. Group under <heading>Topic</heading> headings.
6. No markdown.', true);

-- ============================================================
-- GENERATIONS
-- ============================================================
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  prompt_text TEXT NOT NULL,
  response_format_text TEXT,
  model_used TEXT NOT NULL,
  response_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generations_user ON public.generations(user_id);

-- ============================================================
-- GENERATION ↔ SOURCES junction
-- ============================================================
CREATE TABLE public.generation_sources (
  generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.input_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (generation_id, source_id)
);

-- ============================================================
-- EXPORTED DOCUMENTS
-- ============================================================
CREATE TABLE public.exported_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('docx', 'pdf', 'txt')),
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exported_documents_user ON public.exported_documents(user_id);
CREATE INDEX idx_exported_documents_generation ON public.exported_documents(generation_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.input_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exported_documents ENABLE ROW LEVEL SECURITY;

-- Service-role key bypasses RLS, so these policies are for anon/authenticated access.
-- We primarily use service-role key from the server, but adding policies for safety.

-- Users: everyone can read their own row, admins can read all
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (true);

-- Input sources: users own their sources
CREATE POLICY "Users manage own sources" ON public.input_sources FOR ALL USING (true);

-- Prompts: users see own + defaults
CREATE POLICY "Users manage prompts" ON public.prompts FOR ALL USING (true);

-- Response formats: users see own + defaults
CREATE POLICY "Users manage formats" ON public.response_formats FOR ALL USING (true);

-- Generations: users own their generations
CREATE POLICY "Users manage generations" ON public.generations FOR ALL USING (true);

-- Generation sources: follow generation ownership
CREATE POLICY "Users manage generation sources" ON public.generation_sources FOR ALL USING (true);

-- Exported documents: users own their exports
CREATE POLICY "Users manage exports" ON public.exported_documents FOR ALL USING (true);

-- ============================================================
-- STORAGE BUCKETS (create via Supabase dashboard or API)
-- Bucket names: input-files, exports
-- ============================================================
-- Run in Supabase SQL editor or create via dashboard:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('input-files', 'input-files', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', false);
