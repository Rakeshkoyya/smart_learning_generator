"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Image,
  Table,
  FileSpreadsheet,
  Type,
  X,
  Loader2,
  Plus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type { InputSource } from "@/lib/types";

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  image: Image,
  excel: FileSpreadsheet,
  csv: Table,
  text: Type,
};

const ACCEPT_FILES =
  "application/pdf,image/*,.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

interface SourceManagerProps {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}

export function SourceManager({
  selectedIds,
  onSelectedIdsChange,
}: SourceManagerProps) {
  const [sources, setSources] = useState<InputSource[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textName, setTextName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      if (res.ok) setSources(data.sources);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", file.name);

        const res = await fetch("/api/sources", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setSources((prev) => [data.source, ...prev]);
        onSelectedIdsChange([...selectedIds, data.source.id]);
        toast.success(`Uploaded: ${file.name}`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to upload file"
        );
      } finally {
        setIsUploading(false);
      }
    },
    [selectedIds, onSelectedIdsChange]
  );

  const handleFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const addTextSource = async () => {
    if (!textInput.trim()) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("text", textInput);
      formData.append("name", textName || "Text Input");

      const res = await fetch("/api/sources", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSources((prev) => [data.source, ...prev]);
      onSelectedIdsChange([...selectedIds, data.source.id]);
      setTextInput("");
      setTextName("");
      setShowTextInput(false);
      toast.success("Text source added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add text");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteSource = async (id: string) => {
    try {
      const res = await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== id));
        onSelectedIdsChange(selectedIds.filter((sid) => sid !== id));
        toast.success("Source removed");
      }
    } catch {
      toast.error("Failed to remove source");
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Input Sources</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowTextInput(!showTextInput)}
          >
            <Type className="h-3 w-3 mr-1" />
            Text
          </Button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_FILES}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {isUploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Drop files here — PDF, Images, Excel, CSV
            </span>
          </div>
        )}
      </div>

      {/* Text input */}
      {showTextInput && (
        <div className="space-y-2 border rounded-lg p-3">
          <input
            type="text"
            placeholder="Source name (optional)"
            value={textName}
            onChange={(e) => setTextName(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1 bg-background"
          />
          <Textarea
            placeholder="Paste or type text content..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="min-h-20 text-sm"
          />
          <div className="flex gap-2">
            <Button size="xs" onClick={addTextSource} disabled={!textInput.trim() || isUploading}>
              <Plus className="h-3 w-3 mr-1" />
              Add Text
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setShowTextInput(false);
                setTextInput("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Source list */}
      {sources.length > 0 && (
        <div className="space-y-1">
          {sources.map((source) => {
            const Icon = TYPE_ICONS[source.type] || FileText;
            const isSelected = selectedIds.includes(source.id);

            return (
              <div
                key={source.id}
                className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted/50"
                }`}
                onClick={() => toggleSelect(source.id)}
              >
                <div
                  className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm truncate flex-1">{source.name}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {source.type}
                </Badge>
                {source.file_size && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {(source.file_size / 1024).toFixed(0)}KB
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSource(source.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} source{selectedIds.length > 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
