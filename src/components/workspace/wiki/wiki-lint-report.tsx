"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Wrench,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { WikiLintReport as WikiLintReportType, WikiLintIssue } from "@/lib/types";
import { lintWiki } from "@/lib/api";

interface WikiLintReportProps {
  wikiId: string;
  onClose: () => void;
}

const SEVERITY_ICON: Record<string, React.ElementType> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOR: Record<string, string> = {
  error: "text-destructive",
  warning: "text-yellow-600 dark:text-yellow-500",
  info: "text-blue-600 dark:text-blue-400",
};

export function WikiLintReport({ wikiId, onClose }: WikiLintReportProps) {
  const [report, setReport] = useState<WikiLintReportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const resp = await lintWiki(wikiId);
        setReport(resp);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Lint failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [wikiId]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4" /> Wiki Lint Report
        </h2>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Running lint check…
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {report && (
          <>
            {/* Summary stats */}
            <div className="flex gap-4 text-sm">
              <div className="bg-muted rounded-md px-3 py-2">
                <div className="font-semibold">{report.page_count}</div>
                <div className="text-xs text-muted-foreground">Pages</div>
              </div>
              <div className="bg-muted rounded-md px-3 py-2">
                <div className="font-semibold">{report.link_count}</div>
                <div className="text-xs text-muted-foreground">Links</div>
              </div>
              <div className="bg-muted rounded-md px-3 py-2">
                <div className="font-semibold">{report.orphan_count}</div>
                <div className="text-xs text-muted-foreground">Orphans</div>
              </div>
              <div className="bg-muted rounded-md px-3 py-2">
                <div className="font-semibold">{report.issues.length}</div>
                <div className="text-xs text-muted-foreground">Issues</div>
              </div>
            </div>

            {/* Summary text */}
            <p className="text-sm text-muted-foreground">{report.summary}</p>

            {/* Issues */}
            {report.issues.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 py-4">
                <CheckCircle2 className="h-5 w-5" /> No issues found. Wiki is in good shape!
              </div>
            ) : (
              <div className="space-y-2">
                {report.issues.map((issue, i) => {
                  const Icon = SEVERITY_ICON[issue.severity] || Info;
                  const color = SEVERITY_COLOR[issue.severity] || "";
                  return (
                    <div
                      key={i}
                      className="border rounded-md p-3 space-y-1"
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{issue.message}</span>
                            <Badge variant="outline" className="text-[9px]">
                              {issue.type}
                            </Badge>
                          </div>
                          {issue.page_title && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Page: {issue.page_title}
                            </p>
                          )}
                          {issue.suggestion && (
                            <p className="text-xs mt-1 text-primary">
                              Suggestion: {issue.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
