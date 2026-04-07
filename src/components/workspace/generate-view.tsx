"use client";

import { useState, useCallback, useMemo } from "react";
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
  Code,
  ChevronRight,
  File,
} from "lucide-react";
import { toast } from "sonner";
import type { ModelOption, Generation } from "@/lib/types";
import * as api from "@/lib/api";
import { useWorkspace } from "@/lib/workspace-context";

const AVAILABLE_MODELS: ModelOption[] = [
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
  // Use workspace context
  const {
    datasets,
    folders,
    prompts: allPrompts,
    chains,
    generations,
    isLoadingDatasets,
    isLoadingPrompts,
    addGeneration,
  } = useWorkspace();
  
  const isLoadingData = isLoadingDatasets || isLoadingPrompts;

  // Step 1: Dataset + file selection
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Step 2: Prompt
  const [promptMode, setPromptMode] = useState<PromptMode>("single");
  const [selectedPromptId, setSelectedPromptId] = useState<string>("");
  const [selectedChainId, setSelectedChainId] = useState<string>("");

  // Step 3: Generate
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);

  // Chain progress
  const [chainProgress, setChainProgress] = useState<{
    currentStep: number;
    totalSteps: number;
    stepName: string;
    completedSteps: { name: string; content: string }[];
  } | null>(null);

  // UI
  const [showHistory, setShowHistory] = useState(false);
  const [exportDialog, setExportDialog] = useState<{ format: "docx" | "txt" | "pdf" } | null>(null);
  const [exportFilename, setExportFilename] = useState("");
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");

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
    setChainProgress(null);

    try {
      const prompt = allPrompts.find((p) => p.id === selectedPromptId);

      // Chain mode: use SSE streaming
      if (promptMode === "chain" && selectedChainId) {
        setChainProgress({ currentStep: 0, totalSteps: 0, stepName: "Starting...", completedSteps: [] });

        await api.generateChainStream(
          {
            source_ids: selectedSourceIds,
            prompt_text: "",
            model: selectedModel,
            title: sessionTitle,
            chain_id: selectedChainId,
            grade: grade || undefined,
            subject: subject || undefined,
          },
          (event) => {
            switch (event.event) {
              case "planning":
                setChainProgress((prev) => ({
                  currentStep: 0,
                  totalSteps: prev?.totalSteps || 0,
                  stepName: event.data.message || "Analyzing chapter & planning workbook...",
                  completedSteps: prev?.completedSteps || [],
                }));
                break;
              case "step_start":
                setChainProgress((prev) => ({
                  currentStep: event.data.step || 0,
                  totalSteps: event.data.total_steps || 0,
                  stepName: event.data.step_name || "",
                  completedSteps: prev?.completedSteps || [],
                }));
                break;
              case "step_complete":
                setChainProgress((prev) => ({
                  currentStep: event.data.step || 0,
                  totalSteps: event.data.total_steps || 0,
                  stepName: event.data.step_name || "",
                  completedSteps: [
                    ...(prev?.completedSteps || []),
                    { name: event.data.step_name || "", content: event.data.content || "" },
                  ],
                }));
                break;
              case "done":
                setGeneratedContent(event.data.content || "");
                setCurrentGenerationId(event.data.generation_id || null);
                setChainProgress(null);
                toast.success("Content generated!");
                if (event.data.generation_id) {
                  addGeneration({
                    id: event.data.generation_id,
                    user_id: "",
                    title: sessionTitle,
                    prompt_text: "",
                    response_format_text: null,
                    model_used: selectedModel,
                    status: "completed",
                    error_message: null,
                    prompt_chain_id: selectedChainId ?? null,
                    response_content: event.data.content || "",
                    created_at: new Date().toISOString(),
                  });
                }
                break;
              case "error":
                toast.error(event.data.message || "Chain generation failed");
                setChainProgress(null);
                break;
            }
          },
        );

        setIsRunning(false);
        return;
      }

      // Single prompt mode
      if (!prompt) {
        toast.error("Please select a prompt template");
        setIsRunning(false);
        return;
      }

      const data = await api.generate({
        source_ids: selectedSourceIds,
        prompt_text: prompt.text || "",
        format_text: prompt.response_format?.template_text,
        model: selectedModel,
        title: sessionTitle,
      });

      setGeneratedContent(data.content);
      setCurrentGenerationId(data.generation_id);
      toast.success("Content generated!");
      
      // Add to generations in context
      if (data.generation_id) {
        addGeneration({
          id: data.generation_id,
          user_id: "",
          title: sessionTitle,
          prompt_text: "",
          response_format_text: null,
          model_used: selectedModel,
          status: "completed",
          error_message: null,
          prompt_chain_id: null,
          response_content: data.content,
          created_at: new Date().toISOString(),
        });
      }
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
    addGeneration,
  ]);

  const openExportDialog = (format: "docx" | "txt" | "pdf") => {
    if (!generatedContent) {
      toast.error("No content to export");
      return;
    }
    setExportFilename(sessionTitle);
    setExportDialog({ format });
  };

  const handleExport = useCallback(
    async (format: "docx" | "txt" | "pdf", filename: string) => {
      if (!generatedContent) {
        toast.error("No content to export");
        return;
      }

      setIsExporting(true);
      setExportDialog(null);
      try {
        const title = filename || "Generated Document";
        const prompt = allPrompts.find((p) => p.id === selectedPromptId);
        let blob: Blob;

        if (format === "docx") {
          blob = await api.exportDocx({
            title,
            results: [{ prompt_name: prompt?.name || "Prompt", content: generatedContent }],
            generation_id: currentGenerationId || undefined,
            dataset_id: selectedDatasetId || undefined,
          });
        } else if (format === "pdf") {
          blob = await api.exportPdf({
            title,
            results: [{ prompt_name: prompt?.name || "Prompt", content: generatedContent }],
            generation_id: currentGenerationId || undefined,
            dataset_id: selectedDatasetId || undefined,
          });
        } else {
          blob = await api.exportTxt({
            title,
            content: generatedContent,
            generation_id: currentGenerationId || undefined,
            dataset_id: selectedDatasetId || undefined,
          });
        }

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
    if (ds && ds.input_sources) {
      setSelectedSourceIds(ds.input_sources.map((s) => s.id));
    } else {
      setSelectedSourceIds([]);
    }
  };

  const toggleSelectAll = () => {
    if (!selectedDataset || !selectedDataset.input_sources) return;
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

  // Render content with full tag system preview
  const renderContent = (text: string) => {
    if (viewMode === "raw") {
      return (
        <pre className="whitespace-pre-wrap font-mono text-xs bg-muted/50 p-4 rounded-lg overflow-x-auto">
          {text}
        </pre>
      );
    }

    // Normalize: join multi-line <indent>...</indent> and split lines with multiple block tags
    const normalizeContent = (raw: string): string => {
      // Join indent that spans two lines: <indent>content\n  </indent>
      let out = raw.replace(/<indent>([^\n]*?)\s*\n\s*<\/indent>/g, "<indent>$1</indent>");
      const blockTag =
        /(?:<title>.*?<\/title>)|(?:<heading>.*?<\/heading>)|(?:<subheading>.*?<\/subheading>)|(?:<instruction>.*?<\/instruction>)|(?:<indent>.*?<\/indent>)|(?:<hr\s*\/>)|(?:<pagebreak\s*\/>)|(?:<blank\s*\/>)|(?:<space\s+lines="\d+"\s*\/>)/g;
      const newLines: string[] = [];
      for (const line of out.split("\n")) {
        const parts = line.trim().split(new RegExp(`(${blockTag.source})`, "g"));
        const segments = parts.filter((p) => p && p.trim());
        if (segments.length > 1) {
          newLines.push(...segments.map((s) => s.trim()));
        } else {
          newLines.push(line);
        }
      }
      return newLines.join("\n");
    };

    const normalized = normalizeContent(text);
    const lines = normalized.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const trimmed = lines[i].trim();

      // Empty line or stray </indent>
      if (!trimmed || trimmed === "</indent>") {
        if (!trimmed) elements.push(<br key={i} />);
        i++;
        continue;
      }

      // <table>...</table> multi-line block
      if (trimmed.startsWith("<table")) {
        const blockLines: string[] = [];
        while (i < lines.length && !lines[i].includes("</table>")) {
          blockLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          blockLines.push(lines[i]);
          i++;
        }
        const block = blockLines.join("\n");
        const rows: string[][] = [];
        const rowRegex = /<row>([\s\S]*?)<\/row>/g;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(block)) !== null) {
          const cells = [...rowMatch[1].matchAll(/<cell>([\s\S]*?)<\/cell>/g)].map((m) => m[1].trim());
          if (cells.length) rows.push(cells);
        }
        if (rows.length) {
          elements.push(
            <table key={`tbl-${i}`} className="w-full border-collapse border border-border my-3 text-sm">
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={ri === 0 ? "bg-muted font-semibold" : ""}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-border px-3 py-1.5">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        continue;
      }

      // <box>...</box> multi-line block
      if (trimmed.startsWith("<box")) {
        const blockLines: string[] = [];
        while (i < lines.length && !lines[i].includes("</box>")) {
          blockLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          blockLines.push(lines[i]);
          i++;
        }
        const block = blockLines.join("\n");
        const titleMatch = block.match(/<box\s+title="([^"]*)"/);
        const innerMatch = block.match(/<box[^>]*>([\s\S]*?)<\/box>/);
        const boxContent = innerMatch ? innerMatch[1].trim() : "";
        elements.push(
          <div key={`box-${i}`} className="border rounded-lg p-4 my-3 bg-muted/30">
            {titleMatch && (
              <div className="font-semibold text-sm mb-2">{titleMatch[1]}</div>
            )}
            {boxContent.split("\n").map((bl, bi) => {
              const blt = bl.trim();
              if (!blt) return <br key={bi} />;
              const hm = blt.match(/^<heading>(.*?)<\/heading>$/);
              if (hm) return <h2 key={bi} className="text-lg font-bold mt-3 mb-1">{renderInline(hm[1])}</h2>;
              const shm = blt.match(/^<subheading>(.*?)<\/subheading>$/);
              if (shm) return <h3 key={bi} className="text-base font-semibold mt-2 mb-1">{renderInline(shm[1])}</h3>;
              const im = blt.match(/^<instruction>(.*?)<\/instruction>$/);
              if (im) return <p key={bi} className="italic text-muted-foreground my-1 text-sm">{renderInline(im[1])}</p>;
              if (blt === "<hr/>" || blt === "<hr />") return <hr key={bi} className="my-2 border-border" />;
              return <p key={bi} className="my-0.5 text-sm">{renderInline(blt)}</p>;
            })}
          </div>
        );
        continue;
      }

      // <title>
      const titleMatch = trimmed.match(/^<title>(.*?)<\/title>$/);
      if (titleMatch) {
        elements.push(
          <h1 key={i} className="text-xl font-bold text-center mt-5 mb-3">
            {titleMatch[1]}
          </h1>
        );
        i++;
        continue;
      }

      // <heading>
      const headingMatch = trimmed.match(/^<heading>(.*?)<\/heading>$/);
      if (headingMatch) {
        elements.push(
          <h2 key={i} className="text-lg font-bold mt-4 mb-2">
            {headingMatch[1]}
          </h2>
        );
        i++;
        continue;
      }

      // <subheading>
      const subMatch = trimmed.match(/^<subheading>(.*?)<\/subheading>$/);
      if (subMatch) {
        elements.push(
          <h3 key={i} className="text-base font-semibold mt-3 mb-1">
            {subMatch[1]}
          </h3>
        );
        i++;
        continue;
      }

      // <instruction>
      const instrMatch = trimmed.match(/^<instruction>(.*?)<\/instruction>$/);
      if (instrMatch) {
        elements.push(
          <p key={i} className="italic text-muted-foreground my-2">
            {instrMatch[1]}
          </p>
        );
        i++;
        continue;
      }

      // <hr/>
      if (trimmed === "<hr/>" || trimmed === "<hr />") {
        elements.push(<hr key={i} className="my-4 border-border" />);
        i++;
        continue;
      }

      // <pagebreak/>
      if (trimmed === "<pagebreak/>" || trimmed === "<pagebreak />") {
        elements.push(
          <div key={i} className="my-4 border-t-2 border-dashed border-muted-foreground/30 text-center">
            <span className="text-[10px] text-muted-foreground bg-card px-2 relative -top-2.5">page break</span>
          </div>
        );
        i++;
        continue;
      }

      // <space lines="N"/>
      const spaceMatch = trimmed.match(/^<space\s+lines="(\d+)"\s*\/>$/);
      if (spaceMatch) {
        const n = parseInt(spaceMatch[1]);
        elements.push(
          <div key={i} style={{ height: `${n * 1.5}em` }} className="bg-muted/20 rounded my-1" />
        );
        i++;
        continue;
      }

      // <blank/> or ___
      if (trimmed === "<blank/>" || trimmed === "<blank />" || /^_{3,}$/.test(trimmed)) {
        elements.push(
          <p key={i} className="my-1 tracking-widest text-muted-foreground">
            {"_".repeat(40)}
          </p>
        );
        i++;
        continue;
      }

      // <indent>...</indent> (supports nesting, including partial/unclosed)
      if (trimmed.startsWith("<indent>")) {
        let inner = trimmed;
        let level = 0;
        // Count and strip opening <indent> tags
        while (inner.startsWith("<indent>")) {
          inner = inner.slice("<indent>".length);
          level++;
        }
        // Strip closing </indent> tags
        while (inner.endsWith("</indent>")) {
          inner = inner.slice(0, -"</indent>".length);
        }
        inner = inner.trim();
        const bulletInner = inner.match(/^[-•*]\s+(.+)/);
        const numInner = inner.match(/^(\d+)[.)]\s+(.+)/);
        if (bulletInner) {
          elements.push(
            <li key={i} className="list-disc" style={{ marginLeft: `${level * 1.5}rem` }}>
              {renderInline(bulletInner[1])}
            </li>
          );
        } else if (numInner) {
          elements.push(
            <li key={i} className="list-decimal" style={{ marginLeft: `${level * 1.5}rem` }} value={parseInt(numInner[1])}>
              {renderInline(numInner[2])}
            </li>
          );
        } else if (inner) {
          elements.push(
            <p key={i} className="my-0.5" style={{ marginLeft: `${level * 1.5}rem` }}>
              {renderInline(inner)}
            </p>
          );
        }
        i++;
        continue;
      }

      // Bullet list
      const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
      if (bulletMatch) {
        elements.push(
          <li key={i} className="ml-4 list-disc">
            {renderInline(bulletMatch[1])}
          </li>
        );
        i++;
        continue;
      }

      // Hierarchical numbered list: 1.1 Item, 1.1.1 Item, etc.
      const hierMatch = trimmed.match(/^(\d+(?:\.\d+)+)\s+(.+)/);
      if (hierMatch) {
        const depth = (hierMatch[1].match(/\./g) || []).length;
        elements.push(
          <p key={i} className="my-0.5" style={{ marginLeft: `${depth * 1.25}rem` }}>
            <strong className="mr-1">{hierMatch[1]}</strong>
            {renderInline(hierMatch[2])}
          </p>
        );
        i++;
        continue;
      }

      // Numbered list
      const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
      if (numMatch) {
        elements.push(
          <li key={i} className="ml-4 list-decimal" value={parseInt(numMatch[1])}>
            {renderInline(numMatch[2])}
          </li>
        );
        i++;
        continue;
      }

      // Markdown headings fallback
      const mdMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
      if (mdMatch) {
        const lvl = mdMatch[1].length;
        const cls = lvl === 1 ? "text-lg font-bold mt-4 mb-2" : lvl === 2 ? "text-base font-semibold mt-3 mb-1" : "text-sm font-semibold mt-2 mb-1";
        const Tag = lvl === 1 ? "h2" : lvl === 2 ? "h3" : "h4";
        elements.push(<Tag key={i} className={cls}>{mdMatch[2]}</Tag>);
        i++;
        continue;
      }

      // Regular text
      elements.push(
        <p key={i} className="my-1">
          {renderInline(trimmed)}
        </p>
      );
      i++;
    }

    return elements;
  };

  const renderInline = (text: string): React.ReactNode => {
    const pattern =
      /(<bold>[\s\S]*?<\/bold>|<italic>[\s\S]*?<\/italic>|<underline>[\s\S]*?<\/underline>|<label>[\s\S]*?<\/label>|<blank\s*\/>|\*\*[\s\S]*?\*\*|_{3,})/g;
    const parts = text.split(pattern);
    return parts.map((part, i) => {
      if (!part) return null;

      const boldXml = part.match(/^<bold>([\s\S]*?)<\/bold>$/);
      if (boldXml) return <strong key={i}>{boldXml[1]}</strong>;

      const italicXml = part.match(/^<italic>([\s\S]*?)<\/italic>$/);
      if (italicXml) return <em key={i}>{italicXml[1]}</em>;

      const ulXml = part.match(/^<underline>([\s\S]*?)<\/underline>$/);
      if (ulXml) return <u key={i}>{ulXml[1]}</u>;

      const labelXml = part.match(/^<label>([\s\S]*?)<\/label>$/);
      if (labelXml) return <strong key={i} className="mr-1">{labelXml[1]}</strong>;

      if (part.trim() === "<blank/>" || part.trim() === "<blank />" || /^_{3,}$/.test(part.trim()))
        return <span key={i} className="tracking-widest text-muted-foreground">{"_".repeat(30)}</span>;

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

            {/* Grade & Subject (optional hints for master planner) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Grade / Class</label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  disabled={isRunning}
                  placeholder="e.g. Class 4"
                  className="w-full h-8 px-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isRunning}
                  placeholder="e.g. Science"
                  className="w-full h-8 px-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
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

            {isLoadingData ? (
              <div className="flex items-center justify-center p-6 border rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading datasets...</span>
              </div>
            ) : datasets.length === 0 ? (
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
                        {ds.name} ({ds.input_sources?.length ?? 0} files)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>

                {/* File selection within dataset */}
                {selectedDataset && (selectedDataset.input_sources?.length ?? 0) > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
                      <span className="text-xs font-medium text-muted-foreground">
                        Files in {selectedDataset.name}
                      </span>
                      <button
                        onClick={toggleSelectAll}
                        className="text-xs text-primary hover:underline"
                      >
                        {selectedSourceIds.length === (selectedDataset.input_sources?.length ?? 0)
                          ? "Deselect all"
                          : "Select all"}
                      </button>
                    </div>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto p-1.5">
                      {(selectedDataset.input_sources ?? []).map((source) => {
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

                {selectedDataset && (selectedDataset.input_sources?.length ?? 0) === 0 && (
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
                {isLoadingData ? (
                  <div className="flex items-center justify-center p-4 border rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading prompts...</span>
                  </div>
                ) : (
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
                )}

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
        {/* Chain progress overlay */}
        {isRunning && chainProgress ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-lg w-full mx-auto p-8 space-y-6">
              {/* Header */}
              <div className="text-center space-y-1">
                <h2 className="text-lg font-semibold">{sessionTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  Running prompt chain&hellip;
                </p>
              </div>

              {/* Overall progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Overall Progress</span>
                  <span className="text-muted-foreground">
                    {chainProgress.completedSteps.length} / {chainProgress.totalSteps} steps
                  </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{
                      width: `${chainProgress.totalSteps > 0 ? Math.round((chainProgress.completedSteps.length / chainProgress.totalSteps) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Current step */}
              {chainProgress.currentStep > chainProgress.completedSteps.length && (
                <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      Step {chainProgress.currentStep}: {chainProgress.stepName}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Processing...
                    </span>
                  </div>
                </div>
              )}

              {/* Completed steps list */}
              {chainProgress.completedSteps.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">Completed Steps</h3>
                  <div className="border rounded-lg divide-y">
                    {chainProgress.completedSteps.map((step, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm"
                      >
                        <div className="h-5 w-5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3" />
                        </div>
                        <span className="font-medium">Step {i + 1}</span>
                        <span className="text-muted-foreground truncate">{step.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : generatedContent ? (
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
                <div className="flex border rounded-lg overflow-hidden mr-1">
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 transition-colors ${
                      viewMode === "preview"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                    title="Formatted preview"
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                  <button
                    onClick={() => setViewMode("raw")}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 transition-colors ${
                      viewMode === "raw"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                    title="Raw XML tags"
                  >
                    <Code className="h-3 w-3" />
                    Raw
                  </button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openExportDialog("pdf")}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileDown className="h-3 w-3 mr-1" />
                  )}
                  .pdf
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openExportDialog("docx")}
                  disabled={isExporting}
                >
                  <FileDown className="h-3 w-3 mr-1" />
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
