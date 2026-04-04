"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import type {
  Dataset,
  InputSource,
  PromptFolder,
  SavedPrompt,
  PromptChain,
  ResponseFormat,
  Generation,
} from "./types";
import * as api from "./api";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface WorkspaceCache {
  datasets: Dataset[];
  folders: PromptFolder[];
  prompts: SavedPrompt[];
  chains: PromptChain[];
  formats: ResponseFormat[];
  generations: Generation[];
  lastFetched: {
    datasets?: number;
    prompts?: number;
    chains?: number;
    formats?: number;
    generations?: number;
  };
}

interface WorkspaceContextValue {
  // State
  datasets: Dataset[];
  folders: PromptFolder[];
  prompts: SavedPrompt[];
  chains: PromptChain[];
  formats: ResponseFormat[];
  generations: Generation[];
  
  // Loading states
  isLoading: boolean;
  isLoadingDatasets: boolean;
  isLoadingPrompts: boolean;
  isLoadingChains: boolean;
  
  // Data fetching
  fetchAll: () => Promise<void>;
  fetchDatasets: (force?: boolean) => Promise<void>;
  fetchPrompts: (force?: boolean) => Promise<void>;
  fetchChains: (force?: boolean) => Promise<void>;
  fetchGenerations: (force?: boolean) => Promise<void>;
  
  // Dataset operations
  createDataset: (name: string, description?: string) => Promise<Dataset>;
  updateDataset: (id: string, name: string, description?: string) => Promise<Dataset>;
  deleteDataset: (id: string) => Promise<void>;
  
  // Source operations
  addSource: (datasetId: string, source: InputSource) => void;
  removeSource: (datasetId: string, sourceId: string) => void;
  fetchSourcesForDataset: (datasetId: string) => Promise<void>;
  
  // Prompt folder operations
  createFolder: (name: string) => Promise<PromptFolder>;
  deleteFolder: (id: string) => Promise<void>;
  
  // Prompt operations
  createPrompt: (data: { name: string; text: string; folder_id?: string; response_format_id?: string }) => Promise<void>;
  updatePrompt: (id: string, data: { name?: string; text?: string }) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  
  // Chain operations
  createChain: (data: { name: string; description?: string; steps: { prompt_id: string }[] }) => Promise<PromptChain>;
  updateChain: (id: string, data: { name?: string; description?: string; steps?: { prompt_id: string }[] }) => Promise<PromptChain>;
  deleteChain: (id: string) => Promise<void>;
  
  // Generation operations
  addGeneration: (generation: Generation) => void;
  
  // Cache management
  clearCache: () => void;
  refreshAll: () => Promise<void>;
}

const CACHE_KEY = "genie_workspace_cache";
const CACHE_VERSION = 2; // Increment to invalidate old caches
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}

// ─────────────────────────────────────────────────────────────
// Session Storage Helpers
// ─────────────────────────────────────────────────────────────

interface CacheWrapper {
  version: number;
  data: WorkspaceCache;
}

function loadFromSession(): WorkspaceCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const wrapper = JSON.parse(raw) as CacheWrapper;
      // Only use cache if version matches
      if (wrapper.version === CACHE_VERSION) {
        return wrapper.data;
      }
      // Clear stale cache from old version
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveToSession(cache: WorkspaceCache): void {
  if (typeof window === "undefined") return;
  try {
    const wrapper: CacheWrapper = {
      version: CACHE_VERSION,
      data: cache,
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(wrapper));
  } catch {
    // Ignore storage errors (quota, etc.)
  }
}

