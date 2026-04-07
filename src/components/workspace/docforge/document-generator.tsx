"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Download,
  Eye,
  Loader2,
  Save,
  Search,
  FolderPlus,
  FolderOpen,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { DocForgeTemplate, DocForgeFolder } from "@/lib/api";

interface DocumentGeneratorProps {
  template: DocForgeTemplate;
  onBack: () => void;
  onGenerated: () => void;
}

export function DocumentGenerator({
  template,
  onBack,
  onGenerated,
}: DocumentGeneratorProps) {
  // Placeholder values state – initialised from defaults
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const ph of template.placeholders) {
      init[ph.name] = ph.default_value || "";
    }
    return init;
  });

  const [filename, setFilename] = useState(
    template.name.replace(/[^a-zA-Z0-9_\- ]/g, "")
  );
  const [saving, setSaving] = useState(false);

  // Folder selector
  const [folders, setFolders] = useState<DocForgeFolder[]>([]);
  const [folderSearch, setFolderSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowFolderDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch folders
  useEffect(() => {
    api.getDocForgeFolders().then((res) => setFolders(res.folders)).catch(() => {});
  }, []);

  // Filter folders by search
  const filteredFolders = useMemo(() => {
    if (!folderSearch.trim()) return folders;
    return folders.filter((f) =>
      f.name.toLowerCase().includes(folderSearch.toLowerCase())
    );
  }, [folders, folderSearch]);

  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId),
    [folders, selectedFolderId]
  );

  // ── Live HTML preview ─────────────────────────────────────────
  const previewHtml = useMemo(() => {
    if (!template.html_preview) return "";
    let html = template.html_preview;
    for (const ph of template.placeholders) {
      const marker = `{{${ph.name}}}`;
      const val = values[ph.name];
      if (val) {
        // Replace plain-text markers
        html = html.replaceAll(
          marker,
          `<span style="background:#dcfce7;border-bottom:2px solid #22c55e;font-weight:600;">${val}</span>`
        );
        // Also replace styled placeholder pills from the editor
        const pillRegex = new RegExp(
          `<span[^>]*data-name="${ph.name}"[^>]*>.*?</span>`,
          "g"
        );
        html = html.replace(
          pillRegex,
          `<span style="background:#dcfce7;border-bottom:2px solid #22c55e;font-weight:600;">${val}</span>`
        );
      }
    }
    return html;
  }, [template, values]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleValueChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSelectFolder = useCallback((folder: DocForgeFolder) => {
    setSelectedFolderId(folder.id);
    setFolderSearch(folder.name);
    setNewFolderName("");
    setShowFolderDropdown(false);
  }, []);

  const handleCreateFolder = useCallback(
    async (name: string) => {
      try {
        const folder = await api.createDocForgeFolder(name);
        setFolders((prev) => [...prev, folder]);
        setSelectedFolderId(folder.id);
        setFolderSearch(folder.name);
        setNewFolderName("");
        setShowFolderDropdown(false);
        toast.success(`Folder "${name}" created`);
      } catch {
        toast.error("Failed to create folder");
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!filename.trim()) {
      toast.error("Filename is required");
      return;
    }

    setSaving(true);
    try {
      // Determine folder
      let folderId = selectedFolderId || undefined;
      let folderName: string | undefined;

      // If user typed a name that doesn't match any existing folder, create it
      if (!folderId && folderSearch.trim()) {
        const match = folders.find(
          (f) => f.name.toLowerCase() === folderSearch.trim().toLowerCase()
        );
        if (match) {
          folderId = match.id;
        } else {
          folderName = folderSearch.trim();
        }
      }

      const doc = await api.generateDocForgeDocument({
        template_id: template.id,
        placeholder_values: values,
        filename: filename.trim(),
        folder_id: folderId,
        folder_name: folderName,
      });

      // Auto-download
      const blob = await api.downloadDocForgeDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Document generated and downloaded");
      onGenerated();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate document"
      );
    } finally {
      setSaving(false);
    }
  }, [
    filename,
    selectedFolderId,
    folderSearch,
    folders,
    template.id,
    values,
    onGenerated,
  ]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-xs" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{template.name}</h2>
            <p className="text-xs text-muted-foreground">
              {template.placeholders.length} placeholder
              {template.placeholders.length !== 1 ? "s" : ""} &middot;{" "}
              {template.original_filename}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Save &amp; Download
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Live preview */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <div className="px-4 py-2 border-b bg-muted/30 text-xs text-muted-foreground flex items-center gap-2 shrink-0">
            <Eye className="h-3.5 w-3.5" />
            Live Preview
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>

        {/* Right: Form */}
        <div className="w-96 flex flex-col shrink-0 overflow-hidden">
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Placeholder fields */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Fill Placeholders</h3>
              <div className="space-y-3">
                {template.placeholders.map((ph) => (
                  <div key={ph.name}>
                    <label className="text-xs font-medium text-muted-foreground">
                      {ph.label}
                    </label>
                    <Input
                      value={values[ph.name] || ""}
                      onChange={(e) =>
                        handleValueChange(ph.name, e.target.value)
                      }
                      placeholder={ph.default_value || ph.label}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Filename */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Output</h3>
              <label className="text-xs font-medium text-muted-foreground">
                Filename
              </label>
              <div className="flex items-center gap-1">
                <Input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="document_name"
                />
                <span className="text-xs text-muted-foreground shrink-0">
                  .docx
                </span>
              </div>
            </div>

            {/* Folder selector */}
            <div ref={dropdownRef} className="relative">
              <label className="text-xs font-medium text-muted-foreground">
                Save to folder
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  ref={folderInputRef}
                  value={folderSearch}
                  onChange={(e) => {
                    setFolderSearch(e.target.value);
                    setSelectedFolderId(null);
                    setShowFolderDropdown(true);
                  }}
                  onFocus={() => setShowFolderDropdown(true)}
                  placeholder="Search or create folder…"
                  className="pl-8"
                />
              </div>

              {showFolderDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-card border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {filteredFolders.map((f) => (
                    <button
                      key={f.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                      onClick={() => handleSelectFolder(f)}
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {f.document_count} doc{f.document_count !== 1 ? "s" : ""}
                      </span>
                      {selectedFolderId === f.id && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </button>
                  ))}

                  {/* Create new folder option */}
                  {folderSearch.trim() &&
                    !folders.some(
                      (f) =>
                        f.name.toLowerCase() ===
                        folderSearch.trim().toLowerCase()
                    ) && (
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left border-t"
                        onClick={() => handleCreateFolder(folderSearch.trim())}
                      >
                        <FolderPlus className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          Create &quot;<strong>{folderSearch.trim()}</strong>&quot;
                        </span>
                      </button>
                    )}

                  {filteredFolders.length === 0 && !folderSearch.trim() && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No folders yet. Type to create one.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
