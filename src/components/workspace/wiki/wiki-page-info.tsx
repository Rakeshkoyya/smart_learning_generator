"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Link2,
  Tag,
  FileText,
  Sparkles,
} from "lucide-react";
import type { WikiPage, WikiTransformation } from "@/lib/types";
import { getWikiTransformations } from "@/lib/api";

interface WikiPageInfoProps {
  page: WikiPage;
  wikiId: string;
  onViewTransformation: (id: string) => void;
}

export function WikiPageInfo({ page, wikiId, onViewTransformation }: WikiPageInfoProps) {
  const [transformations, setTransformations] = useState<WikiTransformation[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const resp = await getWikiTransformations(wikiId);
        setTransformations(resp.transformations);
      } catch { /* ignore */ }
    })();
  }, [wikiId]);

  const frontmatter = page.frontmatter || {};
  const tags = (frontmatter.tags as string[]) || [];
  const outLinks = page.outbound_links || [];
  const inLinks = page.inbound_links || [];
  const createdAt = new Date(page.created_at).toLocaleDateString();
  const updatedAt = new Date(page.updated_at).toLocaleDateString();

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Page Title */}
      <div>
        <h3 className="font-semibold">{page.title}</h3>
        <Badge variant="secondary" className="text-[10px] mt-1">
          {page.page_type}
        </Badge>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <Tag className="h-3 w-3" /> Tags
          </div>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Outbound Links */}
      {outLinks.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <Link2 className="h-3 w-3" /> Links to ({outLinks.length})
          </div>
          <div className="space-y-0.5">
            {outLinks.map((link) => (
              <div key={link.id} className="text-xs text-primary truncate">
                → {link.link_text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inbound Links */}
      {inLinks.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <Link2 className="h-3 w-3" /> Linked from ({inLinks.length})
          </div>
          <div className="space-y-0.5">
            {inLinks.map((link) => (
              <div key={link.id} className="text-xs text-muted-foreground truncate">
                ← {link.link_text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div>
        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
          <Clock className="h-3 w-3" /> Dates
        </div>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <div>Created: {createdAt}</div>
          <div>Updated: {updatedAt}</div>
        </div>
      </div>

      {/* Frontmatter extras */}
      {Object.entries(frontmatter).filter(([k]) => k !== "tags").length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <FileText className="h-3 w-3" /> Metadata
          </div>
          <div className="space-y-0.5">
            {Object.entries(frontmatter)
              .filter(([k]) => k !== "tags")
              .map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-muted-foreground">{key}:</span>{" "}
                  {typeof value === "string" ? value : JSON.stringify(value)}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Related Transformations */}
      {transformations.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <Sparkles className="h-3 w-3" /> Transformations
          </div>
          <div className="space-y-1">
            {transformations.map((t) => (
              <Button
                key={t.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-7"
                onClick={() => onViewTransformation(t.id)}
              >
                <Badge variant="outline" className="text-[9px] mr-1.5">
                  {t.transformation_type}
                </Badge>
                <span className="truncate">{t.title}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
