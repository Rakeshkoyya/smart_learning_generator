"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { WikiTransformationType } from "@/lib/types";
import { transformWiki } from "@/lib/api";

interface WikiTransformDialogProps {
  wikiId: string;
  onClose: () => void;
  onComplete: (transformationId: string) => void;
}

const TRANSFORM_OPTIONS: {
  type: WikiTransformationType;
  label: string;
  description: string;
}[] = [
  { type: "concept_map", label: "Concept Map", description: "Visual concept relationships as nodes and edges" },
  { type: "qa_exercises", label: "Q&A Exercises", description: "Questions and answers for learning" },
  { type: "story", label: "Story", description: "Transform content into a narrative story" },
  { type: "podcast_transcript", label: "Podcast Transcript", description: "Conversational podcast format" },
  { type: "video_script", label: "Video Script", description: "Script with scenes and narration" },
  { type: "flashcards", label: "Flashcards", description: "Front/back flashcard pairs" },
  { type: "quiz", label: "Quiz", description: "Multiple choice quiz with answers" },
  { type: "slide_deck", label: "Slide Deck", description: "Marp-compatible presentation slides" },
  { type: "mind_map", label: "Mind Map", description: "Hierarchical mind map structure" },
  { type: "character_story", label: "Character Story", description: "Story with characters explaining concepts" },
  { type: "advanced_summary", label: "Advanced Summary", description: "Structured executive summary" },
  { type: "comparison_table", label: "Comparison Table", description: "Side-by-side comparison" },
];

export function WikiTransformDialog({ wikiId, onClose, onComplete }: WikiTransformDialogProps) {
  const [selectedType, setSelectedType] = useState<WikiTransformationType | null>(null);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<"all" | "query">("all");
  const [scopeQuery, setScopeQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTransform = async () => {
    if (!selectedType) return;
    setLoading(true);
    setError(null);

    try {
      const scopeObj: Record<string, unknown> = {};
      if (scope === "query" && scopeQuery.trim()) {
        scopeObj.query = scopeQuery.trim();
      }

      const result = await transformWiki(wikiId, {
        transformation_type: selectedType,
        title: title.trim() || undefined,
        scope: Object.keys(scopeObj).length > 0 ? scopeObj : undefined,
      });
      onComplete(result.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transform failed");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Transform Wiki Content
          </h2>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Type grid */}
          <div>
            <label className="text-sm font-medium mb-2 block">Transformation type</label>
            <div className="grid grid-cols-2 gap-2">
              {TRANSFORM_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => setSelectedType(opt.type)}
                  className={`text-left p-2.5 rounded-md border text-xs transition-colors ${
                    selectedType === opt.type
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-muted-foreground mt-0.5">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          {selectedType && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Title (optional)</label>
                <Input
                  placeholder={`${TRANSFORM_OPTIONS.find((o) => o.type === selectedType)?.label || ""} output`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Scope */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Scope</label>
                <div className="flex gap-2">
                  <Button
                    variant={scope === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScope("all")}
                  >
                    All pages
                  </Button>
                  <Button
                    variant={scope === "query" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScope("query")}
                  >
                    By search query
                  </Button>
                </div>
                {scope === "query" && (
                  <Input
                    placeholder="Search query to filter pages…"
                    value={scopeQuery}
                    onChange={(e) => setScopeQuery(e.target.value)}
                  />
                )}
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleTransform} disabled={!selectedType || loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Transforming…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" /> Transform
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
