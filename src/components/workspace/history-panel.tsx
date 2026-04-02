"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Trash2, Eye, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { Generation } from "@/lib/types";

interface HistoryPanelProps {
  onLoadGeneration: (generation: Generation) => void;
}

export function HistoryPanel({ onLoadGeneration }: HistoryPanelProps) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/generations?limit=20");
      const data = await res.json();
      if (res.ok) setGenerations(data.generations);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen, fetchHistory]);

  const deleteGeneration = async (id: string) => {
    try {
      const res = await fetch(`/api/generations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setGenerations((prev) => prev.filter((g) => g.id !== id));
        toast.success("Generation deleted");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="border-t">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" />
          History
        </div>
        <ChevronRight
          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-90" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="max-h-60 overflow-y-auto border-t">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : generations.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">
              No history yet
            </p>
          ) : (
            <div className="divide-y">
              {generations.map((gen) => (
                <div
                  key={gen.id}
                  className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/30"
                >
                  <div className="truncate flex-1 mr-2">
                    <p className="font-medium truncate">{gen.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                        className="text-[10px]"
                      >
                        {gen.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {gen.status === "completed" && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onLoadGeneration(gen)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => deleteGeneration(gen.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
