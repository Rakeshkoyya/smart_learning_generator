"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FolderPlus,
  FilePlus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Save,
  X,
  Pencil,
  Link2,
  Unlink,
  Folder,
  GitBranch,
  Plus,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import type { PromptFolder, SavedPrompt, ResponseFormat, PromptChain } from "@/lib/types";

type PromptsTab = "prompts" | "chains";

export function PromptsView() {
  const [activeTab, setActiveTab] = useState<PromptsTab>("prompts");
  const [folders, setFolders] = useState<PromptFolder[]>([]);
  const [formats, setFormats] = useState<ResponseFormat[]>([]);
  const [allPrompts, setAllPrompts] = useState<SavedPrompt[]>([]);
  const [chains, setChains] = useState<PromptChain[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedPrompt, setSelectedPrompt] = useState<SavedPrompt | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");
  const [editFormatId, setEditFormatId] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewPrompt, setShowNewPrompt] = useState(false);
  const [newPromptFolderId, setNewPromptFolderId] = useState<string>("");
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [newPromptFormatId, setNewPromptFormatId] = useState<string>("");

  // Chain state
  const [selectedChain, setSelectedChain] = useState<PromptChain | null>(null);
  const [showNewChain, setShowNewChain] = useState(false);
  const [newChainName, setNewChainName] = useState("");
  const [newChainSteps, setNewChainSteps] = useState<{ prompt_id: string }[]>([]);
  const [editChainMode, setEditChainMode] = useState(false);
  const [editChainName, setEditChainName] = useState("");
  const [editChainSteps, setEditChainSteps] = useState<{ prompt_id: string }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [foldersRes, formatsRes, promptsRes, chainsRes] = await Promise.all([
        fetch("/api/prompt-folders"),
        fetch("/api/formats"),
        fetch("/api/prompts"),
        fetch("/api/prompt-chains"),
      ]);
      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setFolders(foldersData.folders);
        setExpandedFolders(
          new Set(foldersData.folders.map((f: PromptFolder) => f.id))
        );
      }
      if (formatsRes.ok) {
        const formatsData = await formatsRes.json();
        setFormats(formatsData.formats);
      }
      if (promptsRes.ok) {
        const promptsData = await promptsRes.json();
        setAllPrompts(promptsData.prompts);
      }
      if (chainsRes.ok) {
        const chainsData = await chainsRes.json();
        setChains(chainsData.chains);
      }
    } catch {
      // Silently handle fetch errors
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Prompt handlers ───

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch("/api/prompt-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName }),
      });
      const data = await res.json();
      if (res.ok) {
        setFolders((prev) => [...prev, data.folder]);
        setExpandedFolders((prev) => new Set([...prev, data.folder.id]));
        setNewFolderName("");
        setShowNewFolder(false);
        toast.success("Folder created");
      }
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      const res = await fetch(`/api/prompt-folders?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFolders((prev) => prev.filter((f) => f.id !== id));
        if (selectedPrompt?.folder_id === id) setSelectedPrompt(null);
        toast.success("Folder deleted");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete folder");
    }
  };

  const createPrompt = async () => {
    if (!newPromptName.trim() || !newPromptText.trim()) return;
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPromptName,
          text: newPromptText,
          folder_id: newPromptFolderId || null,
          response_format_id: newPromptFormatId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFolders((prev) =>
          prev.map((f) =>
            f.id === (newPromptFolderId || null)
              ? { ...f, prompts: [...(f.prompts || []), data.prompt] }
              : f
          )
        );
        setNewPromptName("");
        setNewPromptText("");
        setNewPromptFormatId("");
        setShowNewPrompt(false);
        toast.success("Prompt created");
        fetchData();
      }
    } catch {
      toast.error("Failed to create prompt");
    }
  };

  const updatePrompt = async () => {
    if (!selectedPrompt || !editName.trim() || !editText.trim()) return;
    try {
      const res = await fetch("/api/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedPrompt.id,
          name: editName,
          text: editText,
          response_format_id: editFormatId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedPrompt(data.prompt);
        setEditMode(false);
        toast.success("Prompt updated");
        fetchData();
      }
    } catch {
      toast.error("Failed to update prompt");
    }
  };

  const deletePrompt = async (id: string) => {
    try {
      const res = await fetch(`/api/prompts?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedPrompt?.id === id) setSelectedPrompt(null);
        toast.success("Prompt deleted");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete prompt");
    }
  };

  const selectPrompt = (prompt: SavedPrompt) => {
    setSelectedPrompt(prompt);
    setEditMode(false);
    setEditName(prompt.name);
    setEditText(prompt.text);
    setEditFormatId(prompt.response_format_id || "");
  };

  const startEdit = () => {
    if (!selectedPrompt) return;
    setEditName(selectedPrompt.name);
    setEditText(selectedPrompt.text);
    setEditFormatId(selectedPrompt.response_format_id || "");
    setEditMode(true);
  };

  // ─── Chain handlers ───

  const createChain = async () => {
    if (!newChainName.trim() || newChainSteps.length === 0) return;
    try {
      const steps = newChainSteps.map((s) => {
        const prompt = allPrompts.find((p) => p.id === s.prompt_id);
        return {
          prompt_id: s.prompt_id,
          response_format_id: prompt?.response_format_id || null,
        };
      });
      const res = await fetch("/api/prompt-chains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newChainName, steps }),
      });
      const data = await res.json();
      if (res.ok) {
        setChains((prev) => [data.chain, ...prev]);
        setSelectedChain(data.chain);
        setShowNewChain(false);
        setNewChainName("");
        setNewChainSteps([]);
        toast.success("Chain created");
      }
    } catch {
      toast.error("Failed to create chain");
    }
  };

  const updateChain = async () => {
    if (!selectedChain || !editChainName.trim() || editChainSteps.length === 0) return;
    try {
      const steps = editChainSteps.map((s) => {
        const prompt = allPrompts.find((p) => p.id === s.prompt_id);
        return {
          prompt_id: s.prompt_id,
          response_format_id: prompt?.response_format_id || null,
        };
      });
      const res = await fetch("/api/prompt-chains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedChain.id, name: editChainName, steps }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedChain(data.chain);
        setEditChainMode(false);
        toast.success("Chain updated");
        fetchData();
      }
    } catch {
      toast.error("Failed to update chain");
    }
  };

  const deleteChain = async (id: string) => {
    try {
      const res = await fetch(`/api/prompt-chains?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setChains((prev) => prev.filter((c) => c.id !== id));
        if (selectedChain?.id === id) setSelectedChain(null);
        toast.success("Chain deleted");
      }
    } catch {
      toast.error("Failed to delete chain");
    }
  };

  const selectChain = (chain: PromptChain) => {
    setSelectedChain(chain);
    setEditChainMode(false);
    setEditChainName(chain.name);
    setEditChainSteps(
      chain.steps?.map((s) => ({ prompt_id: s.prompt_id })) || []
    );
  };

  const startChainEdit = () => {
    if (!selectedChain) return;
    setEditChainName(selectedChain.name);
    setEditChainSteps(
      selectedChain.steps?.map((s) => ({ prompt_id: s.prompt_id })) || []
    );
    setEditChainMode(true);
  };

  // ─── Render ───

  return (
    <div className="h-full flex flex-col">
      {/* Top nav tabs */}
      <div className="border-b px-4 flex gap-0">
        <button
          onClick={() => setActiveTab("prompts")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "prompts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Prompts
        </button>
        <button
          onClick={() => setActiveTab("chains")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "chains"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <GitBranch className="h-3.5 w-3.5" />
          Chains
          {chains.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {chains.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "prompts" ? (
          /* ─── PROMPTS TAB ─── */
          <div className="h-full flex">
            {/* Left: Folder tree */}
            <div className="w-80 border-r flex flex-col">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="text-sm font-semibold">Prompt Folders</h2>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowNewFolder(!showNewFolder)}
                    title="New Folder"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      setShowNewPrompt(!showNewPrompt);
                      setNewPromptFolderId(folders[0]?.id || "");
                    }}
                    title="New Prompt"
                  >
                    <FilePlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* New folder input */}
              {showNewFolder && (
                <div className="px-4 py-2 border-b space-y-2">
                  <input
                    type="text"
                    placeholder="Folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && createFolder()}
                  />
                  <div className="flex gap-2">
                    <Button size="xs" onClick={createFolder} disabled={!newFolderName.trim()}>
                      Create
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setShowNewFolder(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Folder tree */}
              <div className="flex-1 overflow-y-auto py-2">
                {folders.map((folder) => {
                  const isExpanded = expandedFolders.has(folder.id);
                  const prompts = folder.prompts || [];

                  return (
                    <div key={folder.id}>
                      <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-muted/50 group">
                        <button
                          onClick={() => toggleFolder(folder.id)}
                          className="p-0.5"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1 truncate">{folder.name}</span>
                        {folder.is_default && (
                          <Badge variant="secondary" className="text-[9px] shrink-0">
                            default
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground shrink-0 mr-1">
                          {prompts.length}
                        </span>
                        {!folder.is_default && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => deleteFolder(folder.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="ml-4">
                          {prompts.map((prompt) => (
                            <button
                              key={prompt.id}
                              onClick={() => selectPrompt(prompt)}
                              className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm rounded-md group ${
                                selectedPrompt?.id === prompt.id
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              }`}
                            >
                              <span className="truncate flex-1">{prompt.name}</span>
                              {prompt.response_format && (
                                <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              {!prompt.is_default && (
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="opacity-0 group-hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deletePrompt(prompt.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </button>
                          ))}
                          {prompts.length === 0 && (
                            <p className="text-xs text-muted-foreground px-3 py-2">
                              No prompts in this folder
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Prompt detail / Create form */}
            <div className="flex-1 overflow-y-auto">
              {showNewPrompt ? (
                <div className="p-6 max-w-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">New Prompt</h3>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowNewPrompt(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <input
                        type="text"
                        placeholder="Prompt name..."
                        value={newPromptName}
                        onChange={(e) => setNewPromptName(e.target.value)}
                        className="w-full text-sm border rounded-md px-3 py-2 bg-background mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Folder</label>
                      <select
                        value={newPromptFolderId}
                        onChange={(e) => setNewPromptFolderId(e.target.value)}
                        className="w-full text-sm border rounded-md px-3 py-2 bg-background mt-1"
                      >
                        <option value="">No folder</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Prompt Text</label>
                      <Textarea
                        placeholder="Write your prompt..."
                        value={newPromptText}
                        onChange={(e) => setNewPromptText(e.target.value)}
                        className="min-h-32 text-sm mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Paired Response Format{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </label>
                      <select
                        value={newPromptFormatId}
                        onChange={(e) => setNewPromptFormatId(e.target.value)}
                        className="w-full text-sm border rounded-md px-3 py-2 bg-background mt-1"
                      >
                        <option value="">None (will use XML tags)</option>
                        {formats.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                            {f.description ? ` — ${f.description}` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        If no format is selected, the LLM will respond using XML tags
                      </p>
                    </div>
                    <Button
                      onClick={createPrompt}
                      disabled={!newPromptName.trim() || !newPromptText.trim()}
                    >
                      <FilePlus className="h-4 w-4 mr-2" />
                      Create Prompt
                    </Button>
                  </div>
                </div>
              ) : selectedPrompt ? (
                <div className="p-6 max-w-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    {editMode ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-lg font-semibold bg-background border rounded px-2 py-1"
                      />
                    ) : (
                      <h3 className="text-lg font-semibold">{selectedPrompt.name}</h3>
                    )}
                    <div className="flex gap-2">
                      {selectedPrompt.is_default ? (
                        <Badge variant="secondary">Default</Badge>
                      ) : editMode ? (
                        <>
                          <Button size="sm" onClick={updatePrompt}>
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditMode(false)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={startEdit}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Paired format */}
                  <div className="flex items-center gap-2 text-sm">
                    {editMode ? (
                      <div className="flex-1">
                        <label className="text-sm font-medium">Paired Format</label>
                        <select
                          value={editFormatId}
                          onChange={(e) => setEditFormatId(e.target.value)}
                          className="w-full text-sm border rounded-md px-3 py-2 bg-background mt-1"
                        >
                          <option value="">None (will use XML tags)</option>
                          {formats.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : selectedPrompt.response_format ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Paired Format:{" "}
                          <strong>{selectedPrompt.response_format.name}</strong>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
                        <Unlink className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          No paired format — will use XML tags
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Prompt text */}
                  {editMode ? (
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="min-h-48 text-sm"
                    />
                  ) : (
                    <div className="bg-muted/30 border rounded-lg p-4">
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedPrompt.text}
                      </p>
                    </div>
                  )}

                  {/* Format preview */}
                  {selectedPrompt.response_format && !editMode && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Format Template</h4>
                      <pre className="text-xs bg-muted/30 border rounded-lg p-4 whitespace-pre-wrap">
                        {selectedPrompt.response_format.template_text}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-2">
                    <Folder className="h-12 w-12 mx-auto opacity-20" />
                    <p className="text-sm">Select a prompt to view details</p>
                    <p className="text-xs">
                      Or create a new folder / prompt using the buttons above
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ─── CHAINS TAB ─── */
          <div className="h-full flex">
            {/* Left: Chain list */}
            <div className="w-80 border-r flex flex-col">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="text-sm font-semibold">Prompt Chains</h2>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setShowNewChain(true);
                    setSelectedChain(null);
                  }}
                  title="New Chain"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                {chains.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-4 py-6 text-center">
                    No chains yet. Create one to sequence multiple prompts together.
                  </p>
                ) : (
                  chains.map((chain) => (
                    <div
                      key={chain.id}
                      className="group"
                    >
                      <button
                        onClick={() => {
                          selectChain(chain);
                          setShowNewChain(false);
                        }}
                        className={`w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                          selectedChain?.id === chain.id
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <GitBranch className="h-4 w-4 shrink-0" />
                        <div className="flex-1 truncate">
                          <span className="truncate">{chain.name}</span>
                          <p className="text-[10px] text-muted-foreground">
                            {chain.steps?.length || 0} steps
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChain(chain.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Chain detail / Create form */}
            <div className="flex-1 overflow-y-auto">
              {showNewChain ? (
                <div className="p-6 max-w-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">New Chain</h3>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowNewChain(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Chain Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Full Document Generation..."
                        value={newChainName}
                        onChange={(e) => setNewChainName(e.target.value)}
                        className="w-full text-sm border rounded-md px-3 py-2 bg-background mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Steps{" "}
                        <span className="text-muted-foreground font-normal">
                          (select prompts in execution order)
                        </span>
                      </label>
                      <div className="space-y-2">
                        {newChainSteps.map((step, i) => {
                          const prompt = allPrompts.find((p) => p.id === step.prompt_id);
                          return (
                            <div key={i} className="flex items-center gap-2 border rounded-md p-2 bg-muted/20">
                              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
                                {i + 1}
                              </span>
                              <select
                                value={step.prompt_id}
                                onChange={(e) => {
                                  const updated = [...newChainSteps];
                                  updated[i] = { prompt_id: e.target.value };
                                  setNewChainSteps(updated);
                                }}
                                className="flex-1 text-sm border rounded px-2 py-1.5 bg-background"
                              >
                                <option value="">Select a prompt...</option>
                                {folders.map((folder) => (
                                  <optgroup key={folder.id} label={folder.name}>
                                    {(folder.prompts || []).map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                        {p.response_format ? ` [${p.response_format.name}]` : ""}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              {prompt?.response_format && (
                                <Badge variant="outline" className="text-[9px] shrink-0">
                                  {prompt.response_format.name}
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() =>
                                  setNewChainSteps((prev) => prev.filter((_, j) => j !== i))
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() =>
                          setNewChainSteps((prev) => [...prev, { prompt_id: "" }])
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Step
                      </Button>
                    </div>

                    <Button
                      onClick={createChain}
                      disabled={
                        !newChainName.trim() ||
                        newChainSteps.length === 0 ||
                        newChainSteps.some((s) => !s.prompt_id)
                      }
                    >
                      <GitBranch className="h-4 w-4 mr-2" />
                      Create Chain
                    </Button>
                  </div>
                </div>
              ) : selectedChain ? (
                <div className="p-6 max-w-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    {editChainMode ? (
                      <input
                        type="text"
                        value={editChainName}
                        onChange={(e) => setEditChainName(e.target.value)}
                        className="text-lg font-semibold bg-background border rounded px-2 py-1"
                      />
                    ) : (
                      <h3 className="text-lg font-semibold">{selectedChain.name}</h3>
                    )}
                    <div className="flex gap-2">
                      {editChainMode ? (
                        <>
                          <Button size="sm" onClick={updateChain}>
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditChainMode(false)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={startChainEdit}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>

                  {editChainMode ? (
                    /* Edit chain steps */
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Steps</label>
                        <div className="space-y-2">
                          {editChainSteps.map((step, i) => {
                            const prompt = allPrompts.find((p) => p.id === step.prompt_id);
                            return (
                              <div key={i} className="flex items-center gap-2 border rounded-md p-2 bg-muted/20">
                                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
                                  {i + 1}
                                </span>
                                <select
                                  value={step.prompt_id}
                                  onChange={(e) => {
                                    const updated = [...editChainSteps];
                                    updated[i] = { prompt_id: e.target.value };
                                    setEditChainSteps(updated);
                                  }}
                                  className="flex-1 text-sm border rounded px-2 py-1.5 bg-background"
                                >
                                  <option value="">Select a prompt...</option>
                                  {folders.map((folder) => (
                                    <optgroup key={folder.id} label={folder.name}>
                                      {(folder.prompts || []).map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name}
                                          {p.response_format ? ` [${p.response_format.name}]` : ""}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                                {prompt?.response_format && (
                                  <Badge variant="outline" className="text-[9px] shrink-0">
                                    {prompt.response_format.name}
                                  </Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() =>
                                    setEditChainSteps((prev) => prev.filter((_, j) => j !== i))
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() =>
                            setEditChainSteps((prev) => [...prev, { prompt_id: "" }])
                          }
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Step
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View chain steps */
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        {selectedChain.steps?.length || 0} Steps
                      </p>
                      <div className="space-y-2">
                        {selectedChain.steps?.map((step, i) => (
                          <div
                            key={step.id}
                            className="flex items-start gap-3 border rounded-lg p-3 bg-muted/20"
                          >
                            <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {step.prompt?.name || "Unknown"}
                                </span>
                                {step.response_format && (
                                  <Badge variant="outline" className="text-[9px]">
                                    {step.response_format.name}
                                  </Badge>
                                )}
                              </div>
                              {step.prompt?.text && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {step.prompt.text}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-2">
                    <GitBranch className="h-12 w-12 mx-auto opacity-20" />
                    <p className="text-sm">Select a chain to view details</p>
                    <p className="text-xs">
                      Or create a new chain using the + button above
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
