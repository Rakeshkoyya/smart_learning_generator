"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { Wiki } from "@/lib/types";
import { ingestToWiki } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace-context";

interface WikiIngestDialogProps {
  wiki: Wiki;
  onClose: () => void;
  onComplete: () => void;
}

interface IngestStep {
  step: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

export function WikiIngestDialog({ wiki, onClose, onComplete }: WikiIngestDialogProps) {
  const { datasets } = useWorkspace();
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [ingesting, setIngesting] = useState(false);
  const [steps, setSteps] = useState<IngestStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Find the dataset linked to this wiki
  const dataset = datasets.find((d) => d.id === wiki.dataset_id);
  const sources = dataset?.input_sources || [];

  const handleIngest = async () => {
    if (!selectedSource) return;
    setIngesting(true);
    setError(null);
    setSteps([]);

    try {
      await ingestToWiki(wiki.id, selectedSource, undefined, (event) => {
        const step = event.step as string | undefined;
        const status = event.status as string | undefined;
        const detail = event.detail as string | undefined;
        const errorMsg = event.error as string | undefined;

        if (errorMsg) {
          setError(errorMsg);
          return;
        }

        if (step) {
          setSteps((prev) => {
            const existing = prev.find((s) => s.step === step);
            if (existing) {
              return prev.map((s) =>
                s.step === step
                  ? { ...s, status: (status as IngestStep["status"]) || s.status, detail: detail || s.detail }
                  : s
              );
            }
            return [
              ...prev,
              {
                step,
                status: (status as IngestStep["status"]) || "running",
                detail,
              },
            ];
          });
        }

        if (status === "complete" || event.event === "complete") {
          setDone(true);
        }
      });

      if (!error) {
        setDone(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4" /> Ingest Source into Wiki
          </h2>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Source selector */}
          {!ingesting && !done && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select a source to ingest</label>
                {sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No sources in dataset &quot;{dataset?.name}&quot;. Upload files first.
                  </p>
                ) : (
                  <select
                    className="w-full text-sm border rounded-md px-2 py-1.5 bg-background"
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                  >
                    <option value="">Choose source…</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The LLM agent will analyze the source, extract entities and concepts, and create wiki pages with cross-references.
              </p>
            </>
          )}

          {/* Progress */}
          {(ingesting || done) && (
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  {s.status === "running" && <Loader2 className="h-4 w-4 text-primary animate-spin mt-0.5" />}
                  {s.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />}
                  {s.status === "error" && <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />}
                  {s.status === "pending" && <div className="h-4 w-4 rounded-full border mt-0.5" />}
                  <div>
                    <p className="text-sm">{s.step}</p>
                    {s.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
                  </div>
                </div>
              ))}
              {ingesting && steps.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting ingestion…
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {/* Done */}
          {done && !error && (
            <div className="bg-green-500/10 text-green-700 dark:text-green-400 text-sm rounded-md px-3 py-2">
              Ingestion complete! Wiki pages have been created.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t">
          {done ? (
            <Button onClick={onComplete}>View Wiki</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={ingesting}>
                Cancel
              </Button>
              <Button
                onClick={handleIngest}
                disabled={!selectedSource || ingesting}
              >
                {ingesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ingesting…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" /> Ingest
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
