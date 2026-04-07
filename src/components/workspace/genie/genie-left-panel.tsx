"use client";

import {
  Database,
  FileText,
  Image,
  Table,
  FileSpreadsheet,
  Type,
  File,
  ChevronDown,
  Check,
  Cpu,
} from "lucide-react";
import type { Dataset, InputSource } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-context";

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  image: Image,
  excel: FileSpreadsheet,
  csv: Table,
  text: Type,
  document: FileText,
  other: File,
};

const AVAILABLE_MODELS = [
  { id: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash" },
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

interface GenieLeftPanelProps {
  selectedDatasetId: string | null;
  onDatasetChange: (id: string | null) => void;
  selectedSourceIds: string[];
  onSourceSelectionChange: (ids: string[]) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export function GenieLeftPanel({
  selectedDatasetId,
  onDatasetChange,
  selectedSourceIds,
  onSourceSelectionChange,
  selectedModel,
  onModelChange,
}: GenieLeftPanelProps) {
  const { datasets, isLoadingDatasets: loading } = useWorkspace();

  const activeDataset = datasets.find((d) => d.id === selectedDatasetId) || null;

  const toggleSource = (sourceId: string) => {
    if (selectedSourceIds.includes(sourceId)) {
      onSourceSelectionChange(selectedSourceIds.filter((id) => id !== sourceId));
    } else {
      onSourceSelectionChange([...selectedSourceIds, sourceId]);
    }
  };

  const selectAll = () => {
    if (!activeDataset) return;
    onSourceSelectionChange((activeDataset.input_sources ?? []).map((s) => s.id));
  };

  const deselectAll = () => {
    onSourceSelectionChange([]);
  };

  return (
    <div className="h-full flex flex-col bg-card border-r overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b">
        <h3 className="text-sm font-semibold text-foreground">Sources</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select dataset &amp; files
        </p>
      </div>

      {/* Model selector */}
      <div className="px-3 py-2 border-b">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          LLM Model
        </label>
        <div className="relative">
          <select
            className="w-full h-8 pl-7 pr-8 rounded-md border text-xs appearance-none cursor-pointer bg-background"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <Cpu className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Dataset selector */}
      <div className="px-3 py-2 border-b">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Dataset
        </label>
        <div className="relative">
          <select
            className="w-full h-8 pl-7 pr-8 rounded-md border text-xs appearance-none cursor-pointer bg-background"
            value={selectedDatasetId || ""}
            onChange={(e) => {
              const val = e.target.value || null;
              onDatasetChange(val);
              onSourceSelectionChange([]);
            }}
          >
            <option value="">Select a dataset...</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.input_sources?.length || 0} files)
              </option>
            ))}
          </select>
          <Database className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-muted-foreground">Loading datasets...</p>
          </div>
        ) : !activeDataset ? (
          <div className="flex flex-col items-center justify-center h-32 px-4">
            <Database className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground text-center">
              Select a dataset to view files
            </p>
          </div>
        ) : (activeDataset.input_sources ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4">
            <p className="text-xs text-muted-foreground text-center">
              No files in this dataset
            </p>
          </div>
        ) : (
          <>
            {/* Select all / deselect */}
            <div className="px-3 py-1.5 flex items-center justify-between border-b">
              <span className="text-xs text-muted-foreground">
                {selectedSourceIds.length} / {(activeDataset.input_sources ?? []).length} selected
              </span>
              <button
                className="text-xs text-primary hover:underline"
                onClick={
                  selectedSourceIds.length === (activeDataset.input_sources ?? []).length
                    ? deselectAll
                    : selectAll
                }
              >
                {selectedSourceIds.length === (activeDataset.input_sources ?? []).length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>

            {/* File checkboxes */}
            <div className="py-1">
              {(activeDataset.input_sources ?? []).map((source) => {
                const Icon = TYPE_ICONS[source.type] || File;
                const checked = selectedSourceIds.includes(source.id);
                return (
                  <button
                    key={source.id}
                    onClick={() => toggleSource(source.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${
                      checked ? "bg-primary/5" : ""
                    }`}
                  >
                    <div
                      className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        checked
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1">
                      {source.name || source.original_filename}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
