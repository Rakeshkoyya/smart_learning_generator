"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Tag,
  Trash2,
  Save,
  X,
  FileText,
  Loader2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { DocForgePlaceholder, DocForgeTemplate } from "@/lib/api";

interface TemplateEditorProps {
  onSaved: () => void;
  onCancel: () => void;
  existingTemplate?: DocForgeTemplate;
}

function injectPlaceholderPills(html: string, placeholders: DocForgePlaceholder[]): string {
  let result = html;
  for (const ph of placeholders) {
    result = result.replace(
      `{{${ph.name}}}`,
      `<span class="docforge-placeholder" data-name="${ph.name}" style="background:#dbeafe;border:1px solid #93c5fd;border-radius:4px;padding:1px 6px;font-weight:600;color:#1d4ed8;">{{${ph.name}}}</span>`
    );
  }
  return result;
}

export function TemplateEditor({ onSaved, onCancel, existingTemplate }: TemplateEditorProps) {
  const isEditMode = !!existingTemplate;
  const [file, setFile] = useState<File | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>(
    existingTemplate?.html_preview
      ? injectPlaceholderPills(existingTemplate.html_preview, existingTemplate.placeholders)
      : ""
  );
  const [placeholders, setPlaceholders] = useState<DocForgePlaceholder[]>(existingTemplate?.placeholders ?? []);
  const [templateName, setTemplateName] = useState(existingTemplate?.name ?? "");
  const [templateDescription, setTemplateDescription] = useState(existingTemplate?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  // Placeholder creation dialog state
  const [showPlaceholderDialog, setShowPlaceholderDialog] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [placeholderName, setPlaceholderName] = useState("");
  const [placeholderLabel, setPlaceholderLabel] = useState("");
  const [placeholderDefault, setPlaceholderDefault] = useState("");

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const COMMON_FIELDS = [
    "full_name",
    "first_name",
    "last_name",
    "date",
    "address",
    "city",
    "email",
    "phone",
    "company",
    "position",
    "amount",
    "reference_number",
  ];

  // ── File handling ─────────────────────────────────────────────
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".docx")) {
      toast.error("Only .docx files are supported");
      return;
    }
    setFile(selectedFile);
    setConverting(true);

    try {
      // Use mammoth in browser to convert DOCX → HTML
      const mammoth = await import("mammoth");
      const arrayBuffer = await selectedFile.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setHtmlContent(result.value);
      if (!templateName) {
        setTemplateName(selectedFile.name.replace(/\.docx$/i, ""));
      }
    } catch {
      toast.error("Failed to parse the DOCX file");
    } finally {
      setConverting(false);
    }
  }, [templateName]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  // ── Text selection → placeholder marking ──────────────────────
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    // Only consider selections inside the preview area
    if (
      previewRef.current &&
      !previewRef.current.contains(selection.anchorNode)
    )
      return;

    setSelectedText(text);
    // Generate a sensible default name from the text
    const slug = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 30);
    setPlaceholderName(slug);
    setPlaceholderLabel(text.slice(0, 50));
    setPlaceholderDefault(text);
    setShowPlaceholderDialog(true);
  }, []);

  const confirmPlaceholder = useCallback(() => {
    if (!placeholderName.trim()) {
      toast.error("Placeholder name is required");
      return;
    }

    // Check for duplicate names
    if (placeholders.some((p) => p.name === placeholderName.trim())) {
      toast.error("A placeholder with this name already exists");
      return;
    }

    const ph: DocForgePlaceholder = {
      name: placeholderName.trim(),
      label: placeholderLabel.trim() || placeholderName.trim(),
      original_text: selectedText,
      default_value: placeholderDefault,
    };

    setPlaceholders((prev) => [...prev, ph]);

    // Replace in HTML preview with a styled pill
    setHtmlContent((prev) =>
      prev.replace(
        selectedText,
        `<span class="docforge-placeholder" data-name="${ph.name}" style="background:#dbeafe;border:1px solid #93c5fd;border-radius:4px;padding:1px 6px;font-weight:600;color:#1d4ed8;">{{${ph.name}}}</span>`
      )
    );

    // Clean up
    setShowPlaceholderDialog(false);
    setSelectedText("");
    setPlaceholderName("");
    setPlaceholderLabel("");
    setPlaceholderDefault("");
    window.getSelection()?.removeAllRanges();
  }, [placeholderName, placeholderLabel, placeholderDefault, selectedText, placeholders]);

  const removePlaceholder = useCallback(
    (index: number) => {
      const ph = placeholders[index];
      // Restore original text in HTML
      const marker = new RegExp(
        `<span[^>]*data-name="${ph.name}"[^>]*>.*?</span>`,
        "g"
      );
      setHtmlContent((prev) => prev.replace(marker, ph.original_text));
      setPlaceholders((prev) => prev.filter((_, i) => i !== index));
    },
    [placeholders]
  );

  // ── Save template ─────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!isEditMode && !file) {
      toast.error("Please upload a DOCX file first");
      return;
    }
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && existingTemplate) {
        await api.updateDocForgeTemplate(existingTemplate.id, {
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          placeholders,
          ...(file ? { file } : {}),
        });
        toast.success("Template updated successfully");
      } else {
        await api.uploadDocForgeTemplate(
          file!,
          templateName.trim(),
          templateDescription.trim() || null,
          placeholders
        );
        toast.success("Template saved successfully");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }, [file, templateName, templateDescription, placeholders, onSaved, isEditMode, existingTemplate]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{isEditMode ? "Edit Template" : "Create Template"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || (!isEditMode && !file) || !templateName.trim()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Template
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document preview */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          {/* Template name + description */}
          <div className="px-4 py-3 border-b space-y-2 shrink-0">
            <Input
              placeholder="Template name *"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
            />
          </div>

          {!htmlContent ? (
            /* Upload zone */
            <div
              className="flex-1 flex items-center justify-center p-8"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors w-full max-w-md"
                onClick={() => fileInputRef.current?.click()}
              >
                {converting ? (
                  <Loader2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                )}
                <p className="text-sm font-medium mb-1">
                  {converting ? "Converting…" : "Drop a DOCX file or click to upload"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Upload a complete example document to turn into a template
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>
            </div>
          ) : (
            /* HTML preview */
            <div className="flex-1 overflow-auto">
              <div className="px-4 py-2 bg-muted/30 border-b text-xs text-muted-foreground shrink-0 flex items-center justify-between">
                <span>Select text in the document below, then click &quot;Mark as Placeholder&quot;</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {isEditMode && !file ? "Re-upload DOCX" : "Replace DOCX"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>
              <div
                ref={previewRef}
                className="p-6 prose prose-sm max-w-none"
                onMouseUp={handleMouseUp}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          )}
        </div>

        {/* Right: Placeholder sidebar */}
        <div className="w-80 flex flex-col shrink-0 bg-muted/20">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Placeholders ({placeholders.length})
            </h3>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2">
            {placeholders.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                No placeholders yet. Select text in the document to mark fields.
              </p>
            )}
            {placeholders.map((ph, idx) => (
              <div
                key={ph.name}
                className="border rounded-lg p-3 bg-card text-sm space-y-1"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {"{{"}
                    {ph.name}
                    {"}}"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removePlaceholder(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  Label: {ph.label}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Original: &quot;{ph.original_text}&quot;
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating placeholder creation dialog */}
      {showPlaceholderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border rounded-xl shadow-lg p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold">Mark as Placeholder</h3>
            <p className="text-sm text-muted-foreground">
              Selected text: &quot;{selectedText.slice(0, 80)}
              {selectedText.length > 80 ? "…" : ""}&quot;
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">
                  Placeholder name (used in {"{{…}}"} markers)
                </label>
                <Input
                  value={placeholderName}
                  onChange={(e) =>
                    setPlaceholderName(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_")
                    )
                  }
                  placeholder="e.g. full_name"
                />
                {/* Common suggestions */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMMON_FIELDS.filter(
                    (f) => !placeholders.some((p) => p.name === f)
                  )
                    .slice(0, 6)
                    .map((f) => (
                      <button
                        key={f}
                        className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-muted transition-colors"
                        onClick={() => {
                          setPlaceholderName(f);
                          setPlaceholderLabel(
                            f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                          );
                        }}
                      >
                        {f}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Display label</label>
                <Input
                  value={placeholderLabel}
                  onChange={(e) => setPlaceholderLabel(e.target.value)}
                  placeholder="e.g. Full Name"
                />
              </div>

              <div>
                <label className="text-xs font-medium">Default value</label>
                <Input
                  value={placeholderDefault}
                  onChange={(e) => setPlaceholderDefault(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPlaceholderDialog(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={confirmPlaceholder}>
                <Tag className="h-4 w-4 mr-1" />
                Mark Placeholder
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
