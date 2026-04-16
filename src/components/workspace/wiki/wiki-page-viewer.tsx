"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X, Trash2, ExternalLink, ArrowLeft } from "lucide-react";
import type { WikiPage } from "@/lib/types";
import { updateWikiPage, deleteWikiPage } from "@/lib/api";

// Regex matching [[wikilink]] or [[wikilink|display text]]
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function renderMarkdown(content: string, onNavigate: (slug: string) => void) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(WIKILINK_RE);
  while ((match = regex.exec(content)) !== null) {
    // Text before the wikilink
    if (match.index > lastIndex) {
      parts.push(
        <MarkdownBlock key={`t-${lastIndex}`} text={content.slice(lastIndex, match.index)} />
      );
    }
    const slug = match[1].trim().toLowerCase().replace(/\s+/g, "-");
    const display = match[2]?.trim() || match[1].trim();
    parts.push(
      <button
        key={`w-${match.index}`}
        onClick={() => onNavigate(slug)}
        className="text-primary hover:underline font-medium inline"
        title={`Go to: ${match[1].trim()}`}
      >
        {display}
      </button>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(<MarkdownBlock key={`t-${lastIndex}`} text={content.slice(lastIndex)} />);
  }
  return parts;
}

/** Simple markdown-ish renderer — handles headings, bold, italic, lists, code blocks */
function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${codeKey++}`}
            className="bg-muted rounded-md p-3 text-xs overflow-x-auto my-2 font-mono"
          >
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.match(/^#{1,6}\s/)) {
      const level = line.match(/^(#+)/)?.[1].length || 1;
      const text = line.replace(/^#+\s/, "");
      const sizes: Record<number, string> = {
        1: "text-xl font-bold mt-4 mb-2",
        2: "text-lg font-semibold mt-3 mb-2",
        3: "text-base font-semibold mt-2 mb-1",
        4: "text-sm font-semibold mt-2 mb-1",
        5: "text-sm font-medium mt-1 mb-1",
        6: "text-xs font-medium mt-1 mb-1",
      };
      const className = sizes[level] || sizes[3];
      if (level === 1) elements.push(<h1 key={`h-${i}`} className={className}>{inlineFormat(text)}</h1>);
      else if (level === 2) elements.push(<h2 key={`h-${i}`} className={className}>{inlineFormat(text)}</h2>);
      else if (level === 3) elements.push(<h3 key={`h-${i}`} className={className}>{inlineFormat(text)}</h3>);
      else if (level === 4) elements.push(<h4 key={`h-${i}`} className={className}>{inlineFormat(text)}</h4>);
      else if (level === 5) elements.push(<h5 key={`h-${i}`} className={className}>{inlineFormat(text)}</h5>);
      else elements.push(<h6 key={`h-${i}`} className={className}>{inlineFormat(text)}</h6>);
    } else if (line.match(/^\s*[-*]\s/)) {
      elements.push(
        <li key={`li-${i}`} className="text-sm ml-4 list-disc">
          {inlineFormat(line.replace(/^\s*[-*]\s/, ""))}
        </li>
      );
    } else if (line.match(/^\s*\d+\.\s/)) {
      elements.push(
        <li key={`li-${i}`} className="text-sm ml-4 list-decimal">
          {inlineFormat(line.replace(/^\s*\d+\.\s/, ""))}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={`br-${i}`} className="h-2" />);
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={`bq-${i}`} className="border-l-2 pl-3 text-sm text-muted-foreground italic my-1">
          {inlineFormat(line.slice(2))}
        </blockquote>
      );
    } else {
      elements.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed">
          {inlineFormat(line)}
        </p>
      );
    }
  }

  return <>{elements}</>;
}

function inlineFormat(text: string): React.ReactNode {
  // Handle bold, italic, inline code
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|__(.+?)__|`(.+?)`|\*(.+?)\*|_(.+?)_)/g;
  let last = 0;
  let seg: RegExpExecArray | null;
  let key = 0;
  while ((seg = regex.exec(text)) !== null) {
    if (seg.index > last) parts.push(text.slice(last, seg.index));
    if (seg[2] || seg[3]) {
      parts.push(<strong key={key++}>{seg[2] || seg[3]}</strong>);
    } else if (seg[4]) {
      parts.push(
        <code key={key++} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
          {seg[4]}
        </code>
      );
    } else if (seg[5] || seg[6]) {
      parts.push(<em key={key++}>{seg[5] || seg[6]}</em>);
    }
    last = seg.index + seg[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

interface WikiPageViewerProps {
  page: WikiPage;
  wikiId: string;
  onNavigate: (slug: string) => void;
  onRefresh: () => void;
}

export function WikiPageViewer({ page, wikiId, onNavigate, onRefresh }: WikiPageViewerProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(page.content);

  const handleSave = async () => {
    try {
      await updateWikiPage(wikiId, page.id, { content: editContent });
      setEditing(false);
      onRefresh();
    } catch (e) {
      console.error("Failed to save page", e);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete page "${page.title}"?`)) return;
    try {
      await deleteWikiPage(wikiId, page.id);
      onRefresh();
    } catch (e) {
      console.error("Failed to delete page", e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h1 className="text-lg font-bold">{page.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-[10px]">
              {page.page_type}
            </Badge>
            <span className="text-xs text-muted-foreground">/{page.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setEditContent(page.content); setEditing(true); }}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {editing ? (
          <textarea
            className="w-full h-full min-h-100 font-mono text-sm p-4 border rounded-md bg-background resize-none"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
          />
        ) : (
          <div className="max-w-3xl mx-auto prose-sm">
            {renderMarkdown(page.content, onNavigate)}
          </div>
        )}
      </div>
    </div>
  );
}
