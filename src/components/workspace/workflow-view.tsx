"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Check,
  FileText,
  Image,
  Table,
  FileSpreadsheet,
  Type,
  File,
  Clock,
  Ban,
  Download,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import { useWorkspace } from "@/lib/workspace-context";
import type { ModelOption } from "@/lib/types";

const AVAILABLE_MODELS: ModelOption[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "google/gemini-2.5-pro-preview-03-25", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1-mini" },
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  image: Image,
  excel: FileSpreadsheet,
  csv: Table,
  text: Type,
  document: FileText,
  other: File,
};

// ─── Dropdown hook using refs for reliable outside-click detection ───
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return { open, setOpen, ref };
}

type ViewMode = "setup" | "running" | "history";

export function WorkflowView() {
  const { datasets, chains, isLoadingDatasets, isLoadingChains, fetchDatasets, fetchChains } =
    useWorkspace();

  // ─── Ensure data is loaded when this view mounts ───
  useEffect(() => {
    fetchDatasets();
    fetchChains();
  }, [fetchDatasets, fetchChains]);

  // Setup form
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [selectedChainId, setSelectedChainId] = useState("");
  const [outputFormat, setOutputFormat] = useState<"docx" | "txt">("docx");
  const [filenamePrefix, setFilenamePrefix] = useState("");
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);

  // Active workflow tracking
  const [activeWorkflow, setActiveWorkflow] = useState<api.WorkflowRun | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("setup");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // History
  const [workflowHistory, setWorkflowHistory] = useState<api.WorkflowRun[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
  const selectedChain = chains.find((c) => c.id === selectedChainId);

  // Fetch history on mount and check for active workflow
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await api.getWorkflows(50);
      setWorkflowHistory(data.workflows);
      // Resume polling if there's an active run
      const active = data.workflows.find(
        (w) => w.status === "running" || w.status === "pending"
      );
      if (active) {
        setActiveWorkflow(active);
        setViewMode("running");
        startPolling(active.id);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Polling
  const startPolling = useCallback((workflowId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const wf = await api.getWorkflow(workflowId);
        setActiveWorkflow(wf);
        if (wf.status === "completed" || wf.status === "error" || wf.status === "cancelled") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          // Refresh history
          const data = await api.getWorkflows(50);
          setWorkflowHistory(data.workflows);
        }
      } catch {
        // On error, keep polling
      }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleDatasetChange = (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    const ds = datasets.find((d) => d.id === datasetId);
    if (ds && ds.input_sources) {
      setSelectedSourceIds(ds.input_sources.map((s) => s.id));
    } else {
      setSelectedSourceIds([]);
    }
  };

  const toggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!selectedDataset?.input_sources) return;
    const allIds = selectedDataset.input_sources.map((s) => s.id);
    setSelectedSourceIds(
      selectedSourceIds.length === allIds.length ? [] : allIds
    );
  };

  const canStart =
    selectedSourceIds.length > 0 &&
    selectedChainId &&
    filenamePrefix.trim() &&
    !activeWorkflow;

  const handleStart = async () => {
    if (!canStart) return;
    try {
      const wf = await api.startWorkflow({
        dataset_id: selectedDatasetId,
        source_ids: selectedSourceIds,
        chain_id: selectedChainId,
        output_format: outputFormat,
        filename_prefix: filenamePrefix.trim(),
        model: selectedModel,
      });
      setActiveWorkflow(wf);
      setViewMode("running");
      startPolling(wf.id);
      toast.success("Workflow started!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start workflow");
    }
  };

  const handleCancel = async () => {
    if (!activeWorkflow) return;
    try {
      await api.cancelWorkflow(activeWorkflow.id);
      toast.info("Workflow cancellation requested");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const handleBackToSetup = () => {
    setActiveWorkflow(null);
    setViewMode("setup");
  };

  const handleViewRun = (wf: api.WorkflowRun) => {
    setActiveWorkflow(wf);
    setViewMode("running");
    if (wf.status === "running" || wf.status === "pending") {
      startPolling(wf.id);
    }
  };

  const isLoadingData = isLoadingDatasets || isLoadingChains;

  // ─── Render ───
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {viewMode !== "setup" && (
            <Button variant="ghost" size="sm" onClick={handleBackToSetup}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <h1 className="text-lg font-semibold">Workflows</h1>
          {viewMode === "setup" && workflowHistory.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {workflowHistory.length} runs
            </Badge>
          )}
        </div>
        {viewMode === "setup" && (
          <Button variant="outline" size="sm" onClick={loadHistory}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === "setup" && (
          <SetupView
            datasets={datasets}
            chains={chains}
            selectedDatasetId={selectedDatasetId}
            selectedDataset={selectedDataset || null}
            selectedSourceIds={selectedSourceIds}
            selectedChainId={selectedChainId}
            selectedChain={selectedChain || null}
            outputFormat={outputFormat}
            filenamePrefix={filenamePrefix}
            selectedModel={selectedModel}
            isLoadingData={isLoadingData}
            canStart={!!canStart}
            workflowHistory={workflowHistory}
            onDatasetChange={handleDatasetChange}
            onToggleSource={toggleSource}
            onToggleSelectAll={toggleSelectAll}
            onChainChange={setSelectedChainId}
            onFormatChange={setOutputFormat}
            onPrefixChange={setFilenamePrefix}
            onModelChange={setSelectedModel}
            onStart={handleStart}
            onViewRun={handleViewRun}
          />
        )}
        {viewMode === "running" && activeWorkflow && (
          <RunningView workflow={activeWorkflow} onCancel={handleCancel} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Setup View
// ═══════════════════════════════════════════════════════════════

interface SetupViewProps {
  datasets: ReturnType<typeof useWorkspace>["datasets"];
  chains: ReturnType<typeof useWorkspace>["chains"];
  selectedDatasetId: string;
  selectedDataset: ReturnType<typeof useWorkspace>["datasets"][number] | null;
  selectedSourceIds: string[];
  selectedChainId: string;
  selectedChain: ReturnType<typeof useWorkspace>["chains"][number] | null;
  outputFormat: "docx" | "txt";
  filenamePrefix: string;
  selectedModel: string;
  isLoadingData: boolean;
  canStart: boolean;
  workflowHistory: api.WorkflowRun[];
  onDatasetChange: (id: string) => void;
  onToggleSource: (id: string) => void;
  onToggleSelectAll: () => void;
  onChainChange: (id: string) => void;
  onFormatChange: (f: "docx" | "txt") => void;
  onPrefixChange: (p: string) => void;
  onModelChange: (m: string) => void;
  onStart: () => void;
  onViewRun: (wf: api.WorkflowRun) => void;
}

function SetupView(props: SetupViewProps) {
  const {
    datasets, chains,
    selectedDatasetId, selectedDataset, selectedSourceIds,
    selectedChainId, selectedChain,
    outputFormat, filenamePrefix, selectedModel,
    isLoadingData, canStart, workflowHistory,
    onDatasetChange, onToggleSource, onToggleSelectAll,
    onChainChange, onFormatChange, onPrefixChange, onModelChange,
    onStart, onViewRun,
  } = props;

  // Each dropdown manages its own open/close with a ref-based outside-click
  const datasetDd = useDropdown();
  const chainDd = useDropdown();
  const modelDd = useDropdown();

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 space-y-8">
      {/* Step 1: Dataset & Files */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</div>
          <h2 className="font-semibold">Select Dataset & Files</h2>
        </div>

        <div className="relative" ref={datasetDd.ref}>
          <button
            onClick={() => datasetDd.setOpen(!datasetDd.open)}
            className="w-full flex items-center justify-between px-3 py-2.5 border rounded-lg text-sm bg-background hover:bg-muted transition-colors"
          >
            <span className={selectedDataset ? "text-foreground" : "text-muted-foreground"}>
              {selectedDataset?.name || "Choose a dataset..."}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {datasetDd.open && (
            <div className="absolute z-20 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {datasets.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => { onDatasetChange(ds.id); datasetDd.setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${
                    ds.id === selectedDatasetId ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  {ds.id === selectedDatasetId && <Check className="h-3 w-3" />}
                  <span>{ds.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {ds.input_sources?.length || 0} files
                  </span>
                </button>
              ))}
              {datasets.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No datasets found
                </div>
              )}
            </div>
          )}
        </div>

        {/* File selection */}
        {selectedDataset && selectedDataset.input_sources && selectedDataset.input_sources.length > 0 && (
          <div className="border rounded-lg">
            <div className="px-3 py-2 border-b flex items-center justify-between bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">
                {selectedSourceIds.length} of {selectedDataset.input_sources.length} files selected
              </span>
              <button
                onClick={onToggleSelectAll}
                className="text-xs text-primary hover:underline"
              >
                {selectedSourceIds.length === selectedDataset.input_sources.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y">
              {selectedDataset.input_sources.map((source) => {
                const Icon = TYPE_ICONS[source.type] || File;
                const isSelected = selectedSourceIds.includes(source.id);
                return (
                  <button
                    key={source.id}
                    onClick={() => onToggleSource(source.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate text-left">{source.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Step 2: Prompt Chain */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</div>
          <h2 className="font-semibold">Select Prompt Chain</h2>
        </div>

        <div className="relative" ref={chainDd.ref}>
          <button
            onClick={() => chainDd.setOpen(!chainDd.open)}
            className="w-full flex items-center justify-between px-3 py-2.5 border rounded-lg text-sm bg-background hover:bg-muted transition-colors"
          >
            <span className={selectedChain ? "text-foreground" : "text-muted-foreground"}>
              {selectedChain?.name || "Choose a prompt chain..."}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {chainDd.open && (
            <div className="absolute z-20 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {chains.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => { onChainChange(ch.id); chainDd.setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${
                    ch.id === selectedChainId ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  {ch.id === selectedChainId && <Check className="h-3 w-3" />}
                  <span>{ch.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {ch.steps?.length || 0} steps
                  </span>
                </button>
              ))}
              {chains.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No prompt chains found. Create one in the Prompts tab.
                </div>
              )}
            </div>
          )}
        </div>

        {selectedChain && selectedChain.steps && (
          <div className="text-xs text-muted-foreground px-1 space-y-0.5">
            {selectedChain.steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-1">
                <span className="font-mono text-primary">{i + 1}.</span>
                <span>{step.prompt?.name || "Unnamed prompt"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Step 3: Output Config */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</div>
          <h2 className="font-semibold">Output Configuration</h2>
        </div>

        {/* Format */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Output Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => onFormatChange("docx")}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                outputFormat === "docx"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >
              DOCX
            </button>
            <button
              onClick={() => onFormatChange("txt")}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                outputFormat === "txt"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >
              TXT
            </button>
          </div>
        </div>

        {/* Filename prefix */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Filename Prefix
          </label>
          <Input
            placeholder="e.g. report → report-1.docx, report-2.docx ..."
            value={filenamePrefix}
            onChange={(e) => onPrefixChange(e.target.value)}
          />
          {filenamePrefix.trim() && (
            <p className="text-xs text-muted-foreground">
              Output files: <span className="font-mono text-foreground">{filenamePrefix.trim()}-1.{outputFormat}</span>
              {selectedSourceIds.length > 1 && (
                <>, <span className="font-mono text-foreground">{filenamePrefix.trim()}-2.{outputFormat}</span>, ...</>
              )}
            </p>
          )}
        </div>

        {/* Model */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Model</label>
          <div className="relative" ref={modelDd.ref}>
            <button
              onClick={() => modelDd.setOpen(!modelDd.open)}
              className="w-full flex items-center justify-between px-3 py-2.5 border rounded-lg text-sm bg-background hover:bg-muted transition-colors"
            >
              <span>{AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.label || selectedModel}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            {modelDd.open && (
              <div className="absolute z-20 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onModelChange(m.id); modelDd.setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${
                      m.id === selectedModel ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    {m.id === selectedModel && <Check className="h-3 w-3" />}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Start button */}
      <Button
        size="lg"
        className="w-full"
        disabled={!canStart}
        onClick={onStart}
      >
        <Play className="h-4 w-4 mr-2" />
        Run Workflow ({selectedSourceIds.length} file{selectedSourceIds.length !== 1 ? "s" : ""})
      </Button>

      {/* History */}
      {workflowHistory.length > 0 && (
        <section className="space-y-3 pt-4 border-t">
          <h2 className="font-semibold text-sm text-muted-foreground">Recent Runs</h2>
          <div className="space-y-2">
            {workflowHistory.map((wf) => (
              <button
                key={wf.id}
                onClick={() => onViewRun(wf)}
                className="w-full text-left border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">
                    {wf.filename_prefix}
                  </span>
                  <StatusBadge status={wf.status} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{wf.total_files} files</span>
                  <span>{wf.output_format.toUpperCase()}</span>
                  <span>{new Date(wf.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Running View
// ═══════════════════════════════════════════════════════════════

function RunningView({
  workflow,
  onCancel,
}: {
  workflow: api.WorkflowRun;
  onCancel: () => void;
}) {
  const isActive = workflow.status === "running" || workflow.status === "pending";
  const overallPercent =
    workflow.total_files > 0
      ? Math.round((workflow.completed_files / workflow.total_files) * 100)
      : 0;

  const stepPercent =
    workflow.total_steps > 0 && isActive
      ? Math.round((workflow.current_step_index / workflow.total_steps) * 100)
      : workflow.status === "completed"
      ? 100
      : 0;

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 space-y-6">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon status={workflow.status} />
          <div>
            <h2 className="font-semibold text-lg">{workflow.filename_prefix}</h2>
            <p className="text-xs text-muted-foreground">
              {workflow.total_files} files &middot; {workflow.output_format.toUpperCase()} &middot;{" "}
              {new Date(workflow.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        {isActive && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            <Ban className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        )}
      </div>

      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className="text-muted-foreground">
            {workflow.completed_files} / {workflow.total_files} files
          </span>
        </div>
        <ProgressBar percent={overallPercent} />
      </div>

      {/* Current file progress */}
      {isActive && workflow.current_file_name && (
        <div className="space-y-2 bg-muted/30 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Processing: {workflow.current_file_name}
            </span>
            <span className="text-muted-foreground text-xs">
              Step {workflow.current_step_index + 1} / {workflow.total_steps}
            </span>
          </div>
          <ProgressBar percent={stepPercent} variant="secondary" />
        </div>
      )}

      {/* Error message */}
      {workflow.error_message && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive">
          {workflow.error_message}
        </div>
      )}

      {/* Results table */}
      {workflow.results && workflow.results.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Results</h3>
          <div className="border rounded-lg divide-y">
            {workflow.results.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {r.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span className="truncate">{r.source_name || r.source_id}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.filename && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {r.filename}
                    </span>
                  )}
                  {r.export_id && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={async () => {
                        try {
                          const blob = await api.downloadExport(r.export_id!);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = r.filename || "download";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error("Download failed");
                        }
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {r.error && (
                    <span className="text-xs text-destructive truncate max-w-40" title={r.error}>
                      {r.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary for completed */}
      {workflow.status === "completed" && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Workflow completed. All files have been exported and stored.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════════════════════

function ProgressBar({
  percent,
  variant = "primary",
}: {
  percent: number;
  variant?: "primary" | "secondary";
}) {
  return (
    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${
          variant === "primary" ? "bg-primary" : "bg-blue-500"
        }`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: api.WorkflowRun["status"] }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "secondary" },
    running: { label: "Running", variant: "default" },
    completed: { label: "Completed", variant: "outline" },
    error: { label: "Error", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "secondary" },
  };
  const c = config[status] || config.pending;
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function StatusIcon({ status }: { status: api.WorkflowRun["status"] }) {
  if (status === "running" || status === "pending")
    return <Loader2 className="h-6 w-6 text-primary animate-spin" />;
  if (status === "completed")
    return <CheckCircle2 className="h-6 w-6 text-green-500" />;
  if (status === "error")
    return <XCircle className="h-6 w-6 text-destructive" />;
  if (status === "cancelled")
    return <Ban className="h-6 w-6 text-muted-foreground" />;
  return <Clock className="h-6 w-6 text-muted-foreground" />;
}
