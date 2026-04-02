"use client";

import { Sparkles, RefreshCw, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GENIE_FEATURES, type GenieFeature } from "./genie-types";
import { InfographicsPanel } from "./infographics-panel";

interface GenieCenterPanelProps {
  selectedFeature: GenieFeature | null;
  selectedSourceIds: string[];
  selectedDatasetId: string | null;
  selectedModel: string;
}

export function GenieCenterPanel({
  selectedFeature,
  selectedSourceIds,
  selectedDatasetId,
  selectedModel,
}: GenieCenterPanelProps) {
  const feature = GENIE_FEATURES.find((f) => f.id === selectedFeature);

  // No feature selected
  if (!selectedFeature || !feature) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background px-8">
        <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Welcome to Genie
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Select a dataset, choose your source files, and pick a feature from the
          right panel to get started.
        </p>
      </div>
    );
  }

  // No sources selected
  if (!selectedDatasetId || selectedSourceIds.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background px-8">
        <Construction className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {feature.label}
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Please select a dataset and at least one source file from the left panel.
        </p>
      </div>
    );
  }

  // Infographics — dedicated panel
  if (selectedFeature === "infographics") {
    return (
      <InfographicsPanel
        selectedSourceIds={selectedSourceIds}
        selectedDatasetId={selectedDatasetId}
        selectedModel={selectedModel}
      />
    );
  }

  // Feature selected + sources selected → Show "Coming Soon" for now
  // In the future, this will check if a generation exists for this combination
  // and display results with a re-generate button.
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top bar */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {feature.label}
          </h2>
          <p className="text-xs text-muted-foreground">
            {selectedSourceIds.length} source{selectedSourceIds.length !== 1 ? "s" : ""} selected
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Re-generate
        </Button>
      </div>

      {/* Content area — Coming Soon placeholder */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Construction className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          Coming Soon
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          <span className="font-medium">{feature.label}</span> generation is under
          development. Stay tuned for updates!
        </p>
      </div>
    </div>
  );
}
