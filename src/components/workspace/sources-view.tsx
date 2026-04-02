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
  Eye,
  Trash2,
  FolderOpen,
  Pencil,
  Check,
  ChevronLeft,
  Database,
  File,
} from "lucide-react";
import { toast } from "sonner";
import type { InputSource, Dataset } from "@/lib/types";

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  image: Image,
  excel: FileSpreadsheet,
  csv: Table,
  text: Type,
  document: FileText,
  other: File,
};

export function SourcesView() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewSource, setPreviewSource] = useState<InputSource | null>(null);

  // New dataset form
  const [showNewDataset, setShowNewDataset] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState("");
  const [newDatasetDesc, setNewDatasetDesc] = useState("");

  // Edit dataset
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [editDatasetName, setEditDatasetName] = useState("");
  const [editDatasetDesc, setEditDatasetDesc] = useState("");

  // Text input
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textName, setTextName] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await fetch("/api/datasets");
      const data = await res.json();
      if (res.ok) setDatasets(data.datasets);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) || null;

  const createDataset = async () => {
    if (!newDatasetName.trim()) return;
    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDatasetName, description: newDatasetDesc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDatasets((prev) => [data.dataset, ...prev]);
      setNewDatasetName("");
      setNewDatasetDesc("");
      setShowNewDataset(false);
      setActiveDatasetId(data.dataset.id);
      toast.success(`Dataset "${data.dataset.name}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create dataset");
    }
  };

  const updateDataset = async (id: string) => {
    if (!editDatasetName.trim()) return;
    try {
      const res = await fetch("/api/datasets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editDatasetName, description: editDatasetDesc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDatasets((prev) => prev.map((d) => (d.id === id ? data.dataset : d)));
      setEditingDatasetId(null);
      toast.success("Dataset updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update dataset");
    }
  };

  const deleteDataset = async (id: string) => {
    try {
      const res = await fetch(`/api/datasets?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setDatasets((prev) => prev.filter((d) => d.id !== id));
        if (activeDatasetId === id) setActiveDatasetId(null);
        toast.success("Dataset deleted");
      }
    } catch {
      toast.error("Failed to delete dataset");
    }
  };

  const uploadFile = useCallback(
    async (file: File, datasetId: string) => {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", file.name);
        formData.append("datasetId", datasetId);

        const res = await fetch("/api/sources", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setDatasets((prev) =>
          prev.map((d) =>
            d.id === datasetId
              ? { ...d, input_sources: [data.source, ...d.input_sources] }
              : d
          )
        );
        toast.success(`Uploaded: ${file.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to upload file");
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  const handleFiles = useCallback(
    async (files: FileList, datasetId: string) => {
      for (const file of Array.from(files)) {
        await uploadFile(file, datasetId);
      }
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0 && activeDatasetId) {
        handleFiles(e.dataTransfer.files, activeDatasetId);
      }
    },
    [handleFiles, activeDatasetId]
  );

  const addTextSource = async (datasetId: string) => {
    if (!textInput.trim()) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("text", textInput);
      formData.append("name", textName || "Text Input");
      formData.append("datasetId", datasetId);

      const res = await fetch("/api/sources", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDatasets((prev) =>
        prev.map((d) =>
          d.id === datasetId
            ? { ...d, input_sources: [data.source, ...d.input_sources] }
            : d
        )
      );
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

  const deleteSource = async (sourceId: string, datasetId: string) => {
    try {
      const res = await fetch(`/api/sources?id=${sourceId}`, { method: "DELETE" });
      if (res.ok) {
        setDatasets((prev) =>
          prev.map((d) =>
            d.id === datasetId
              ? { ...d, input_sources: d.input_sources.filter((s) => s.id !== sourceId) }
              : d
          )
        );
        if (previewSource?.id === sourceId) setPreviewSource(null);
        toast.success("File removed");
      }
    } catch {
      toast.error("Failed to remove file");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && activeDatasetId) {
            handleFiles(e.target.files, activeDatasetId);
          }
          e.target.value = "";
        }}
      />

      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        {activeDataset ? (
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setActiveDatasetId(null);
                setPreviewSource(null);
                setShowTextInput(false);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              {editingDatasetId === activeDataset.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editDatasetName}
                    onChange={(e) => setEditDatasetName(e.target.value)}
                    className="text-lg font-semibold border rounded px-2 py-1 bg-background"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updateDataset(activeDataset.id);
                      if (e.key === "Escape") setEditingDatasetId(null);
                    }}
                  />
                  <Button size="icon-xs" variant="ghost" onClick={() => updateDataset(activeDataset.id)}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="icon-xs" variant="ghost" onClick={() => setEditingDatasetId(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <h2 className="text-lg font-semibold">{activeDataset.name}</h2>
              )}
              <p className="text-sm text-muted-foreground">
                {activeDataset.input_sources.length} file{activeDataset.input_sources.length !== 1 ? "s" : ""}
                {activeDataset.description && ` · ${activeDataset.description}`}
              </p>
            </div>
            <div className="flex gap-1 ml-auto">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setEditingDatasetId(activeDataset.id);
                  setEditDatasetName(activeDataset.name);
                  setEditDatasetDesc(activeDataset.description || "");
                }}
                title="Edit dataset"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => deleteDataset(activeDataset.id)}
                title="Delete dataset"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold">Datasets</h2>
              <p className="text-sm text-muted-foreground">
                Organize your files into datasets for generation
              </p>
            </div>
            <Button size="sm" onClick={() => setShowNewDataset(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Dataset
            </Button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {activeDataset ? (
          /* ── Inside a dataset ── */
          <>
            {/* Upload + Text buttons */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />
                Upload Files
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowTextInput(!showTextInput);
                  setTextInput("");
                  setTextName("");
                }}
              >
                <Type className="h-4 w-4 mr-1" />
                Add Text
              </Button>
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
              {isUploading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Drop any files here</span>
                </div>
              )}
            </div>

            {/* Text input */}
            {showTextInput && (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
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
                  <Button
                    size="sm"
                    onClick={() => addTextSource(activeDataset.id)}
                    disabled={!textInput.trim() || isUploading}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowTextInput(false);
                      setTextInput("");
                      setTextName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Files list */}
            {activeDataset.input_sources.length > 0 ? (
              <div className="space-y-1">
                {activeDataset.input_sources.map((source) => {
                  const Icon = TYPE_ICONS[source.type] || FileText;
                  return (
                    <div
                      key={source.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors"
                    >
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{source.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {source.type}
                          </Badge>
                          {source.file_size != null && (
                            <span>{(source.file_size / 1024).toFixed(0)} KB</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {source.extracted_text && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              setPreviewSource(previewSource?.id === source.id ? null : source)
                            }
                            title="Preview text"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => deleteSource(source.id, activeDataset.id)}
                          title="Delete file"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3">
                No files yet. Upload files or add text to this dataset.
              </p>
            )}

            {/* Preview panel */}
            {previewSource && (
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Preview: {previewSource.name}</h3>
                  <Button variant="ghost" size="icon-xs" onClick={() => setPreviewSource(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto bg-muted p-3 rounded">
                  {previewSource.extracted_text?.slice(0, 3000)}
                  {(previewSource.extracted_text?.length ?? 0) > 3000 && "..."}
                </pre>
              </div>
            )}
          </>
        ) : (
          /* ── Dataset cards grid ── */
          <>
            {/* New dataset form */}
            {showNewDataset && (
              <div className="border rounded-lg p-4 space-y-3 bg-card">
                <h3 className="text-sm font-medium">Create New Dataset</h3>
                <input
                  type="text"
                  placeholder="Dataset name..."
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && createDataset()}
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newDatasetDesc}
                  onChange={(e) => setNewDatasetDesc(e.target.value)}
                  className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={createDataset} disabled={!newDatasetName.trim()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowNewDataset(false);
                      setNewDatasetName("");
                      setNewDatasetDesc("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {datasets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {datasets.map((dataset) => {
                  const fileCount = dataset.input_sources.length;
                  const typeCounts: Record<string, number> = {};
                  for (const s of dataset.input_sources) {
                    typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
                  }

                  return (
                    <div
                      key={dataset.id}
                      className="border rounded-xl p-5 bg-card hover:bg-muted/30 hover:border-primary/40 transition-all cursor-pointer group"
                      onClick={() => setActiveDatasetId(dataset.id)}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Database className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {dataset.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fileCount} file{fileCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              setEditingDatasetId(dataset.id);
                              setEditDatasetName(dataset.name);
                              setEditDatasetDesc(dataset.description || "");
                            }}
                            title="Edit dataset"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => deleteDataset(dataset.id)}
                            title="Delete dataset"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {dataset.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {dataset.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {Object.entries(typeCounts).map(([type, count]) => (
                          <Badge key={type} variant="secondary" className="text-[10px]">
                            {count} {type}
                          </Badge>
                        ))}
                      </div>

                      <p className="text-[10px] text-muted-foreground mt-3">
                        {new Date(dataset.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              !showNewDataset && (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No datasets yet</p>
                  <p className="text-xs">Create a dataset to start organizing your files</p>
                  <Button size="sm" className="mt-4" onClick={() => setShowNewDataset(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Dataset
                  </Button>
                </div>
              )
            )}

            {/* Inline edit modal for dataset (when not inside) */}
            {editingDatasetId && !activeDatasetId && (
              <div className="border rounded-lg p-4 space-y-3 bg-card">
                <h3 className="text-sm font-medium">Edit Dataset</h3>
                <input
                  type="text"
                  value={editDatasetName}
                  onChange={(e) => setEditDatasetName(e.target.value)}
                  className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateDataset(editingDatasetId);
                    if (e.key === "Escape") setEditingDatasetId(null);
                  }}
                />
                <input
                  type="text"
                  value={editDatasetDesc}
                  onChange={(e) => setEditDatasetDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateDataset(editingDatasetId)}>
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingDatasetId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
