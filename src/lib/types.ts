export interface PromptItem {
  id: string;
  text: string;
  response?: string;
  status: "idle" | "loading" | "done" | "error";
  error?: string;
}

export interface PdfInfo {
  text: string;
  pageCount: number;
  filename: string;
}

export interface ModelOption {
  id: string;
  label: string;
}

// ── Database types ──

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: "admin" | "user";
  is_approved: boolean;
  auth_provider: "google" | "credentials";
  created_at: string;
  updated_at: string;
}

export interface InputSource {
  id: string;
  user_id?: string;
  dataset_id: string | null;
  name: string;
  type: "pdf" | "image" | "text" | "excel" | "csv" | "document" | "other";
  original_filename?: string | null;
  storage_path: string | null;
  extracted_text: string | null;
  file_size: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Dataset {
  id: string;
  user_id?: string;
  name: string;
  description: string | null;
  sources_count?: number;
  input_sources?: InputSource[];
  created_at: string;
  updated_at: string;
}

export interface PromptFolder {
  id: string;
  user_id?: string | null;
  name: string;
  is_default: boolean;
  created_at: string;
  prompts?: SavedPrompt[];
}

export interface SavedPrompt {
  id: string;
  user_id?: string | null;
  folder_id: string | null;
  name: string;
  text: string;
  is_default: boolean;
  response_format_id: string | null;
  response_format?: ResponseFormat | null;
  created_at: string;
  updated_at: string;
}

export interface ResponseFormat {
  id: string;
  user_id?: string | null;
  name: string;
  description: string | null;
  template_text: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptChain {
  id: string;
  user_id?: string;
  name: string;
  description: string | null;
  steps?: PromptChainStep[];
  created_at: string;
  updated_at: string;
}

export interface PromptChainStep {
  id: string;
  chain_id?: string;
  prompt_id: string;
  step_order: number;
  response_format_id: string | null;
  prompt?: SavedPrompt;
  response_format?: ResponseFormat | null;
}

export interface Generation {
  id: string;
  user_id?: string;
  title: string | null;
  prompt_text: string;
  response_format_text: string | null;
  model_used: string;
  response_content: string | null;
  status: "pending" | "processing" | "completed" | "error";
  error_message: string | null;
  prompt_chain_id?: string | null;
  sources?: InputSource[];
  created_at: string;
  updated_at?: string;
}

export interface ExportedDocument {
  id: string;
  user_id?: string;
  generation_id: string | null;
  format: "docx" | "pdf" | "txt" | "png";
  storage_path?: string;
  filename: string;
  file_size: number | null;
  created_at: string;
  generation?: Generation;
}

// ── DocForge types ──

export interface DocForgePlaceholder {
  name: string;
  label: string;
  original_text: string;
  default_value: string;
}

export interface DocForgeTemplate {
  id: string;
  user_id?: string;
  name: string;
  description: string | null;
  original_filename: string;
  html_preview: string | null;
  placeholders: DocForgePlaceholder[];
  created_at: string;
  updated_at: string;
}

export interface DocForgeFolder {
  id: string;
  user_id?: string;
  name: string;
  document_count: number;
  created_at: string;
}

export interface DocForgeDocument {
  id: string;
  user_id?: string;
  template_id: string | null;
  folder_id: string | null;
  folder_name: string | null;
  template_name: string | null;
  name: string;
  placeholder_values: Record<string, string>;
  file_size: number | null;
  created_at: string;
}

// ── Wiki types ──

export type WikiPageType =
  | "entity"
  | "concept"
  | "source_summary"
  | "topic_summary"
  | "comparison"
  | "analysis"
  | "index"
  | "overview";

export type WikiTransformationType =
  | "concept_map"
  | "qa_exercises"
  | "story"
  | "podcast_transcript"
  | "video_script"
  | "flashcards"
  | "quiz"
  | "slide_deck"
  | "mind_map"
  | "character_story"
  | "advanced_summary"
  | "comparison_table";

export interface Wiki {
  id: string;
  user_id: string;
  dataset_id: string;
  name: string;
  description: string | null;
  schema_config: Record<string, unknown>;
  stats: {
    page_count?: number;
    source_count?: number;
    link_count?: number;
    last_ingested_at?: string;
    last_linted_at?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface WikiPageLink {
  id: string;
  source_page_id: string;
  target_page_id: string;
  link_text: string;
}

export interface WikiPage {
  id: string;
  wiki_id: string;
  title: string;
  slug: string;
  page_type: WikiPageType;
  content: string;
  frontmatter: {
    tags?: string[];
    source_refs?: string[];
    related_pages?: string[];
    confidence?: number;
    question?: string;
  };
  outbound_links?: WikiPageLink[];
  inbound_links?: WikiPageLink[];
  created_at: string;
  updated_at: string;
}

export interface WikiGraphNode {
  id: string;
  title: string;
  slug: string;
  page_type: WikiPageType;
  link_count: number;
}

export interface WikiGraphEdge {
  source: string;
  target: string;
  link_text: string | null;
}

export interface WikiGraph {
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
}

export interface WikiLog {
  id: string;
  wiki_id: string;
  operation: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface WikiTransformation {
  id: string;
  wiki_id: string;
  title: string;
  transformation_type: WikiTransformationType;
  scope: Record<string, unknown>;
  content: string;
  config: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "error";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WikiLintIssue {
  type: string;
  severity: "info" | "warning" | "error";
  message: string;
  page_id: string | null;
  page_title: string | null;
  suggestion: string | null;
}

export interface WikiLintReport {
  issues: WikiLintIssue[];
  summary: string;
  page_count: number;
  link_count: number;
  orphan_count: number;
}
