"use client";

import { useState } from "react";
import {
  Loader2,
  Sparkles,
  Download,
  RefreshCw,
  ImageIcon,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DIMENSION_OPTIONS,
  STYLE_OPTIONS,
  DETAIL_LEVELS,
  type InfographicStyle,
  type DetailLevel,
} from "./infographics-config";
import { getAuthHeaders, API_BASE_URL } from "@/lib/api";

interface InfographicsPanelProps {
  selectedSourceIds: string[];
  selectedDatasetId: string | null;
  selectedModel: string;
}

type GenerationStep = "idle" | "summarizing" | "prompting" | "generating" | "done" | "error";

interface GenerationResult {
  imageUrl: string;
  filename: string;
  summary: string;
  imagePrompt: string;
  exportId: string | null;
}

export function InfographicsPanel({
  selectedSourceIds,
  selectedDatasetId,
  selectedModel,
}: InfographicsPanelProps) {
  // Configuration
  const [dimensionId, setDimensionId] = useState<string | null>(null);
  const [style, setStyle] = useState<InfographicStyle | null>(null);
  const [detailLevel, setDetailLevel] = useState<DetailLevel | null>(null);
  const [filename, setFilename] = useState("");

  // Generation state
  const [step, setStep] = useState<GenerationStep>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGenerate =
    selectedSourceIds.length > 0 &&
    dimensionId !== null &&
    style !== null &&
    detailLevel !== null &&
    filename.trim().length > 0 &&
    step !== "summarizing" &&
    step !== "prompting" &&
    step !== "generating";

  const isGenerating = step === "summarizing" || step === "prompting" || step === "generating";

  const stepLabels: Record<GenerationStep, string> = {
    idle: "",
    summarizing: "Generating summary from sources...",
    prompting: "Crafting image prompt...",
    generating: "Generating infographic image...",
    done: "Generation complete!",
    error: "Generation failed",
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setStep("summarizing");
    setError(null);
    setResult(null);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/genie/infographics`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          source_ids: selectedSourceIds,
          dataset_id: selectedDatasetId || undefined,
          model: selectedModel,
          dimension_id: dimensionId,
          style,
          detail_level: detailLevel,
          filename: filename.trim(),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(errBody.detail || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      let errorFromStream: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines (split by double-newline or newline)
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (event.error) {
            errorFromStream = event.error as string;
            break;
          }

          if (event.step === 1) setStep("summarizing");
          else if (event.step === 2) setStep("prompting");
          else if (event.step === 3 || event.step === 4) setStep("generating");

          if (event.complete && !event.step) {
            setResult({
              imageUrl: (event.image_url as string) ?? "",
              filename: (event.filename as string) ?? "",
              summary: (event.summary as string) ?? "",
              imagePrompt: (event.image_prompt as string) ?? "",
              exportId: (event.export_id as string) ?? null,
            });
            setStep("done");
            toast.success("Infographic generated successfully!");
          }
        }

        if (errorFromStream) break;
      }

      if (errorFromStream) {
        throw new Error(errorFromStream);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setStep("error");
      toast.error(msg);
    }
  };

  const handleRegenerate = () => {
    setResult(null);
    setStep("idle");
    setError(null);
    handleGenerate();
  };

  const handleDownload = async () => {
    if (!result) return;

    if (result.exportId) {
      // Download via exports API (from "exports" bucket)
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/exports/${result.exportId}/download`, {
        headers: authHeaders,
      });
      if (!res.ok) {
        toast.error("Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename || "infographic.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (result.imageUrl) {
      // Fallback: direct data URL download
      const a = document.createElement("a");
      a.href = result.imageUrl;
      a.download = result.filename || "infographic.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Show result if generation is done
  if (step === "done" && result) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Top bar */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Infographic — {result.filename}
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedSourceIds.length} source{selectedSourceIds.length !== 1 ? "s" : ""} •{" "}
              {STYLE_OPTIONS.find((s) => s.id === style)?.label} •{" "}
              {DIMENSION_OPTIONS.find((d) => d.id === dimensionId)?.label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={handleRegenerate}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Re-generate
            </Button>
          </div>
        </div>

        {/* Image display */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          <img
            src={result.imageUrl}
            alt={result.filename}
            className="max-w-full max-h-full rounded-lg shadow-lg border"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top bar */}
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold text-foreground">Infographics</h2>
        <p className="text-xs text-muted-foreground">
          Configure and generate a visual summary of your sources
        </p>
      </div>

      {/* Configuration area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Filename */}
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">
            Filename
          </label>
          <input
            type="text"
            placeholder="Enter a name for the generated image..."
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full h-9 px-3 rounded-md border text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>

        {/* Image Dimensions */}
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">
            Image Dimensions
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {DIMENSION_OPTIONS.map((dim) => {
              const isActive = dimensionId === dim.id;
              return (
                <button
                  key={dim.id}
                  onClick={() => setDimensionId(dim.id)}
                  className={`relative flex flex-col items-center p-2.5 rounded-lg border text-center transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-1 right-1">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  {/* Ratio preview box */}
                  <div
                    className="border border-muted-foreground/30 rounded-sm mb-1.5 bg-muted/20"
                    style={{
                      width: `${Math.min(40, 40 * (dim.width / Math.max(dim.width, dim.height)))}px`,
                      height: `${Math.min(40, 40 * (dim.height / Math.max(dim.width, dim.height)))}px`,
                    }}
                  />
                  <span className="text-[10px] font-medium text-foreground">
                    {dim.ratio}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {dim.width}×{dim.height}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Style */}
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">
            Visual Style
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {STYLE_OPTIONS.map((s) => {
              const isActive = style === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`relative flex flex-col items-center p-3 rounded-lg border text-center transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-1 right-1">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <span className="text-lg mb-1">{s.emoji}</span>
                  <span className="text-[10px] font-semibold text-foreground">
                    {s.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                    {s.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail Level */}
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">
            Level of Detail
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DETAIL_LEVELS.map((d) => {
              const isActive = detailLevel === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDetailLevel(d.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  <div
                    className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isActive ? "border-primary" : "border-muted-foreground/30"
                    }`}
                  >
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {d.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generation progress */}
        {isGenerating && (
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/20">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">
                {stepLabels[step]}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                This may take a minute...
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {step === "error" && error && (
          <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <p className="text-xs font-medium text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 border-t flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Text model: {selectedModel} • Image model: Gemini image fallback chain
        </p>
        <Button
          size="sm"
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          )}
          {isGenerating ? "Generating..." : "Generate Infographic"}
        </Button>
      </div>
    </div>
  );
}
