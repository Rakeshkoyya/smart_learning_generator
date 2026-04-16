"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Search,
  Plus,
  RefreshCw,
  FileText,
  Lightbulb,
  BookMarked,
  Layers,
  BarChart3,
  GitCompare,
  Upload,
  MessageSquare,
  Wrench,
  Sparkles,
  Network,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import type { Wiki, WikiPage, WikiPageType } from "@/lib/types";
import { getWikis, getWikiPages, createWiki } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace-context";
import { WikiPageViewer } from "./wiki-page-viewer";
import { WikiGraphView } from "./wiki-graph-view";
import { WikiIngestDialog } from "./wiki-ingest-dialog";
import { WikiQueryDialog } from "./wiki-query-dialog";
import { WikiTransformDialog } from "./wiki-transform-dialog";
import { WikiLintReport } from "./wiki-lint-report";
import { WikiTransformationViewer } from "./wiki-transformation-viewer";
import { WikiPageInfo } from "./wiki-page-info";

type ViewMode = "page" | "graph" | "lint" | "transformation";

const PAGE_TYPE_ICONS: Record<string, React.ElementType> = {
  entity: Lightbulb,
  concept: BookMarked,
  source_summary: FileText,
  topic_summary: Layers,
  comparison: GitCompare,
  analysis: BarChart3,
  index: BookOpen,
  overview: BookOpen,
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  overview: "Overview",
  source_summary: "Source Summaries",
  entity: "Entities",
  concept: "Concepts",
  topic_summary: "Topic Summaries",
  comparison: "Comparisons",
  analysis: "Analyses",
  index: "Index",
};

const PAGE_TYPE_ORDER: WikiPageType[] = [
  "index",
  "overview",
  "source_summary",
  "entity",
  "concept",
  "topic_summary",
  "comparison",
  "analysis",
];

