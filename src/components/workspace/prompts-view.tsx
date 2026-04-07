"use client";

import { useState } from "react";
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
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { SavedPrompt, ResponseFormat, PromptChain } from "@/lib/types";
import * as api from "@/lib/api";
import { useWorkspace } from "@/lib/workspace-context";

type PromptsTab = "prompts" | "chains";

export function PromptsView() {
  // Use workspace context
  const {
    folders,
    prompts: allPrompts,
    chains,
    formats,
    isLoadingPrompts,
    isLoadingChains,
    createFolder,
    deleteFolder,
    createPrompt,
    updatePrompt,
    deletePrompt,
    createChain,
    updateChain,
    deleteChain,
    fetchPrompts,
    fetchChains,
  } = useWorkspace();
  
  const isLoading = isLoadingPrompts || isLoadingChains;

  const [activeTab, setActiveTab] = useState<PromptsTab>("prompts");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(folders.map((f) => f.id)));
  const [selectedPrompt, setSelectedPrompt] = useState<SavedPrompt | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");
  const [editFormatText, setEditFormatText] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewPrompt, setShowNewPrompt] = useState(false);
  const [newPromptFolderId, setNewPromptFolderId] = useState<string>("");
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [newPromptFormatText, setNewPromptFormatText] = useState("");

  // Chain state
  const [selectedChain, setSelectedChain] = useState<PromptChain | null>(null);
  const [showNewChain, setShowNewChain] = useState(false);
  const [newChainName, setNewChainName] = useState("");
  const [newChainSteps, setNewChainSteps] = useState<{ prompt_id: string }[]>([]);
  const [editChainMode, setEditChainMode] = useState(false);
  const [editChainName, setEditChainName] = useState("");
  const [editChainSteps, setEditChainSteps] = useState<{ prompt_id: string }[]>([]);

  // ─── Prompt handlers ───

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const folder = await createFolder(newFolderName);
      setExpandedFolders((prev) => new Set([...prev, folder.id]));
      setNewFolderName("");
      setShowNewFolder(false);
      toast.success("Folder created");
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await deleteFolder(id);
      if (selectedPrompt?.folder_id === id) setSelectedPrompt(null);
      toast.success("Folder deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete folder");
    }
  };

  const handleCreatePrompt = async () => {
    if (!newPromptName.trim() || !newPromptText.trim()) return;
    try {
      // If custom format text is provided, create a new format first
      let response_format_id: string | undefined;
      if (newPromptFormatText.trim()) {
        const fmt = await api.createFormat({
          name: `${newPromptName} Format`,
          description: `Custom format for ${newPromptName}`,
          template_text: newPromptFormatText,
        });
        response_format_id = fmt.id;
      }

      await createPrompt({
        name: newPromptName,
        text: newPromptText,
        folder_id: newPromptFolderId || undefined,
        response_format_id,
      });
      
      setNewPromptName("");
      setNewPromptText("");
      setNewPromptFormatText("");
      setShowNewPrompt(false);
      toast.success("Prompt created");
    } catch {
      toast.error("Failed to create prompt");
    }
  };

  const handleUpdatePrompt = async () => {
    if (!selectedPrompt || !editName.trim() || !editText.trim()) return;
    try {
      // If format text changed, create a new format and link it
      let response_format_id: string | undefined;
      const originalFormatText = selectedPrompt.response_format?.template_text || "";
      if (editFormatText.trim() !== originalFormatText && editFormatText.trim()) {
        const fmt = await api.createFormat({
          name: `${editName} Format`,
          description: `Custom format for ${editName}`,
          template_text: editFormatText,
        });
        response_format_id = fmt.id;
      }

      await updatePrompt(selectedPrompt.id, {
        name: editName,
        text: editText,
        ...(response_format_id !== undefined && { response_format_id }),
      });
      
      setSelectedPrompt(null);
      setEditMode(false);
      toast.success("Prompt updated");
    } catch {
      toast.error("Failed to update prompt");
    }
  };

  const handleDeletePrompt = async (id: string) => {
    try {
      await deletePrompt(id);
      if (selectedPrompt?.id === id) setSelectedPrompt(null);
      toast.success("Prompt deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete prompt");
    }
  };

  const selectPrompt = (prompt: SavedPrompt) => {
    setSelectedPrompt(prompt);
    setEditMode(false);
    setEditName(prompt.name);
    setEditText(prompt.text);
    setEditFormatText(prompt.response_format?.template_text || "");
  };

  const startEdit = () => {
    if (!selectedPrompt) return;
    setEditName(selectedPrompt.name);
    setEditText(selectedPrompt.text);
    setEditFormatText(selectedPrompt.response_format?.template_text || "");
    setEditMode(true);
  };

  // ─── Chain handlers ───

  const handleCreateChain = async () => {
    if (!newChainName.trim() || newChainSteps.length === 0) return;
    try {
      const steps = newChainSteps.map((s, i) => {
        const prompt = allPrompts.find((p) => p.id === s.prompt_id);
        return {
          step_order: i + 1,
          prompt_id: s.prompt_id,
          response_format_id: prompt?.response_format_id || undefined,
        };
      });
      const chain = await createChain({
        name: newChainName,
        steps,
      });
      setSelectedChain(chain);
      setShowNewChain(false);
      setNewChainName("");
      setNewChainSteps([]);
      toast.success("Chain created");
    } catch {
      toast.error("Failed to create chain");
    }
  };

  const handleUpdateChain = async () => {
    if (!selectedChain || !editChainName.trim() || editChainSteps.length === 0) return;
    try {
      const updated = await updateChain(selectedChain.id, {
        name: editChainName,
        steps: editChainSteps,
      });
      setSelectedChain(updated);
      setEditChainMode(false);
      toast.success("Chain updated");
    } catch {
      toast.error("Failed to update chain");
    }
  };

  const handleDeleteChain = async (id: string) => {
    try {
      await deleteChain(id);
      if (selectedChain?.id === id) setSelectedChain(null);
      toast.success("Chain deleted");
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
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                  />
                  <div className="flex gap-2">
                    <Button size="xs" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
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
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading prompts...</span>
                  </div>
                ) : folders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No folders yet</p>
                ) : (
                  folders.map((folder) => {
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
                            onClick={() => handleDeleteFolder(folder.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="ml-4">
                          {prompts.map((prompt) => (
                            <div
                              key={prompt.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => selectPrompt(prompt)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") selectPrompt(prompt); }}
                              className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm rounded-md group cursor-pointer ${
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
                                    handleDeletePrompt(prompt.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
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
                  })
                )}
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
                      <Textarea
                        placeholder="Write custom response format instructions for the LLM..."
                        value={newPromptFormatText}
                        onChange={(e) => setNewPromptFormatText(e.target.value)}
                        className="min-h-24 text-sm mt-1 font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        If left empty, the LLM will respond using default XML tags
                      </p>
                    </div>
                    <Button
                      onClick={handleCreatePrompt}
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
                          <Button size="sm" onClick={handleUpdatePrompt}>
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

                  {/* Paired format */}
                  {editMode ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Paired Response Format{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </label>
                      <Textarea
                        placeholder="Write custom response format instructions for the LLM..."
                        value={editFormatText}
                        onChange={(e) => setEditFormatText(e.target.value)}
                        className="min-h-24 text-sm font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        If left empty, the LLM will respond using default XML tags
                      </p>
                    </div>
                  ) : selectedPrompt.response_format ? (
                    <div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted mb-2">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Paired Format:{" "}
                          <strong>{selectedPrompt.response_format.name}</strong>
                        </span>
                      </div>
                      <h4 className="text-sm font-medium mb-2">Format Template</h4>
                      <pre className="text-xs bg-muted/30 border rounded-lg p-4 whitespace-pre-wrap">
                        {selectedPrompt.response_format.template_text}
                      </pre>
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
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          selectChain(chain);
                          setShowNewChain(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectChain(chain);
                            setShowNewChain(false);
                          }
                        }}
                        className={`w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
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
                            handleDeleteChain(chain.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
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
                      onClick={handleCreateChain}
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
                          <Button size="sm" onClick={handleUpdateChain}>
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
