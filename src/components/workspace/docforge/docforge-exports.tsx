"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Download,
  FolderOpen,
  Loader2,
  Trash2,
  FileText,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { DocForgeFolder, DocForgeDocument } from "@/lib/api";

export function DocForgeExports() {
  const [folders, setFolders] = useState<DocForgeFolder[]>([]);
  const [documents, setDocuments] = useState<DocForgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<DocForgeFolder | null>(null);

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDocForgeFolders();
      setFolders(data.folders);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch documents for a folder
  const fetchDocuments = useCallback(async (folderId?: string) => {
    setLoading(true);
    try {
      const data = await api.getDocForgeDocuments(folderId);
      setDocuments(data.documents);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const openFolder = useCallback(
    (folder: DocForgeFolder) => {
      setActiveFolder(folder);
      fetchDocuments(folder.id);
    },
    [fetchDocuments]
  );

  const goBack = useCallback(() => {
    setActiveFolder(null);
    setDocuments([]);
    fetchFolders();
  }, [fetchFolders]);

  const handleDownload = useCallback(async (doc: DocForgeDocument) => {
    try {
      const blob = await api.downloadDocForgeDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  }, []);

  const handleDeleteDoc = useCallback(
    async (id: string) => {
      if (!confirm("Delete this document?")) return;
      try {
        await api.deleteDocForgeDocument(id);
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        toast.success("Document deleted");
      } catch {
        toast.error("Failed to delete");
      }
    },
    []
  );

  const handleDeleteFolder = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Delete this folder? Documents inside will be unlinked."))
        return;
      try {
        await api.deleteDocForgeFolder(id);
        setFolders((prev) => prev.filter((f) => f.id !== id));
        toast.success("Folder deleted");
      } catch {
        toast.error("Failed to delete folder");
      }
    },
    []
  );

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Document list inside a folder ──────────────────────────────
  if (activeFolder) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
          <Button variant="ghost" size="icon-xs" onClick={goBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <FolderOpen className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{activeFolder.name}</h3>
          <Badge variant="secondary" className="text-[10px] ml-1">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex-1 overflow-auto">
          {documents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No documents in this folder yet.
            </p>
          ) : (
            <div className="divide-y">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors"
                >
                  <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {doc.template_name && (
                        <span>Template: {doc.template_name}</span>
                      )}
                      <span>{formatSize(doc.file_size)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(doc.created_at).toLocaleDateString()}{" "}
                        {new Date(doc.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDeleteDoc(doc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Folder grid ────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-auto p-6">
      {folders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="h-10 w-10 mx-auto mb-4 opacity-40" />
          <p className="text-sm font-medium mb-1">No folders yet</p>
          <p className="text-xs">
            Folders are created when you generate documents from templates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {folders.map((f) => (
            <div
              key={f.id}
              className="border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => openFolder(f)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-amber-500" />
                  <h3 className="font-medium text-sm truncate">{f.name}</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDeleteFolder(f.id, e)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {f.document_count} document
                  {f.document_count !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(f.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