export function WikiView() {
  const { datasets } = useWorkspace();
  const [wikis, setWikis] = useState<Wiki[]>([]);
  const [selectedWiki, setSelectedWiki] = useState<Wiki | null>(null);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("page");
  const [loading, setLoading] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(PAGE_TYPE_ORDER));

  // Creation flow state
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [newWikiName, setNewWikiName] = useState("");
  const [creating, setCreating] = useState(false);

  // Dialogs
  const [showIngest, setShowIngest] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [showTransform, setShowTransform] = useState(false);
  const [showLint, setShowLint] = useState(false);
  const [selectedTransformationId, setSelectedTransformationId] = useState<string | null>(null);

  const loadWikis = useCallback(async () => {
    try {
      const resp = await getWikis();
      setWikis(resp.wikis);
      if (resp.wikis.length > 0 && !selectedWiki) {
        setSelectedWiki(resp.wikis[0]);
      }
    } catch (e) {
      console.error("Failed to load wikis", e);
    }
  }, [selectedWiki]);

  const loadPages = useCallback(async () => {
    if (!selectedWiki) return;
    setLoading(true);
    try {
      const opts: { q?: string } = {};
      if (searchQuery.trim()) opts.q = searchQuery.trim();
      const resp = await getWikiPages(selectedWiki.id, opts);
      setPages(resp.pages);
    } catch (e) {
      console.error("Failed to load pages", e);
    } finally {
      setLoading(false);
    }
  }, [selectedWiki, searchQuery]);

  useEffect(() => {
    loadWikis();
  }, []);

  useEffect(() => {
    if (selectedWiki) loadPages();
  }, [selectedWiki, loadPages]);

  // Datasets that don't already have a wiki
  const availableDatasets = datasets.filter(
    (ds) => !wikis.some((w) => w.dataset_id === ds.id)
  );
  const selectedDataset = datasets.find((ds) => ds.id === selectedDatasetId);

  const resetCreateFlow = () => {
    setShowCreateFlow(false);
    setCreateStep(1);
    setSelectedDatasetId("");
    setNewWikiName("");
    setCreating(false);
  };

  const handleCreateWiki = async () => {
    if (!selectedDatasetId || !newWikiName.trim()) return;
    setCreating(true);
    try {
      const wiki = await createWiki({
        dataset_id: selectedDatasetId,
        name: newWikiName.trim(),
      });
      setWikis((prev) => [wiki, ...prev]);
      setSelectedWiki(wiki);
      resetCreateFlow();
      // Auto-open ingest dialog so user can start ingesting sources
      setShowIngest(true);
    } catch (e) {
      console.error("Failed to create wiki", e);
    } finally {
      setCreating(false);
    }
  };

  const groupedPages = PAGE_TYPE_ORDER.reduce<Record<string, WikiPage[]>>((acc, type) => {
    const group = pages.filter((p) => p.page_type === type);
    if (group.length > 0) acc[type] = group;
    return acc;
  }, {});

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="h-full flex">
      {/* ── Left Nav (20%) ── */}
      <div className="w-1/5 min-w-60 border-r flex flex-col bg-card">
        {/* Wiki selector */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Wiki
            </h2>
            <div className="flex items-center gap-0.5">
              {availableDatasets.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setShowCreateFlow(true);
                    setCreateStep(1);
                  }}
                  title="New Wiki"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon-xs" onClick={loadWikis}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {wikis.length > 0 && (
            <select
              className="w-full text-sm border rounded-md px-2 py-1.5 bg-background"
              value={selectedWiki?.id || ""}
              onChange={(e) => {
                const w = wikis.find((w) => w.id === e.target.value);
                setSelectedWiki(w || null);
                setSelectedPage(null);
                setShowCreateFlow(false);
              }}
            >
              <option value="">Select wiki…</option>
              {wikis.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Search */}
        {selectedWiki && (
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search pages…"
                className="pl-7 h-8 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadPages()}
              />
            </div>
          </div>
        )}

        {/* Page tree */}
        {selectedWiki && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
            ) : Object.keys(groupedPages).length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Wiki is empty</p>
                <p className="text-xs text-muted-foreground">
                  Ingest a source to build your wiki
                </p>
              </div>
            ) : (
              Object.entries(groupedPages).map(([type, typePages]) => {
                const Icon = PAGE_TYPE_ICONS[type] || FileText;
                const isExpanded = expandedTypes.has(type);
                return (
                  <div key={type}>
                    <button
                      onClick={() => toggleType(type)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded"
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <Icon className="h-3 w-3" />
                      {PAGE_TYPE_LABELS[type] || type} ({typePages.length})
                    </button>
                    {isExpanded && (
                      <div className="ml-5 space-y-0.5">
                        {typePages.map((page) => (
                          <button
                            key={page.id}
                            onClick={() => {
                              setSelectedPage(page);
                              setViewMode("page");
                            }}
                            className={`w-full text-left text-xs px-2 py-1 rounded truncate transition-colors ${
                              selectedPage?.id === page.id
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            }`}
                          >
                            {page.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Quick actions */}
        {selectedWiki && (
          <div className="border-t p-2 space-y-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setShowIngest(true)}
            >
              <Upload className="h-3.5 w-3.5 mr-2" /> Ingest Source
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setShowQuery(true)}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-2" /> Ask Question
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setShowTransform(true)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-2" /> Transform
            </Button>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => {
                  setShowLint(true);
                  setViewMode("lint");
                }}
              >
                <Wrench className="h-3.5 w-3.5 mr-1" /> Lint
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setViewMode("graph")}
              >
                <Network className="h-3.5 w-3.5 mr-1" /> Graph
              </Button>
            </div>
            {/* Stats */}
            <div className="flex gap-2 px-1 pt-1 text-[10px] text-muted-foreground">
              <span>{selectedWiki.stats.page_count ?? 0} pages</span>
              <span>{selectedWiki.stats.link_count ?? 0} links</span>
              <span>{selectedWiki.stats.source_count ?? 0} sources</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Center Content (60%) ── */}
      <div className="flex-1 overflow-hidden">
        {showCreateFlow ? (
          /* ── Create Wiki Flow ── */
          <div className="h-full flex items-center justify-center">
            <div className="w-full max-w-md p-6 space-y-6">
              <div className="text-center space-y-1">
                <BookOpen className="h-10 w-10 text-primary mx-auto" />
                <h2 className="text-lg font-semibold">Create New Wiki</h2>
                <p className="text-sm text-muted-foreground">
                  Build a knowledge wiki from a dataset&apos;s sources
                </p>
              </div>

              {/* Step indicators */}
              <div className="flex items-center justify-center gap-2 text-xs">
                {[
                  { n: 1, label: "Select Dataset" },
                  { n: 2, label: "Name Wiki" },
                  { n: 3, label: "Confirm" },
                ].map(({ n, label }) => (
                  <div key={n} className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        createStep >= n
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {n}
                    </div>
                    <span className={createStep >= n ? "font-medium" : "text-muted-foreground"}>
                      {label}
                    </span>
                    {n < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>

              {/* Step 1: Select Dataset */}
              {createStep === 1 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Choose a dataset</label>
                  {availableDatasets.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      All datasets already have a wiki. Create a new dataset first.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {availableDatasets.map((ds) => (
                        <button
                          key={ds.id}
                          onClick={() => {
                            setSelectedDatasetId(ds.id);
                            setNewWikiName(`${ds.name} Wiki`);
                            setCreateStep(2);
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedDatasetId === ds.id
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted"
                          }`}
                        >
                          <div className="font-medium text-sm">{ds.name}</div>
                          {ds.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {ds.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {ds.sources_count ?? ds.input_sources?.length ?? 0} source(s)
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={resetCreateFlow}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Name Wiki */}
              {createStep === 2 && selectedDataset && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground px-3 py-2 bg-muted rounded-md">
                    Dataset: <span className="font-medium text-foreground">{selectedDataset.name}</span>
                    {" · "}
                    {selectedDataset.sources_count ?? selectedDataset.input_sources?.length ?? 0} source(s)
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Wiki name</label>
                    <Input
                      value={newWikiName}
                      onChange={(e) => setNewWikiName(e.target.value)}
                      placeholder="Enter a name for your wiki…"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newWikiName.trim()) setCreateStep(3);
                      }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setCreateStep(1)}>
                      Back
                    </Button>
                    <Button
                      size="sm"
                      disabled={!newWikiName.trim()}
                      onClick={() => setCreateStep(3)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm & Create */}
              {createStep === 3 && selectedDataset && (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Wiki name</span>
                      <span className="font-medium">{newWikiName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dataset</span>
                      <span className="font-medium">{selectedDataset.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sources</span>
                      <span className="font-medium">
                        {selectedDataset.sources_count ?? selectedDataset.input_sources?.length ?? 0}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    After creating, you&apos;ll be prompted to ingest sources into the wiki.
                  </p>
                  <div className="flex justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setCreateStep(2)}>
                      Back
                    </Button>
                    <Button size="sm" onClick={handleCreateWiki} disabled={creating}>
                      {creating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Creating…
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Create Wiki
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : !selectedWiki ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <BookOpen className="h-12 w-12 mx-auto" />
              <p className="font-medium">Select or create a wiki to get started</p>
              {availableDatasets.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateFlow(true);
                    setCreateStep(1);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Wiki from Dataset
                </Button>
              )}
            </div>
          </div>
        ) : viewMode === "graph" ? (
          <WikiGraphView wikiId={selectedWiki.id} onSelectPage={(page: WikiPage) => {
            setSelectedPage(page);
            setViewMode("page");
          }} />
        ) : viewMode === "lint" ? (
          <WikiLintReport wikiId={selectedWiki.id} onClose={() => setViewMode("page")} />
        ) : viewMode === "transformation" && selectedTransformationId ? (
          <WikiTransformationViewer
            wikiId={selectedWiki.id}
            transformationId={selectedTransformationId}
            onClose={() => setViewMode("page")}
          />
        ) : selectedPage ? (
          <WikiPageViewer
            page={selectedPage}
            wikiId={selectedWiki.id}
            onNavigate={(slug: string) => {
              const target = pages.find((p) => p.slug === slug);
              if (target) setSelectedPage(target);
            }}
            onRefresh={loadPages}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <FileText className="h-8 w-8 mx-auto" />
              <p className="text-sm">Select a page from the left panel</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Info Panel (20%) ── */}
      <div className="w-1/5 min-w-55 border-l bg-card overflow-y-auto">
        {selectedWiki && selectedPage && viewMode === "page" ? (
          <WikiPageInfo
            page={selectedPage}
            wikiId={selectedWiki.id}
            onViewTransformation={(id: string) => {
              setSelectedTransformationId(id);
              setViewMode("transformation");
            }}
          />
        ) : selectedWiki ? (
          <div className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">{selectedWiki.name}</h3>
            {selectedWiki.description && (
              <p className="text-xs text-muted-foreground">{selectedWiki.description}</p>
            )}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pages</span>
                <span>{selectedWiki.stats.page_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Links</span>
                <span>{selectedWiki.stats.link_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sources ingested</span>
                <span>{selectedWiki.stats.source_count ?? 0}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Dialogs ── */}
      {showIngest && selectedWiki && (
        <WikiIngestDialog
          wiki={selectedWiki}
          onClose={() => setShowIngest(false)}
          onComplete={() => {
            setShowIngest(false);
            loadPages();
            loadWikis();
          }}
        />
      )}
      {showQuery && selectedWiki && (
        <WikiQueryDialog
          wikiId={selectedWiki.id}
          onClose={() => setShowQuery(false)}
          onPageCreated={() => loadPages()}
        />
      )}
      {showTransform && selectedWiki && (
        <WikiTransformDialog
          wikiId={selectedWiki.id}
          onClose={() => setShowTransform(false)}
          onComplete={(id: string) => {
            setShowTransform(false);
            setSelectedTransformationId(id);
            setViewMode("transformation");
          }}
        />
      )}
    </div>
  );
}
