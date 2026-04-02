"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Plus, Save, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import type { ResponseFormat } from "@/lib/types";

interface FormatSelectorProps {
  activeFormatText: string;
  onActiveFormatTextChange: (text: string) => void;
}

export function FormatSelector({
  activeFormatText,
  onActiveFormatTextChange,
}: FormatSelectorProps) {
  const [formats, setFormats] = useState<ResponseFormat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");

  const fetchFormats = useCallback(async () => {
    try {
      const res = await fetch("/api/formats");
      const data = await res.json();
      if (res.ok) {
        setFormats(data.formats);
        // Select first default format
        if (data.formats.length > 0 && !selectedId) {
          const first = data.formats[0];
          setSelectedId(first.id);
          onActiveFormatTextChange(first.template_text);
        }
      }
    } catch {
      /* ignore */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchFormats();
  }, [fetchFormats]);

  const selectFormat = (format: ResponseFormat) => {
    setSelectedId(format.id);
    onActiveFormatTextChange(format.template_text);
    setIsOpen(false);
  };

  const saveAsNew = async () => {
    if (!saveName.trim() || !activeFormatText.trim()) return;
    try {
      const res = await fetch("/api/formats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName,
          description: saveDescription,
          template_text: activeFormatText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFormats((prev) => [...prev, data.format]);
        setSelectedId(data.format.id);
        setShowSaveDialog(false);
        setSaveName("");
        setSaveDescription("");
        toast.success("Format saved");
      }
    } catch {
      toast.error("Failed to save format");
    }
  };

  const deleteFormat = async (id: string) => {
    try {
      const res = await fetch(`/api/formats?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setFormats((prev) => prev.filter((f) => f.id !== id));
        if (selectedId === id) setSelectedId(null);
        toast.success("Format deleted");
      }
    } catch {
      toast.error("Failed to delete format");
    }
  };

  const selected = formats.find((f) => f.id === selectedId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Response Format</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <EyeOff className="h-3 w-3 mr-1" />
            ) : (
              <Eye className="h-3 w-3 mr-1" />
            )}
            {showPreview ? "Hide" : "Preview"}
          </Button>
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

      {/* Format selector */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between text-sm border rounded-md px-3 py-2 bg-background hover:bg-muted/50 transition-colors"
        >
          <div className="truncate text-left">
            <span>{selected ? selected.name : "Select a response format..."}</span>
            {selected?.description && (
              <span className="text-muted-foreground ml-2 text-xs">
                — {selected.description}
              </span>
            )}
          </div>
          <ChevronDown className="h-3 w-3 shrink-0 ml-2" />
        </button>

        {isOpen && (
          <div className="absolute z-20 top-full mt-1 w-full bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {formats.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm"
                onClick={() => selectFormat(f)}
              >
                <div className="truncate">
                  <span>{f.name}</span>
                  {f.is_default && (
                    <Badge variant="secondary" className="text-[10px] ml-2">
                      default
                    </Badge>
                  )}
                  {f.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {f.description}
                    </p>
                  )}
                </div>
                {!f.is_default && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFormat(f.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Format preview / editor */}
      {showPreview && (
        <Textarea
          value={activeFormatText}
          onChange={(e) => onActiveFormatTextChange(e.target.value)}
          className="min-h-25 text-xs font-mono"
          placeholder="Response format instructions..."
        />
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="border rounded-lg p-3 space-y-2">
          <input
            type="text"
            placeholder="Format name..."
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1 bg-background"
            autoFocus
          />
          <input
            type="text"
            placeholder="Description (optional)..."
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1 bg-background"
          />
          <div className="flex gap-2">
            <Button
              size="xs"
              onClick={saveAsNew}
              disabled={!saveName.trim() || !activeFormatText.trim()}
            >
              <Save className="h-3 w-3 mr-1" />
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
