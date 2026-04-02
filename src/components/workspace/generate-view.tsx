"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Play,
  Loader2,
  FileDown,
  FileType,
  ChevronDown,
  Check,
  FileText,
  Image,
  Table,
  FileSpreadsheet,
  Type,
  Link2,
  Unlink,
  GitBranch,
  History,
  Eye,
  ChevronRight,
  File,
} from "lucide-react";
import { toast } from "sonner";
import type {
  Dataset,
  SavedPrompt,
  PromptChain,
  PromptFolder,
  Generation,
  ModelOption,
} from "@/lib/types";

const AVAILABLE_MODELS: ModelOption[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
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

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  image: Image,
  excel: FileSpreadsheet,
  csv: Table,
  text: Type,
  document: FileText,
  other: File,
};

type PromptMode = "single" | "chain";

export function GenerateView() {
  // Data
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [folders, setFolders] = useState<PromptFolder[]>([]);
  const [allPrompts, setAllPrompts] = useState<SavedPrompt[]>([]);
  const [chains, setChains] = useState<PromptChain[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);

  // Step 1: Dataset + file selection
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Step 2: Prompt
  const [promptMode, setPromptMode] = useState<PromptMode>("single");
  const [selectedPromptId, setSelectedPromptId] = useState<string>("");
  const [selectedChainId, setSelectedChainId] = useState<string>("");

  // Step 3: Generate
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);

  // UI
  const [showHistory, setShowHistory] = useState(false);
  const [exportDialog, setExportDialog] = useState<{ format: "docx" | "txt" } | null>(null);
  const [exportFilename, setExportFilename] = useState("");

  // Fetch all data
  useEffect(() => {
    const safeFetch = (url: string) =>
      fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

    Promise.all([
      safeFetch("/api/datasets"),
      safeFetch("/api/prompt-folders"),
      safeFetch("/api/prompts"),
      safeFetch("/api/prompt-chains"),
      safeFetch("/api/generations?limit=20"),
    ]).then(([dsData, folderData, promptData, chainData, genData]) => {
      if (dsData?.datasets) setDatasets(dsData.datasets);
      if (folderData?.folders) setFolders(folderData.folders);
      if (promptData?.prompts) setAllPrompts(promptData.prompts);
      if (chainData?.chains) setChains(chainData.chains);
      if (genData?.generations) setGenerations(genData.generations);
    });
  }, []);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
  const selectedPrompt = allPrompts.find((p) => p.id === selectedPromptId);
  const selectedChain = chains.find((c) => c.id === selectedChainId);

  const sessionTitle = (() => {
    const dsName = selectedDataset?.name || "";
    const promptName =
      promptMode === "chain"
        ? selectedChain?.name || ""
        : selectedPrompt?.name || "";
    if (dsName && promptName) return `${dsName} \u2014 ${promptName}`;
    return dsName || promptName || "Untitled";
  })();

  const handleGenerate = useCallback(async () => {
    if (selectedSourceIds.length === 0) {
      toast.error("Please select at least one input source");
      return;
    }

    setIsRunning(true);
    setGeneratedContent("");
    setCurrentGenerationId(null);

    try {
      const body: Record<string, unknown> = {
        sourceIds: selectedSourceIds,
        model: selectedModel,
        title: sessionTitle,
      };

      if (promptMode === "chain" && selectedChainId) {
        body.chainId = selectedChainId;
      } else {
        const prompt = allPrompts.find((p) => p.id === selectedPromptId);
        if (!prompt) {
          toast.error("Please select a prompt template");
          setIsRunning(false);
          return;
        }
        body.promptText = prompt.text;
        if (prompt.response_format) {
          body.formatText = prompt.response_format.template_text;
        }
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setGeneratedContent(data.content);
      setCurrentGenerationId(data.generationId);
      toast.success("Content generated!");
      // Refresh history
      const genRes = await fetch("/api/generations?limit=20");
      const genData = await genRes.json();
      if (genData.generations) setGenerations(genData.generations);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsRunning(false);
    }
  }, [
    selectedSourceIds,
    promptMode,
    selectedPromptId,
    allPrompts,
    selectedModel,
    sessionTitle,
    selectedChainId,
  ]);

  const openExportDialog = (format: "docx" | "txt") => {
    if (!generatedContent) {
      toast.error("No content to export");
      return;
    }
    setExportFilename(sessionTitle);
    setExportDialog({ format });
  };

  const handleExport = useCallback(
    async (format: "docx" | "txt", filename: string) => {
      if (!generatedContent) {
        toast.error("No content to export");
        return;
      }

      setIsExporting(true);
      setExportDialog(null);
      try {
        const title = filename || "Generated Document";
        const prompt = allPrompts.find((p) => p.id === selectedPromptId);
        const promptText = prompt?.text || "";
        let res: Response;

        if (format === "docx") {
          res = await fetch("/api/export-docx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              results: [{ prompt: promptText, response: generatedContent }],
              generationId: currentGenerationId,
            }),
          });
        } else {
          res = await fetch("/api/export-txt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              content: generatedContent,
              generationId: currentGenerationId,
            }),
          });
        }

        if (!res.ok) throw new Error("Export failed");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`Exported as .${format}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed");
      } finally {
        setIsExporting(false);
      }
    },
    [generatedContent, selectedPromptId, allPrompts, currentGenerationId]
  );

  const handleLoadGeneration = (gen: Generation) => {
    setGeneratedContent(gen.response_content || "");
    setCurrentGenerationId(gen.id);
    setShowHistory(false);
    toast.info(`Loaded: ${gen.title}`);
  };

  const toggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleDatasetChange = (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    const ds = datasets.find((d) => d.id === datasetId);
    if (ds) {
      setSelectedSourceIds(ds.input_sources.map((s) => s.id));
    } else {
      setSelectedSourceIds([]);
    }
  };

  const toggleSelectAll = () => {
    if (!selectedDataset) return;
    const allIds = selectedDataset.input_sources.map((s) => s.id);
    if (selectedSourceIds.length === allIds.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(allIds);
    }
  };


  const canGenerate =
    selectedSourceIds.length > 0 &&
    ((promptMode === "single" && selectedPromptId) ||
      (promptMode === "chain" && selectedChainId)) &&
    !isRunning;

  // Render content with formatting
  const renderContent = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;

      const headingMatch = trimmed.match(/^<heading>(.*?)<\/heading>$/);
      if (headingMatch)
        return (
          <h2 key={i} className="text-lg font-bold mt-4 mb-2">
            {headingMatch[1]}
          </h2>
        );

      const subMatch = trimmed.match(/^<subheading>(.*?)<\/subheading>$/);
      if (subMatch)
        return (
          <h3 key={i} className="text-base font-semibold mt-3 mb-1">
            {subMatch[1]}
          </h3>
        );

      const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
      if (bulletMatch)
        return (
          <li key={i} className="ml-4 list-disc">
            {renderInline(bulletMatch[1])}
          </li>
        );

      const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
      if (numMatch)
        return (
          <li key={i} className="ml-4 list-decimal" value={parseInt(numMatch[1])}>
            {renderInline(numMatch[2])}
          </li>
        );

      return (
        <p key={i} className="my-1">
          {renderInline(trimmed)}
        </p>
      );
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(<bold>[\s\S]*?<\/bold>|\*\*[\s\S]*?\*\*)/g);
    return parts.map((part, i) => {
      const boldXml = part.match(/^<bold>([\s\S]*?)<\/bold>$/);
      if (boldXml) return <strong key={i}>{boldXml[1]}</strong>;
      const boldMd = part.match(/^\*\*([\s\S]*?)\*\*$/);
      if (boldMd) return <strong key={i}>{boldMd[1]}</strong>;
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="h-full flex">
      {/* Left: Configuration */}
      <div className="w-105 shrink-0 border-r flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Model */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold flex items-center gap-2 mb-2">
                Model
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isRunning}
                  className="w-full h-9 pl-3 pr-8 text-sm border rounded-md bg-background appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Step 1: Dataset & File Selection */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                1
              </span>
              Select Dataset & Files
              {selectedSourceIds.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {selectedSourceIds.length} file{selectedSourceIds.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </h3>

            {datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-lg p-3 text-center">
                No datasets available. Go to Sources to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {/* Dataset selector */}
                <div className="relative">
                  <select
                    value={selectedDatasetId}
                    onChange={(e) => handleDatasetChange(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 text-sm border rounded-md bg-background appearance-none cursor-pointer"
                  >
                    <option value="">Select a dataset...</option>
                    {datasets.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name} ({ds.input_sources.length} files)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>

                {/* File selection within dataset */}
                {selectedDataset && selectedDataset.input_sources.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
                      <span className="text-xs font-medium text-muted-foreground">
                        Files in {selectedDataset.name}
                      </span>
                      <button
                        onClick={toggleSelectAll}
                        className="text-xs text-primary hover:underline"
                      >
                        {selectedSourceIds.length === selectedDataset.input_sources.length
                          ? "Deselect all"
                          : "Select all"}
                      </button>
                    </div>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto p-1.5">
                      {selectedDataset.input_sources.map((source) => {
                        const Icon = TYPE_ICONS[source.type] || FileText;
                        const isSelected = selectedSourceIds.includes(source.id);
                        return (
                          <div
                            key={source.id}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-primary/10 border border-primary/30"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => toggleSource(source.id)}
                          >
                            <div
                              className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/30"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-sm truncate flex-1">
                              {source.name}
                            </span>
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              {source.type}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedDataset && selectedDataset.input_sources.length === 0 && (
                  <p className="text-xs text-muted-foreground border rounded-lg p-3 text-center">
                    This dataset has no files. Go to Sources to upload files.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Prompt */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                2
              </span>
              Select Prompt
            </h3>

            {/* Mode tabs */}
            <div className="flex border rounded-lg overflow-hidden mb-3">
              <button
                onClick={() => setPromptMode("single")}
                className={`flex-1 text-sm py-2 px-3 transition-colors ${
                  promptMode === "single"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                Single Prompt
              </button>
              <button
                onClick={() => setPromptMode("chain")}
                className={`flex-1 text-sm py-2 px-3 transition-colors ${
                  promptMode === "chain"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <GitBranch className="h-3.5 w-3.5 inline mr-1" />
                Prompt Chain
              </button>
            </div>

            {promptMode === "single" ? (
              <div className="space-y-3">
                {/* Prompt selector */}
                <div className="relative">
                  <select
                    value={selectedPromptId}
                    onChange={(e) => setSelectedPromptId(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 text-sm border rounded-md bg-background appearance-none cursor-pointer"
                  >
                    <option value="">Select a prompt template...</option>
                    {folders.map((folder) => (
                      <optgroup key={folder.id} label={folder.name}>
                        {(folder.prompts || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.response_format
                              ? ` [${p.response_format.name}]`
                              : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>

                {/* Selected prompt info */}
                {selectedPrompt && (
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2 text-xs">
                      {selectedPrompt.response_format ? (
                        <>
                          <Link2 className="h-3 w-3" />
                          <span>
                            Format:{" "}
                            <strong>
                              {selectedPrompt.response_format.name}
                            </strong>
                          </span>
                        </>
                      ) : (
                        <>
                          <Unlink className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            No format paired
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {selectedPrompt.text}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Chain mode */
              <div className="space-y-3">
                <div className="relative">
                  <select
                    value={selectedChainId}
                    onChange={(e) => setSelectedChainId(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 text-sm border rounded-md bg-background appearance-none cursor-pointer"
                  >
                    <option value="">Select a prompt chain...</option>
                    {chains.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.steps?.length || 0} steps)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>

                {/* Show chain steps preview */}
                {selectedChain && selectedChain.steps && (
                  <div className="border rounded-lg p-3 space-y-1.5 bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      Chain Steps
                    </p>
                    {selectedChain.steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-2 text-sm">
                        <span className="h-5 w-5 rounded-full bg-muted text-muted-foreground text-[10px] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="truncate">
                          {step.prompt?.name || "Unknown"}
                        </span>
                        {step.response_format && (
                          <Badge variant="outline" className="text-[9px] shrink-0">
                            {step.response_format.name}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {chains.length === 0 && (
                  <p className="text-xs text-muted-foreground border rounded-lg p-3 text-center">
                    No chains available. Go to Prompts to create one.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Generate + History buttons */}
        <div className="p-4 border-t shrink-0 space-y-2 bg-card">
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Generate Content
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-1" />
            History
            <ChevronRight
              className={`h-3 w-3 ml-auto transition-transform ${
                showHistory ? "rotate-90" : ""
              }`}
            />
          </Button>

          {showHistory && (
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
              {generations.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">
                  No history yet
                </p>
              ) : (
                generations.map((gen) => (
                  <div
                    key={gen.id}
                    className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/30 cursor-pointer"
                    onClick={() =>
                      gen.status === "completed" && handleLoadGeneration(gen)
                    }
                  >
                    <div className="truncate flex-1 mr-2">
                      <p className="text-xs font-medium truncate">{gen.title}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>
                          {new Date(gen.created_at).toLocaleDateString()}
                        </span>
                        <Badge
                          variant={
                            gen.status === "completed"
                              ? "secondary"
                              : gen.status === "error"
                              ? "destructive"
                              : "outline"
                          }
                          className="text-[9px]"
                        >
                          {gen.status}
                        </Badge>
                      </div>
                    </div>
                    {gen.status === "completed" && (
                      <Eye className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Results */}
      <div className="flex-1 overflow-y-auto">
        {generatedContent ? (
          <div className="p-6 max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">
                  {sessionTitle}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(generatedContent.length / 1000).toFixed(1)}k characters
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openExportDialog("docx")}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileDown className="h-3 w-3 mr-1" />
                  )}
                  .docx
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openExportDialog("txt")}
                  disabled={isExporting}
                >
                  <FileType className="h-3 w-3 mr-1" />
                  .txt
                </Button>
              </div>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert border rounded-lg p-6 bg-card">
              {renderContent(generatedContent)}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <Play className="h-12 w-12 mx-auto opacity-20" />
              <div>
                <p className="text-sm font-medium">Ready to Generate</p>
                <p className="text-xs mt-1">
                  1. Select input sources &rarr; 2. Pick a prompt &rarr; 3. Generate
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export filename dialog */}
      {exportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-xl p-6 w-full max-w-md shadow-lg space-y-4">
            <h3 className="text-sm font-semibold">
              Export as .{exportDialog.format}
            </h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                File name
              </label>
              <Input
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                placeholder="Enter file name..."
                className="h-9 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && exportFilename.trim()) {
                    handleExport(exportDialog.format, exportFilename.trim());
                  }
                  if (e.key === "Escape") setExportDialog(null);
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExportDialog(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleExport(exportDialog.format, exportFilename.trim())}
                disabled={!exportFilename.trim()}
              >
                <FileDown className="h-3.5 w-3.5 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
