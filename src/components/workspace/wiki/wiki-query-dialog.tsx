"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  MessageSquare,
  Send,
  Loader2,
  FileText,
  BookOpen,
} from "lucide-react";
import { queryWiki } from "@/lib/api";

interface WikiQueryDialogProps {
  wikiId: string;
  onClose: () => void;
  onPageCreated: () => void;
}

interface QueryResult {
  answer: string;
  cited_pages: Array<{ id: string; title: string; slug: string }>;
  filed_page: { id: string; title: string; slug: string } | null;
}

export function WikiQueryDialog({ wikiId, onClose, onPageCreated }: WikiQueryDialogProps) {
  const [question, setQuestion] = useState("");
  const [fileAsPage, setFileAsPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await queryWiki(wikiId, question.trim(), {
        file_as_page: fileAsPage,
      });
      setResult(resp);
      if (resp.filed_page) onPageCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Ask Your Wiki
          </h2>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Question input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Question</label>
            <div className="flex gap-2">
              <Input
                placeholder="Ask about your wiki content…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleQuery()}
                disabled={loading}
              />
              <Button onClick={handleQuery} disabled={!question.trim() || loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={fileAsPage}
                onChange={(e) => setFileAsPage(e.target.checked)}
                className="rounded"
              />
              Save answer as a new wiki page
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="prose-sm text-sm leading-relaxed whitespace-pre-wrap">
                {result.answer}
              </div>

              {/* Cited pages */}
              {result.cited_pages.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Sources cited:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.cited_pages.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded"
                      >
                        <BookOpen className="h-3 w-3" /> {p.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Filed page */}
              {result.filed_page && (
                <div className="bg-green-500/10 text-green-700 dark:text-green-400 text-sm rounded-md px-3 py-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Saved as wiki page: &quot;{result.filed_page.title}&quot;
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
