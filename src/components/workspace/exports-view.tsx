"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthHeaders, API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Download,
  Trash2,
  FileText,
  FileType,
  Loader2,
  FolderOpen,
  ChevronLeft,
  Pencil,
  Check,
  X,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import type { ExportedDocument } from "@/lib/api";
import * as api from "@/lib/api";

interface DatasetGroup {
  datasetId: string | null;
  datasetName: string;
  exports: ExportedDocument[];
}

export function ExportsView() {
  const [exports, setExports] = useState<ExportedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const fetchExports = useCallback(async () => {
    try {
      const data = await api.getExports();
      setExports(data.exports);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  const groupedByDataset: DatasetGroup[] = (() => {
    const map = new Map<string, DatasetGroup>();
    for (const doc of exports) {
      const key = doc.dataset_id || "__ungrouped__";
      if (!map.has(key)) {
        map.set(key, {
          datasetId: doc.dataset_id,
          datasetName: doc.dataset_name || "Ungrouped",
          exports: [],
        });
      }
      map.get(key)!.exports.push(doc);
    }
    return Array.from(map.values());
  })();

  const activeGroup = activeDataset
    ? groupedByDataset.find(
        (g) => g.datasetId === activeDataset || (activeDataset === "__ungrouped__" && !g.datasetId)
      )
    : null;

  const downloadExport = async (doc: ExportedDocument) => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/exports/${doc.id}/download`, { headers: authHeaders });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download file");
    }
  };

  const handleDeleteExport = async (id: string) => {
    try {
      await api.deleteExport(id);
      setExports((prev) => prev.filter((e) => e.id !== id));
      toast.success("Export deleted");
    } catch {
      toast.error("Failed to delete export");
    }
  };

  const startRename = (doc: ExportedDocument) => {
    setRenamingId(doc.id);
    setRenameValue(doc.filename);
  };

  const confirmRename = async () => {
    if (!renamingId || !renameValue.trim()) return;
    try {
      setExports((prev) =>
        prev.map((e) => (e.id === renamingId ? { ...e, filename: renameValue.trim() } : e))
      );
      toast.success("File renamed");
    } catch {
      toast.error("Failed to rename file");
    } finally {
      setRenamingId(null);
      setRenameValue("");
    }
  };

  const formatIcon = (format: string) => {
    switch (format) {
      case "docx":
        return <FileText className="h-5 w-5 text-blue-500" />;
      case "pdf":
        return <FileText className="h-5 w-5 text-red-500" />;
      default:
        return <FileType className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b">
        {activeGroup ? (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-xs" onClick={() => setActiveDataset(null)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold">{activeGroup.datasetName}</h2>
              <p className="text-sm text-muted-foreground">
                {activeGroup.exports.length} exported file{activeGroup.exports.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold">Exports</h2>
            <p className="text-sm text-muted-foreground">
              Your exported documents, organized by dataset
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading exports...</span>
          </div>
        ) : exports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Download className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No exports yet</p>
            <p className="text-xs">Generate content and export it to see files here</p>
          </div>
        ) : activeGroup ? (
          /* Files list within a dataset */
          <div className="space-y-2">
            {activeGroup.exports.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {formatIcon(doc.format)}
                </div>
                <div className="flex-1 min-w-0">
                  {renamingId === doc.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename();
                          if (e.key === "Escape") {
                            setRenamingId(null);
                            setRenameValue("");
                          }
                        }}
                      />
                      <Button size="icon-xs" variant="ghost" onClick={confirmRename}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => { setRenamingId(null); setRenameValue(""); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {doc.format}
                        </Badge>
                        {doc.file_size && <span>{(doc.file_size / 1024).toFixed(0)} KB</span>}
                        <span>
                          {new Date(doc.created_at).toLocaleDateString()}{" "}
                          {new Date(doc.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => startRename(doc)} title="Rename">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadExport(doc)}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => handleDeleteExport(doc.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Dataset folder cards grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedByDataset.map((group) => {
              const formatCounts: Record<string, number> = {};
              for (const doc of group.exports) {
                formatCounts[doc.format] = (formatCounts[doc.format] || 0) + 1;
              }
              const latestDate = group.exports[0]?.created_at;

              return (
                <div
                  key={group.datasetId || "__ungrouped__"}
                  className="border rounded-xl p-5 bg-card hover:bg-muted/30 hover:border-primary/40 transition-all cursor-pointer group"
                  onClick={() => setActiveDataset(group.datasetId || "__ungrouped__")}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {group.datasetId ? (
                        <Database className="h-5 w-5 text-primary" />
                      ) : (
                        <FolderOpen className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                        {group.datasetName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {group.exports.length} file{group.exports.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.entries(formatCounts).map(([fmt, count]) => (
                      <Badge key={fmt} variant="secondary" className="text-[10px] uppercase">
                        {count} {fmt}
                      </Badge>
                    ))}
                  </div>

                  {latestDate && (
                    <p className="text-[10px] text-muted-foreground mt-3">
                      Latest: {new Date(latestDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
