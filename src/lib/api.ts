/**
 * API client for calling the FastAPI backend.
 * Handles authentication and provides typed methods for all endpoints.
 */

// Base URL for the FastAPI backend
export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Get auth headers for API requests.
 * In a real app, this would get the JWT token from NextAuth.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  // Get session token from NextAuth
  const response = await fetch("/api/auth/session");
  const session = await response.json();
  
  if (session?.accessToken) {
    return {
      "Authorization": `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    };
  }
  
  return { "Content-Type": "application/json" };
}

/**
 * Make an authenticated API request.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  // Handle empty responses
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ============= Input Sources =============

export interface InputSource {
  id: string;
  name: string;
  type: "pdf" | "text" | "image" | "excel" | "csv" | "document" | "other";
  storage_path: string | null;
  extracted_text: string | null;
  metadata: Record<string, unknown> | null;
  file_size: number | null;
  dataset_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SourceListResponse {
  sources: InputSource[];
  total: number;
}

export async function getSources(datasetId?: string): Promise<SourceListResponse> {
  const endpoint = datasetId ? `/api/sources?dataset_id=${datasetId}` : "/api/sources";
  return apiRequest<SourceListResponse>(endpoint);
}

export async function uploadSource(file: File, datasetId?: string): Promise<InputSource> {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);
  if (datasetId) formData.append("dataset_id", datasetId);
  
  delete headers["Content-Type"]; // Let browser set Content-Type for FormData
  
  const response = await fetch(`${API_BASE_URL}/api/sources`, {
    method: "POST",
    headers,
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail);
  }
  
  return response.json();
}

export async function deleteSource(id: string): Promise<void> {
  await apiRequest(`/api/sources/${id}`, { method: "DELETE" });
}

// ============= Datasets =============

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  sources_count?: number;
  input_sources?: InputSource[];
  created_at: string;
  updated_at: string;
}

export interface DatasetListResponse {
  datasets: Dataset[];
  total: number;
}

export async function getDatasets(includeSources: boolean = false): Promise<DatasetListResponse> {
  const endpoint = includeSources ? "/api/datasets?include_sources=true" : "/api/datasets";
  return apiRequest<DatasetListResponse>(endpoint);
}

export async function createDataset(name: string, description?: string): Promise<Dataset> {
  return apiRequest("/api/datasets", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function updateDataset(id: string, name: string, description?: string): Promise<Dataset> {
  return apiRequest(`/api/datasets/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteDataset(id: string): Promise<void> {
  await apiRequest(`/api/datasets/${id}`, { method: "DELETE" });
}

export async function uploadSourceWithAuth(
  file: File | null,
  text: string | null,
  name: string,
  datasetId?: string
): Promise<InputSource> {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  
  if (file) {
    formData.append("file", file);
  }
  if (text) {
    formData.append("text", text);
  }
  if (name) {
    formData.append("name", name);
  }
  if (datasetId) {
    formData.append("dataset_id", datasetId);
  }
  
  delete headers["Content-Type"]; // Let browser set Content-Type for FormData
  
  const response = await fetch(`${API_BASE_URL}/api/sources`, {
    method: "POST",
    headers,
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail);
  }
  
  return response.json();
}

// ============= Prompts =============

export interface Prompt {
  id: string;
  name: string;
  text: string;
  description: string | null;
  is_default: boolean;
  is_chain_enabled: boolean;
  folder_id: string | null;
  response_format_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptFolder {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface PromptListResponse {
  prompts: Prompt[];
  folders: PromptFolder[];
}

export async function getPrompts(): Promise<PromptListResponse> {
  return apiRequest<PromptListResponse>("/api/prompts");
}

export async function createPrompt(data: {
  name: string;
  text: string;
  description?: string;
  folder_id?: string;
  is_chain_enabled?: boolean;
  response_format_id?: string;
}): Promise<Prompt> {
  return apiRequest("/api/prompts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePrompt(
  id: string,
  data: Partial<Omit<Prompt, "id" | "created_at" | "updated_at">>
): Promise<Prompt> {
  return apiRequest(`/api/prompts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deletePrompt(id: string): Promise<void> {
  await apiRequest(`/api/prompts/${id}`, { method: "DELETE" });
}

// ============= Prompt Folders =============

export async function getPromptFolders(): Promise<PromptFolder[]> {
  return apiRequest<PromptFolder[]>("/api/prompt-folders");
}

export async function createPromptFolder(name: string): Promise<PromptFolder> {
  return apiRequest("/api/prompt-folders", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deletePromptFolder(id: string): Promise<void> {
  await apiRequest(`/api/prompt-folders/${id}`, { method: "DELETE" });
}

// ============= Response Formats =============

export interface ResponseFormat {
  id: string;
  name: string;
  template_text: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export async function getFormats(): Promise<ResponseFormat[]> {
  return apiRequest<ResponseFormat[]>("/api/formats");
}

export async function createFormat(data: {
  name: string;
  template_text: string;
  description?: string;
}): Promise<ResponseFormat> {
  return apiRequest("/api/formats", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateFormat(
  id: string,
  data: Partial<Omit<ResponseFormat, "id" | "created_at" | "updated_at">>
): Promise<ResponseFormat> {
  return apiRequest(`/api/formats/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteFormat(id: string): Promise<void> {
  await apiRequest(`/api/formats/${id}`, { method: "DELETE" });
}

// ============= Prompt Chains =============

export interface PromptChainStep {
  id: string;
  step_order: number;
  prompt_id: string;
  response_format_id: string | null;
  prompt?: Prompt;
  response_format?: ResponseFormat;
}

export interface PromptChain {
  id: string;
  name: string;
  description: string | null;
  steps: PromptChainStep[];
  created_at: string;
  updated_at: string;
}

export async function getPromptChains(): Promise<PromptChain[]> {
  return apiRequest<PromptChain[]>("/api/prompt-chains");
}

export async function createPromptChain(data: {
  name: string;
  description?: string;
  steps: Array<{
    step_order: number;
    prompt_id: string;
    response_format_id?: string;
  }>;
}): Promise<PromptChain> {
  return apiRequest("/api/prompt-chains", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deletePromptChain(id: string): Promise<void> {
  await apiRequest(`/api/prompt-chains/${id}`, { method: "DELETE" });
}

// ============= Generation =============

export interface GenerateRequest {
  source_ids: string[];
  prompt_text: string;
  format_text?: string;
  model?: string;
  title?: string;
  chain_id?: string;
}

export interface GenerateResponse {
  content: string;
  generation_id: string;
}

export async function generate(data: GenerateRequest): Promise<GenerateResponse> {
  return apiRequest("/api/generate", {
    method: "POST",
    body: JSON.stringify({
      source_ids: data.source_ids,
      prompt_text: data.prompt_text,
      format_text: data.format_text,
      model: data.model || "anthropic/claude-3.5-sonnet",
      title: data.title,
      chain_id: data.chain_id,
    }),
  });
}

// ============= Generations (History) =============

export interface Generation {
  id: string;
  title: string | null;
  prompt_text: string;
  response_format_text: string | null;
  response_content: string | null;
  model_used: string;
  status: "pending" | "processing" | "completed" | "error";
  error_message: string | null;
  sources: InputSource[];
  created_at: string;
  updated_at: string;
}

export async function getGenerations(limit = 20, offset = 0): Promise<{
  generations: Generation[];
  total: number;
}> {
  return apiRequest(`/api/generations?limit=${limit}&offset=${offset}`);
}

export async function getGeneration(id: string): Promise<Generation> {
  return apiRequest(`/api/generations/${id}`);
}

export async function deleteGeneration(id: string): Promise<void> {
  await apiRequest(`/api/generations/${id}`, { method: "DELETE" });
}

// ============= Exports =============

export interface ExportedDocument {
  id: string;
  format: "docx" | "txt" | "pdf" | "png";
  filename: string;
  file_size: number | null;
  generation_id: string | null;
  dataset_id: string | null;
  dataset_name: string | null;
  created_at: string;
}

export async function getExports(limit = 20, offset = 0): Promise<{
  exports: ExportedDocument[];
  total: number;
}> {
  return apiRequest(`/api/exports?limit=${limit}&offset=${offset}`);
}

export async function exportDocx(data: {
  title: string;
  results: Array<{
    prompt_name: string;
    content: string;
  }>;
  generation_id?: string;
  dataset_id?: string;
}): Promise<Blob> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE_URL}/api/exports/docx`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Export failed" }));
    throw new Error(error.detail);
  }
  
  return response.blob();
}

export async function exportTxt(data: {
  title: string;
  content: string;
  generation_id?: string;
  dataset_id?: string;
}): Promise<Blob> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE_URL}/api/exports/txt`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Export failed" }));
    throw new Error(error.detail);
  }
  
  return response.blob();
}

export async function downloadExport(id: string): Promise<Blob> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE_URL}/api/exports/${id}/download`, {
    headers,
  });
  
  if (!response.ok) {
    throw new Error("Download failed");
  }
  
  return response.blob();
}

export async function deleteExport(id: string): Promise<void> {
  await apiRequest(`/api/exports/${id}`, { method: "DELETE" });
}

// ============= Users (Admin) =============

export interface User {
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

export async function getCurrentUser(): Promise<User> {
  return apiRequest("/api/users/me");
}

export async function getUsers(): Promise<User[]> {
  const response = await apiRequest<{ users: User[]; total: number }>("/api/admin/users");
  return response.users;
}

export async function updateUserApproval(id: string, is_approved: boolean): Promise<User> {
  return apiRequest(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_approved }),
  });
}

export async function updateUserRole(id: string, role: User["role"]): Promise<User> {
  return apiRequest(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

// ============= Infographics (SSE) =============

export interface InfographicsRequest {
  source_ids: string[];
  model?: string;
  dimension_id?: string;
  style?: string;
  detail_level?: string;
  filename?: string;
}

export function generateInfographic(
  data: InfographicsRequest,
  onProgress: (step: number, message: string, complete?: boolean) => void,
  onComplete: (exportId: string, filename: string) => void,
  onError: (error: string) => void
): () => void {
  // Use EventSource for SSE
  const url = new URL(`${API_BASE_URL}/api/genie/infographics`);
  
  // For SSE with POST, we need to use fetch
  const controller = new AbortController();
  
  (async () => {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/api/genie/infographics`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Failed" }));
        onError(error.detail);
        return;
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }
      
      const decoder = new TextDecoder();
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                onError(data.error);
                return;
              }
              
              if (data.step !== undefined) {
                onProgress(data.step, data.message, data.complete);
              }
              
              if (data.complete && data.export_id && data.filename) {
                onComplete(data.export_id, data.filename);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        onError(err.message);
      }
    }
  })();
  
  // Return abort function
  return () => controller.abort();
}

