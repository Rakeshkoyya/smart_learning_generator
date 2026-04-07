"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileSignature,
  Loader2,
  Trash2,
  Clock,
  Tag,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { DocForgeTemplate } from "@/lib/api";
import { TemplateEditor } from "./template-editor";
import { DocumentGenerator } from "./document-generator";

type View = "list" | "create" | "edit" | "generate";

export function DocForgeView() {
  const [view, setView] = useState<View>("list");
  const [templates, setTemplates] = useState<DocForgeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState<DocForgeTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await api.getDocForgeTemplates();
      setTemplates(data.templates);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDeleteTemplate = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Delete this template?")) return;
      try {
        await api.deleteDocForgeTemplate(id);
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success("Template deleted");
      } catch {
        toast.error("Failed to delete template");
      }
    },
    []
  );

  const handleOpenTemplate = useCallback(
    async (t: DocForgeTemplate) => {
      // Fetch full template to ensure we have html_preview
      try {
        const full = await api.getDocForgeTemplate(t.id);
        setActiveTemplate(full);
        setView("generate");
      } catch {
        toast.error("Failed to load template");
      }
    },
    []
  );

  const handleEditTemplate = useCallback(
    async (t: DocForgeTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const full = await api.getDocForgeTemplate(t.id);
        setActiveTemplate(full);
        setView("edit");
      } catch {
        toast.error("Failed to load template");
      }
    },
    []
  );

  // ── Sub-views ──────────────────────────────────────────────────
  if (view === "create" || (view === "edit" && activeTemplate)) {
    return (
      <TemplateEditor
        existingTemplate={view === "edit" ? activeTemplate! : undefined}
        onSaved={() => {
          setView("list");
          setActiveTemplate(null);
          fetchTemplates();
        }}
        onCancel={() => {
          setView("list");
          setActiveTemplate(null);
        }}
      />
    );
  }

  if (view === "generate" && activeTemplate) {
    return (
      <DocumentGenerator
        template={activeTemplate}
        onBack={() => {
          setView("list");
          setActiveTemplate(null);
        }}
        onGenerated={() => {
          setView("list");
          setActiveTemplate(null);
        }}
      />
    );
  }

  // ── Template list ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <FileSignature className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">DocForge Templates</h2>
        </div>
        <Button size="sm" onClick={() => setView("create")}>
          <Plus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileSignature className="h-10 w-10 mx-auto mb-4 opacity-40" />
            <p className="text-sm font-medium mb-1">No templates yet</p>
            <p className="text-xs mb-4">
              Upload a DOCX document and mark placeholders to create your first template.
            </p>
            <Button size="sm" variant="outline" onClick={() => setView("create")}>
              <Plus className="h-4 w-4 mr-1" />
              Create Template
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                className="border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => handleOpenTemplate(t)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileSignature className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="font-medium text-sm truncate">{t.name}</h3>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => handleEditTemplate(t, e)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => handleDeleteTemplate(t.id, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {t.description && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {t.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">
                    <Tag className="h-3 w-3 mr-1" />
                    {t.placeholders.length} placeholder
                    {t.placeholders.length !== 1 ? "s" : ""}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Placeholder chips */}
                {t.placeholders.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.placeholders.slice(0, 4).map((ph) => (
                      <span
                        key={ph.name}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {ph.label}
                      </span>
                    ))}
                    {t.placeholders.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{t.placeholders.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
