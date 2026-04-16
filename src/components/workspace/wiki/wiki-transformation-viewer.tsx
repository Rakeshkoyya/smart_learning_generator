"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Loader2,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import type { WikiTransformation } from "@/lib/types";
import { getWikiTransformation, deleteWikiTransformation } from "@/lib/api";

interface WikiTransformationViewerProps {
  wikiId: string;
  transformationId: string;
  onClose: () => void;
}

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  pending: { variant: "secondary", label: "Pending" },
  processing: { variant: "outline", label: "Processing" },
  completed: { variant: "default", label: "Completed" },
  error: { variant: "destructive", label: "Error" },
};

export function WikiTransformationViewer({
  wikiId,
  transformationId,
  onClose,
}: WikiTransformationViewerProps) {
  const [transformation, setTransformation] = useState<WikiTransformation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const t = await getWikiTransformation(wikiId, transformationId);
        setTransformation(t);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [wikiId, transformationId]);

  const handleCopy = () => {
    if (!transformation) return;
    navigator.clipboard.writeText(transformation.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!transformation || !confirm("Delete this transformation?")) return;
    try {
      await deleteWikiTransformation(wikiId, transformationId);
      onClose();
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading transformation…
      </div>
    );
  }

  if (error || !transformation) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive text-sm">{error || "Not found"}</p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_BADGE[transformation.status] || STATUS_BADGE.pending;

  // Try to render JSON content nicely
  let renderedContent: React.ReactNode;
  try {
    const parsed = JSON.parse(transformation.content);
    renderedContent = (
      <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  } catch {
    // Plain text / markdown
    renderedContent = (
      <div className="prose-sm text-sm leading-relaxed whitespace-pre-wrap">
        {transformation.content}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h2 className="text-base font-semibold">{transformation.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-[10px]">
              {transformation.transformation_type}
            </Badge>
            <Badge variant={statusInfo.variant} className="text-[10px]">
              {statusInfo.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(transformation.created_at).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={handleDelete} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Error message */}
      {transformation.error_message && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-2">
          {transformation.error_message}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {transformation.status === "processing" ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Transformation in progress…
            </div>
          ) : transformation.status === "pending" ? (
            <div className="text-muted-foreground text-center py-8">
              Transformation is queued…
            </div>
          ) : (
            renderedContent
          )}
        </div>
      </div>
    </div>
  );
}