function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore errors
  }
}

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  // State
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [folders, setFolders] = useState<PromptFolder[]>([]);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [chains, setChains] = useState<PromptChain[]>([]);
  const [formats, setFormats] = useState<ResponseFormat[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  
  // Loading states
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isLoadingChains, setIsLoadingChains] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Track last fetch times in a ref to avoid re-creating fetch callbacks on every fetch
  const lastFetchedRef = useRef<WorkspaceCache["lastFetched"]>({});
  
  const isLoading = isLoadingDatasets || isLoadingPrompts || isLoadingChains;

  // ─── Sync to session storage ───
  const syncToSession = useCallback(() => {
    const cache: WorkspaceCache = {
      datasets,
      folders,
      prompts,
      chains,
      formats,
      generations,
      lastFetched: lastFetchedRef.current,
    };
    saveToSession(cache);
  }, [datasets, folders, prompts, chains, formats, generations]);

  // Sync whenever state changes
  useEffect(() => {
    if (isInitialized) {
      syncToSession();
    }
  }, [syncToSession, isInitialized]);

  // ─── Load from session on mount ───
  useEffect(() => {
    const cached = loadFromSession();
    if (cached) {
      setDatasets(cached.datasets || []);
      setFolders(cached.folders || []);
      setPrompts(cached.prompts || []);
      setChains(cached.chains || []);
      setFormats(cached.formats || []);
      setGenerations(cached.generations || []);
      lastFetchedRef.current = cached.lastFetched || {};
    }
    setIsInitialized(true);
  }, []);

  // ─── Check if cache is stale ───
  const isCacheStale = useCallback((key: keyof WorkspaceCache["lastFetched"]) => {
    const fetchTime = lastFetchedRef.current[key];
    if (!fetchTime) return true;
    return Date.now() - fetchTime > CACHE_TTL;
  }, []);

  // ─── Fetch datasets with sources ───
  const fetchDatasets = useCallback(async (force = false) => {
    if (!force && !isCacheStale("datasets")) {
      return; // Use cached data
    }
    
    setIsLoadingDatasets(true);
    try {
      const data = await api.getDatasets(true); // Include sources
      setDatasets(data.datasets as unknown as Dataset[]);
      lastFetchedRef.current = { ...lastFetchedRef.current, datasets: Date.now() };
    } catch {
      // Silently handle errors
    } finally {
      setIsLoadingDatasets(false);
    }
  }, [isCacheStale]);

  // ─── Fetch prompts and folders ───
  const fetchPrompts = useCallback(async (force = false) => {
    if (!force && !isCacheStale("prompts")) {
      return;
    }
    
    setIsLoadingPrompts(true);
    try {
      const [promptsData, formatsData] = await Promise.all([
        api.getPrompts(),
        api.getFormats(),
      ]);
      
      const fetchedPrompts = promptsData.prompts as unknown as SavedPrompt[];
      const foldersWithPrompts = (promptsData.folders as unknown as PromptFolder[]).map(folder => ({
        ...folder,
        prompts: fetchedPrompts.filter(p => p.folder_id === folder.id),
      }));

      setPrompts(fetchedPrompts);
      setFolders(foldersWithPrompts);
      setFormats(formatsData as unknown as ResponseFormat[]);
      lastFetchedRef.current = { ...lastFetchedRef.current, prompts: Date.now(), formats: Date.now() };
    } catch {
      // Silently handle errors
    } finally {
      setIsLoadingPrompts(false);
    }
  }, [isCacheStale]);

  // ─── Fetch chains ───
  const fetchChains = useCallback(async (force = false) => {
    if (!force && !isCacheStale("chains")) {
      return;
    }
    
    setIsLoadingChains(true);
    try {
      const data = await api.getPromptChains();
      setChains(data as unknown as PromptChain[]);
      lastFetchedRef.current = { ...lastFetchedRef.current, chains: Date.now() };
    } catch {
      // Silently handle errors
    } finally {
      setIsLoadingChains(false);
    }
  }, [isCacheStale]);

  // ─── Fetch generations ───
  const fetchGenerations = useCallback(async (force = false) => {
    if (!force && !isCacheStale("generations")) {
      return;
    }
    
    try {
      const data = await api.getGenerations(50, 0);
      setGenerations(data.generations as unknown as Generation[]);
      lastFetchedRef.current = { ...lastFetchedRef.current, generations: Date.now() };
    } catch {
      // Silently handle errors
    }
  }, [isCacheStale]);

  // ─── Fetch all data ───
  // Always force fetch on initial load to ensure fresh data
  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchDatasets(true),  // Force refresh
      fetchPrompts(true),
      fetchChains(true),
      fetchGenerations(true),
    ]);
  }, [fetchDatasets, fetchPrompts, fetchChains, fetchGenerations]);

  // ─── Force refresh all ───
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchDatasets(true),
      fetchPrompts(true),
      fetchChains(true),
      fetchGenerations(true),
    ]);
  }, [fetchDatasets, fetchPrompts, fetchChains, fetchGenerations]);

  // ─── Dataset operations ───
  const createDataset = useCallback(async (name: string, description?: string): Promise<Dataset> => {
    const dataset = await api.createDataset(name, description);
    const newDataset = { ...dataset, input_sources: [] } as unknown as Dataset;
    setDatasets(prev => [newDataset, ...prev]);
    return newDataset;
  }, []);

  const updateDataset = useCallback(async (id: string, name: string, description?: string): Promise<Dataset> => {
    const dataset = await api.updateDataset(id, name, description);
    setDatasets(prev => prev.map(d => 
      d.id === id ? { ...d, name: dataset.name, description: dataset.description } : d
    ));
    return dataset as unknown as Dataset;
  }, []);

  const deleteDataset = useCallback(async (id: string): Promise<void> => {
    await api.deleteDataset(id);
    setDatasets(prev => prev.filter(d => d.id !== id));
  }, []);

  // ─── Source operations ───
  const addSource = useCallback((datasetId: string, source: InputSource) => {
    setDatasets(prev => prev.map(d => 
      d.id === datasetId 
        ? { ...d, input_sources: [source, ...(d.input_sources || [])] }
        : d
    ));
  }, []);

  const removeSource = useCallback((datasetId: string, sourceId: string) => {
    setDatasets(prev => prev.map(d => 
      d.id === datasetId 
        ? { ...d, input_sources: (d.input_sources || []).filter(s => s.id !== sourceId) }
        : d
    ));
  }, []);

  const fetchSourcesForDataset = useCallback(async (datasetId: string) => {
    try {
      const data = await api.getSources(datasetId);
      setDatasets(prev => prev.map(d => 
        d.id === datasetId 
          ? { ...d, input_sources: data.sources as unknown as InputSource[] }
          : d
      ));
    } catch {
      // Silently handle errors
    }
  }, []);

  // ─── Folder operations ───
  const createFolder = useCallback(async (name: string): Promise<PromptFolder> => {
    const folder = await api.createPromptFolder(name);
    const newFolder = { ...folder, prompts: [] } as unknown as PromptFolder;
    setFolders(prev => [...prev, newFolder]);
    return newFolder;
  }, []);

  const deleteFolder = useCallback(async (id: string): Promise<void> => {
    await api.deletePromptFolder(id);
    setFolders(prev => prev.filter(f => f.id !== id));
    // Also remove prompts in this folder from prompts list
    setPrompts(prev => prev.filter(p => p.folder_id !== id));
  }, []);

  // ─── Prompt operations ───
  const createPrompt = useCallback(async (data: { name: string; text: string; folder_id?: string; response_format_id?: string }): Promise<void> => {
    await api.createPrompt(data);
    // Refetch to get the complete data with relationships
    await fetchPrompts(true);
  }, [fetchPrompts]);

  const updatePrompt = useCallback(async (id: string, data: { name?: string; text?: string }): Promise<void> => {
    await api.updatePrompt(id, data);
    // Refetch to get updated data
    await fetchPrompts(true);
  }, [fetchPrompts]);

  const deletePrompt = useCallback(async (id: string): Promise<void> => {
    await api.deletePrompt(id);
    setPrompts(prev => prev.filter(p => p.id !== id));
    // Also update folders
    setFolders(prev => prev.map(f => ({
      ...f,
      prompts: (f.prompts || []).filter(p => p.id !== id)
    })));
  }, []);

  // ─── Chain operations ───
  const createChain = useCallback(async (data: { name: string; description?: string; steps: { prompt_id: string; step_order?: number; response_format_id?: string }[] }): Promise<PromptChain> => {
    // Add step_order if not provided
    const stepsWithOrder = data.steps.map((s, i) => ({
      ...s,
      step_order: s.step_order ?? i + 1,
    }));
    const chain = await api.createPromptChain({ ...data, steps: stepsWithOrder });
    setChains(prev => [...prev, chain as unknown as PromptChain]);
    return chain as unknown as PromptChain;
  }, []);

  const updateChain = useCallback(async (id: string, data: { name?: string; description?: string; steps?: { prompt_id: string }[] }): Promise<PromptChain> => {
    // Note: updatePromptChain doesn't exist in API yet, so we delete and recreate
    // For now, just return the existing chain
    const existing = chains.find(c => c.id === id);
    return existing || ({} as PromptChain);
  }, [chains]);

  const deleteChain = useCallback(async (id: string): Promise<void> => {
    await api.deletePromptChain(id);
    setChains(prev => prev.filter(c => c.id !== id));
  }, []);

  // ─── Generation operations ───
  const addGeneration = useCallback((generation: Generation) => {
    setGenerations(prev => [generation, ...prev]);
  }, []);

  // ─── Cache management ───
  const clearCache = useCallback(() => {
    clearSession();
    setDatasets([]);
    setFolders([]);
    setPrompts([]);
    setChains([]);
    setFormats([]);
    setGenerations([]);
    lastFetchedRef.current = {};
  }, []);

  // ─── Context value ───
  const value: WorkspaceContextValue = {
    // State
    datasets,
    folders,
    prompts,
    chains,
    formats,
    generations,
    
    // Loading states
    isLoading,
    isLoadingDatasets,
    isLoadingPrompts,
    isLoadingChains,
    
    // Data fetching
    fetchAll,
    fetchDatasets,
    fetchPrompts,
    fetchChains,
    fetchGenerations,
    
    // Dataset operations
    createDataset,
    updateDataset,
    deleteDataset,
    
    // Source operations
    addSource,
    removeSource,
    fetchSourcesForDataset,
    
    // Folder operations
    createFolder,
    deleteFolder,
    
    // Prompt operations
    createPrompt,
    updatePrompt,
    deletePrompt,
    
    // Chain operations
    createChain,
    updateChain,
    deleteChain,
    
    // Generation operations
    addGeneration,
    
    // Cache management
    clearCache,
    refreshAll,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
