"use client";

import { useState } from "react";
import { GenieLeftPanel } from "./genie-left-panel";
import { GenieCenterPanel } from "./genie-center-panel";
import { GenieRightPanel } from "./genie-right-panel";
import type { GenieFeature } from "./genie-types";

export function GenieView() {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<GenieFeature | null>(null);
  const [selectedModel, setSelectedModel] = useState("google/gemini-3-flash-preview");

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left panel — 20% */}
      <div className="w-[20%] min-w-50 shrink-0">
        <GenieLeftPanel
          selectedDatasetId={selectedDatasetId}
          onDatasetChange={setSelectedDatasetId}
          selectedSourceIds={selectedSourceIds}
          onSourceSelectionChange={setSelectedSourceIds}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </div>

      {/* Center panel — 60% */}
      <div className="flex-1 min-w-0">
        <GenieCenterPanel
          selectedFeature={selectedFeature}
          selectedSourceIds={selectedSourceIds}
          selectedDatasetId={selectedDatasetId}
          selectedModel={selectedModel}
        />
      </div>

      {/* Right panel — 20% */}
      <div className="w-[20%] min-w-50 shrink-0">
        <GenieRightPanel
          selectedFeature={selectedFeature}
          onFeatureSelect={setSelectedFeature}
        />
      </div>
    </div>
  );
}
