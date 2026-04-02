"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Trash2, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import type { SavedPrompt } from "@/lib/types";

interface PromptEditorProps {
  activePromptText: string;
  onActivePromptTextChange: (text: string) => void;
}

export function PromptEditor({
  activePromptText,
  onActivePromptTextChange,
}: PromptEditorProps) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch("/api/prompts");
      const data = await res.json();
      if (res.ok) setPrompts(data.prompts);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const selectPrompt = (prompt: SavedPrompt) => {
    setSelectedId(prompt.id);
    onActivePromptTextChange(prompt.text);
    setIsOpen(false);
  };

  const saveAsNew = async () => {
    if (!saveName.trim() || !activePromptText.trim()) return;
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName, text: activePromptText }),
      });
      const data = await res.json();
      if (res.ok) {
        setPrompts((prev) => [...prev, data.prompt]);
        setSelectedId(data.prompt.id);
        setShowSaveDialog(false);
        setSaveName("");
        toast.success("Prompt saved");
      }
    } catch {
      toast.error("Failed to save prompt");
    }
  };

  const updateExisting = async () => {
    if (!selectedId) return;
    const selected = prompts.find((p) => p.id === selectedId);
    if (!selected || selected.is_default) return;

    try {
      const res = await fetch("/api/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, text: activePromptText }),
      });
      if (res.ok) {
        setPrompts((prev) =>
          prev.map((p) =>
            p.id === selectedId ? { ...p, text: activePromptText } : p
          )
        );
        toast.success("Prompt updated");
      }
    } catch {
      toast.error("Failed to update prompt");
    }
  };

  const deletePrompt = async (id: string) => {
    try {
      const res = await fetch(`/api/prompts?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setPrompts((prev) => prev.filter((p) => p.id !== id));
        if (selectedId === id) setSelectedId(null);
        toast.success("Prompt deleted");
      }
    } catch {
      toast.error("Failed to delete prompt");
    }
  };

  const selected = prompts.find((p) => p.id === selectedId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Prompt</h3>
        <div className="flex gap-1">
          {selected && !selected.is_default && (
            <Button variant="ghost" size="xs" onClick={updateExisting}>
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowSaveDialog(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Save As
          </Button>
        </div>
      </div>

      {/* Prompt selector dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between text-sm border rounded-md px-3 py-2 bg-background hover:bg-muted/50 transition-colors"
        >
          <span className="truncate text-left">
            {selected ? selected.name : "Select a prompt template..."}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 ml-2" />
        </button>

        {isOpen && (
          <div className="absolute z-20 top-full mt-1 w-full bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {prompts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm"
                onClick={() => selectPrompt(p)}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate">{p.name}</span>
                  {p.is_default && (
                    <Badge variant="secondary" className="text-[10px]">
                      default
                    </Badge>
                  )}
                </div>
                {!p.is_default && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePrompt(p.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {prompts.length === 0 && (
              <p className="text-sm text-muted-foreground p-3">
                No prompts available
              </p>
            )}
          </div>
        )}
      </div>

      {/* Prompt text editor */}
      <Textarea
        placeholder="Write your prompt here or select a template above..."
        value={activePromptText}
        onChange={(e) => onActivePromptTextChange(e.target.value)}
        className="min-h-30 text-sm"
      />

      {/* Save as dialog */}
      {showSaveDialog && (
        <div className="border rounded-lg p-3 space-y-2">
          <input
            type="text"
            placeholder="Prompt template name..."
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1 bg-background"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="xs"
              onClick={saveAsNew}
              disabled={!saveName.trim() || !activePromptText.trim()}
            >
              Save
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setShowSaveDialog(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