// ============= Workflows =============

export interface WorkflowRun {
  id: string;
  user_id: string;
  dataset_id: string;
  chain_id: string;
  output_format: string;
  filename_prefix: string;
  model: string;
  status: "pending" | "running" | "completed" | "error" | "cancelled";
  source_ids: string[];
  total_files: number;
  completed_files: number;
  current_file_index: number;
  current_step_index: number;
  total_steps: number;
  current_file_name: string | null;
  error_message: string | null;
  results: Array<{
    source_id: string;
    source_name?: string;
    filename?: string;
    export_id?: string;
    status: string;
    error?: string;
  }> | null;
  created_at: string;
  updated_at: string;
}

export async function startWorkflow(data: {
  dataset_id: string;
  source_ids: string[];
  chain_id: string;
  output_format: string;
  filename_prefix: string;
  model?: string;
}): Promise<WorkflowRun> {
  return apiRequest("/api/workflows", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getWorkflows(limit = 20, offset = 0): Promise<{
  workflows: WorkflowRun[];
  total: number;
}> {
  return apiRequest(`/api/workflows?limit=${limit}&offset=${offset}`);
}

export async function getWorkflow(id: string): Promise<WorkflowRun> {
  return apiRequest(`/api/workflows/${id}`);
}

export async function cancelWorkflow(id: string): Promise<void> {
  await apiRequest(`/api/workflows/${id}/cancel`, { method: "POST" });
}
