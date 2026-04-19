"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  Trash2,
  ChevronDown,
  Cpu,
  Brain,
  LayoutTemplate,
  Sparkles,
  FileOutput,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  docagentGenerate,
  docagentListJobs,
  docagentDownload,
  docagentDeleteJob,
  type DocAgentJob,
} from "@/lib/api";

const AVAILABLE_MODELS = [
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "google/gemini-2.5-pro-preview-03-25", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1-mini" },
  { id: "openai/gpt-5", label: "GPT-5" },
  { id: "openai/gpt-5.1", label: "GPT-5.1" },
    { id: "openai/gpt-5.2", label: "GPT-5.2" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4-mini" },
  { id: "openai/gpt-5.4", label: "GPT-5.4 (costly)" },
];

const PROMPT_PRESETS = [
  {
    id: "dense_notes",
    label: "Dense Notes",
    description: "Ultra-dense, exam-ready chapter notes",
    prompt: `You are an expert academic note-maker. I will upload a PDF of one chapter from a textbook. Your task is to:
Generate ultra-dense, exam-ready notes following these strict rules:
━━━ STRUCTURE ━━━
Preserve every topic & sub-topic heading from the chapter (H1 → H2 → H3 hierarchy)
Under each heading: compress all content into minimum possible words
Nothing is skipped — every fact, date, name, definition, formula, cause, effect, example, exception, and hard vocabulary word must appear
━━━ FORMAT & LANGUAGE ━━━
NO full sentences. Use keyword → keyword chains
Link ideas with symbols: → (leads to), ∵ (because), ∴ (therefore), ↑↓ (increases/decreases), ≈ (approximately), = (equals/defined as), ⚡ (important/critical), ★ (key point), ✗ (not/incorrect), ~ (related to)
Use slash / to separate alternatives; use + to combine ideas
Abbreviate wherever obvious: govt, eco, chem, pop, temp, org, nat, intl, etc.
Numbers stay as numbers: never write "three" — write "3"
Make it visually rich, very beautiful in formatting
━━━ DENSITY RULES ━━━
Max 2–4 A4 pages total for the entire chapter
Use 2-column layout mentally — pack parallel info side by side
Group similar facts in compact tables where comparisons exist
Use indented bullet trees for hierarchies
Bold only the single most important word per line
━━━ MUST INCLUDE (miss none) ━━━
✔ All definitions (word = meaning)
✔ All hard/technical vocabulary with 2–3 word meanings
✔ All dates, years, events
✔ All causes & effects
✔ All formulas & equations
✔ All named laws, theories, acts, policies
✔ All examples & case studies (ultra-compressed: name + key fact only)
✔ All diagrams/processes → convert to linear arrow chains
✔ All exceptions & special cases
━━━ END WITH ━━━
A RAPID RECALL box: single-line ultra-key facts covering EVERY topic of the whole chapter (30-60 points, one line each, miss nothing)`,
  },
  {
    id: "custom",
    label: "Custom Prompt",
    description: "Write your own instructions",
    prompt: "",
  },
];

const COLOR_PALETTES = [
  {
    id: "ocean",
    label: "Ocean Blue",
    primary: "#1A5276",
    secondary: "#2E86C1",
    accent: "#1B4F72",
    text: "#1C1C1C",
  },
  {
    id: "forest",
    label: "Forest Green",
    primary: "#1E6F50",
    secondary: "#28A745",
    accent: "#145A38",
    text: "#1C1C1C",
  },
  {
    id: "royal",
    label: "Royal Purple",
    primary: "#5B2C8B",
    secondary: "#7D3AC1",
    accent: "#4A1D78",
    text: "#1C1C1C",
  },
  {
    id: "ember",
    label: "Warm Ember",
    primary: "#C0392B",
    secondary: "#E67E22",
    accent: "#A93226",
    text: "#1C1C1C",
  },
  {
    id: "slate",
    label: "Slate Grey",
    primary: "#2C3E50",
    secondary: "#5D6D7E",
    accent: "#1C2833",
    text: "#1C1C1C",
  },
  {
    id: "teal",
    label: "Teal & Coral",
    primary: "#008080",
    secondary: "#E07A5F",
    accent: "#006666",
    text: "#1C1C1C",
  },
];

type AgentStep = "idle" | "analyzing" | "planning" | "generating" | "formatting" | "done" | "error";

const STEP_ORDER: AgentStep[] = ["analyzing", "planning", "generating", "formatting", "done"];

interface StepInfo {
  label: string;
  icon: React.ElementType;
  description: string;
}

const STEP_META: Record<string, StepInfo> = {
  analyzing: { label: "Analyze", icon: Brain, description: "Understanding your document..." },
  planning: { label: "Plan", icon: LayoutTemplate, description: "Designing document layout..." },
  generating: { label: "Generate", icon: Sparkles, description: "Creating content..." },
  formatting: { label: "Format", icon: FileOutput, description: "Building Word document..." },
  done: { label: "Done", icon: CheckCircle2, description: "Document ready!" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocAgentView() {
  // ── State ──
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [selectedPreset, setSelectedPreset] = useState(PROMPT_PRESETS[0].id);
  const [customPrompt, setCustomPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [chapterNumber, setChapterNumber] = useState("");
  const [selectedPalette, setSelectedPalette] = useState(COLOR_PALETTES[0].id);
  const [currentStep, setCurrentStep] = useState<AgentStep>("idle");
  const [stepMessage, setStepMessage] = useState("");
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [planResult, setPlanResult] = useState<Record<string, unknown> | null>(null);
  const [completedJobId, setCompletedJobId] = useState<string | null>(null);
  const [completedFilename, setCompletedFilename] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DocAgentJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // ── Load history ──
  const loadJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const res = await docagentListJobs();
      setJobs(res.jobs);
    } catch {
      // silent
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  // Load jobs on first render
  const [jobsLoaded, setJobsLoaded] = useState(false);
  if (!jobsLoaded) {
    setJobsLoaded(true);
    loadJobs();
  }

  // ── Handlers ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  const reset = () => {
    setCurrentStep("idle");
    setStepMessage("");
    setAnalysisResult(null);
    setPlanResult(null);
    setCompletedJobId(null);
    setCompletedFilename(null);
    setErrorMessage(null);
  };

  const handleGenerate = async () => {
    const activePrompt = selectedPreset === "custom"
      ? customPrompt.trim()
      : PROMPT_PRESETS.find((p) => p.id === selectedPreset)?.prompt || "";
    if (!file || !activePrompt) return;
    reset();
    setCurrentStep("analyzing");

    const abort = docagentGenerate(
      {
        file,
        userPrompt: activePrompt,
        model: selectedModel,
        title: title || undefined,
        subject: subject || undefined,
        classLevel: classLevel || undefined,
        chapterNumber: chapterNumber ? parseInt(chapterNumber, 10) : undefined,
        colorPalette: selectedPalette,
      },
      // onStatus
      (step, message) => {
        setCurrentStep(step as AgentStep);
        setStepMessage(message);
      },
      // onAnalysis
      (analysis) => setAnalysisResult(analysis),
      // onPlan
      (plan) => setPlanResult(plan),
      // onDone
      (jobId, filename) => {
        setCurrentStep("done");
        setCompletedJobId(jobId);
        setCompletedFilename(filename);
        loadJobs();
      },
      // onError
      (err) => {
        setCurrentStep("error");
        setErrorMessage(err);
      }
    );
    abortRef.current = abort;
  };

  const handleDownload = async (jobId: string, filename?: string) => {
    setIsDownloading(jobId);
    try {
      const blob = await docagentDownload(jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "document.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setIsDownloading(null);
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await docagentDeleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch {
      // silent
    }
  };

  const isRunning = !["idle", "done", "error"].includes(currentStep);
  const stepIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="h-full flex overflow-hidden">
      {/* ════════════ LEFT: Config + Upload ════════════ */}
      <div className="w-75 shrink-0 border-r bg-card flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            DocAgent
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-powered document generation
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Model selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              LLM Model
            </label>
            <div className="relative">
              <Cpu className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <select
                className="w-full h-8 pl-7 pr-8 rounded-md border text-xs appearance-none cursor-pointer bg-background"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isRunning}
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Source Document
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                file
                  ? "border-primary/50 bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
                onChange={handleFileSelect}
                disabled={isRunning}
              />
              {file ? (
                <div className="flex items-center gap-2 justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium truncate max-w-45">
                    {file.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {formatFileSize(file.size)}
                  </Badge>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">
                    Drop file or click to upload
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    PDF, DOCX, TXT, CSV, Excel
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Subject, Class, Chapter Number row */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Science"
                className="h-8 text-xs"
                disabled={isRunning}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Class
              </label>
              <div className="relative">
                <select
                  className="w-full h-8 px-2 rounded-md border text-xs appearance-none cursor-pointer bg-background"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  disabled={isRunning}
                >
                  <option value="">--</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      Class {n}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Chapter #
              </label>
              <Input
                type="number"
                min={1}
                value={chapterNumber}
                onChange={(e) => setChapterNumber(e.target.value)}
                placeholder="e.g. 3"
                className="h-8 text-xs"
                disabled={isRunning}
              />
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Color Palette
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {COLOR_PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setSelectedPalette(p.id)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[10px] font-medium transition-colors cursor-pointer ${
                    selectedPalette === p.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted hover:border-muted-foreground/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex gap-0.5 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.primary }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.secondary }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.accent }} />
                  </div>
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title (optional override) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Title Override (optional)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                classLevel && subject && chapterNumber
                  ? `Auto: G${classLevel}-${subject.toUpperCase()}-CH${chapterNumber}`
                  : "e.g. Sales Report Q4"
              }
              className="h-8 text-xs"
              disabled={isRunning}
            />
          </div>

          {/* Prompt Preset */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Prompt Template
            </label>
            <div className="space-y-1.5">
              {PROMPT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setSelectedPreset(p.id)}
                  className={`w-full flex items-start gap-2 px-3 py-2 rounded-md border text-left transition-colors cursor-pointer ${
                    selectedPreset === p.id
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-muted-foreground/40"
                  }`}
                >
                  <div className={`mt-0.5 w-3 h-3 rounded-full border-2 shrink-0 ${
                    selectedPreset === p.id
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  }`} />
                  <div>
                    <div className="text-xs font-medium">{p.label}</div>
                    <div className="text-[10px] text-muted-foreground">{p.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt textarea — only shown when Custom is selected */}
          {selectedPreset === "custom" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Custom Instructions
              </label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe the document you want to generate from the uploaded source..."
                className="min-h-30 text-xs resize-none"
                disabled={isRunning}
              />
            </div>
          )}

          {/* Generate button */}
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={!file || (selectedPreset === "custom" && !customPrompt.trim()) || isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Document
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ════════════ CENTER: Progress + Results ════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3 border-b bg-card">
          <h3 className="text-sm font-semibold">Agent Pipeline</h3>
          <p className="text-xs text-muted-foreground">
            4-step agentic flow: Analyze → Plan → Generate → Format
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === "idle" && !completedJobId && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Ready to generate</p>
                <p className="text-xs mt-1">Upload a document and describe what you need</p>
              </div>
            </div>
          )}

          {/* Step progress */}
          {currentStep !== "idle" && (
            <div className="space-y-6">
              {/* Progress steps */}
              <div className="flex items-center gap-2 justify-center">
                {STEP_ORDER.slice(0, 4).map((step, idx) => {
                  const meta = STEP_META[step];
                  const Icon = meta.icon;
                  const isActive = step === currentStep;
                  const isCompleted = stepIndex > idx || currentStep === "done";
                  const isPending = stepIndex < idx && currentStep !== "done" && currentStep !== "error";

                  return (
                    <div key={step} className="flex items-center">
                      <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : isCompleted
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isActive && !isCompleted ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Icon className="h-3 w-3" />
                        )}
                        {meta.label}
                      </div>
                      {idx < 3 && (
                        <div
                          className={`w-8 h-0.5 mx-1 ${
                            isCompleted ? "bg-green-400" : "bg-muted"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Current step message */}
              {isRunning && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{stepMessage}</p>
                </div>
              )}

              {/* Error state */}
              {currentStep === "error" && (
                <div className="mx-auto max-w-md rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Generation failed</p>
                      <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
                    Try Again
                  </Button>
                </div>
              )}

              {/* Done state */}
              {currentStep === "done" && completedJobId && (
                <div className="mx-auto max-w-md rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    Document Generated!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{completedFilename}</p>
                  <Button
                    className="mt-3"
                    onClick={() => handleDownload(completedJobId, completedFilename || undefined)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download .docx
                  </Button>
                </div>
              )}

              {/* Analysis result panel */}
              {analysisResult && (
                <div className="rounded-lg border p-4">
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-primary" />
                    Analysis
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      <span className="font-medium">{String(analysisResult.document_type || "—")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Density:</span>{" "}
                      <span className="font-medium">{String(analysisResult.content_density || "—")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Length:</span>{" "}
                      <span className="font-medium">{String(analysisResult.total_length_estimate || "—")}</span>
                    </div>
                  </div>
                  {Array.isArray(analysisResult.key_topics) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(analysisResult.key_topics as string[]).map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Plan result panel */}
              {planResult && (
                <div className="rounded-lg border p-4">
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <LayoutTemplate className="h-3.5 w-3.5 text-primary" />
                    Document Plan
                  </h4>
                  <p className="text-sm font-medium">{String(planResult.document_title || "")}</p>
                  {planResult.document_subtitle && (
                    <p className="text-xs text-muted-foreground">{String(planResult.document_subtitle)}</p>
                  )}
                  {planResult.color_scheme && (
                    <div className="flex gap-1.5 mt-2">
                      {Object.entries(planResult.color_scheme as Record<string, string>).map(
                        ([name, color]) => (
                          <div key={name} className="flex items-center gap-1">
                            <div
                              className="w-3 h-3 rounded-full border"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-[10px] text-muted-foreground">{name}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {Array.isArray(planResult.sections) && (
                    <div className="mt-3 space-y-1.5">
                      {(planResult.sections as Array<{ heading: string; content_type: string }>).map(
                        (s, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-4 text-right">{i + 1}.</span>
                            <span className="font-medium">{s.heading}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto">
                              {s.content_type}
                            </Badge>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════ RIGHT: History ════════════ */}
      <div className="w-70 shrink-0 border-l bg-card flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            History
          </h3>
          <Button variant="ghost" size="icon-xs" onClick={loadJobs} disabled={isLoadingJobs}>
            {isLoadingJobs ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="text-xs">↻</span>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {jobs.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No jobs yet
            </div>
          ) : (
            <div className="divide-y">
              {jobs.map((job) => (
                <div key={job.id} className="px-3 py-2.5 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{job.title || "Untitled"}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {job.source_filename || "—"}
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(job.created_at)}
                    </span>
                    <div className="flex items-center gap-1">
                      {job.status === "completed" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDownload(job.id, job.output_filename || undefined)}
                          disabled={isDownloading === job.id}
                        >
                          {isDownloading === job.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDelete(job.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
    analyzing: { label: "Analyzing", className: "bg-blue-100 text-blue-700" },
    planning: { label: "Planning", className: "bg-purple-100 text-purple-700" },
    generating: { label: "Generating", className: "bg-indigo-100 text-indigo-700" },
    formatting: { label: "Formatting", className: "bg-cyan-100 text-cyan-700" },
    completed: { label: "Done", className: "bg-green-100 text-green-700" },
    error: { label: "Error", className: "bg-red-100 text-red-700" },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.className}`}>
      {c.label}
    </span>
  );
}
