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
