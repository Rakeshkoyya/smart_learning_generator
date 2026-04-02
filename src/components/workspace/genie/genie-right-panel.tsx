"use client";

import {
  GitBranch,
  Video,
  Headphones,
  Presentation,
  Layers,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import { GENIE_FEATURES, type GenieFeature } from "./genie-types";

const ICON_MAP: Record<string, React.ElementType> = {
  GitBranch,
  Video,
  Headphones,
  Presentation,
  Layers,
  BarChart3,
  HelpCircle,
};

interface GenieRightPanelProps {
  selectedFeature: GenieFeature | null;
  onFeatureSelect: (feature: GenieFeature) => void;
}

export function GenieRightPanel({
  selectedFeature,
  onFeatureSelect,
}: GenieRightPanelProps) {
  return (
    <div className="h-full flex flex-col bg-card border-l overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b">
        <h3 className="text-sm font-semibold text-foreground">Features</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose a generation type
        </p>
      </div>

      {/* Feature cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {GENIE_FEATURES.map((feature) => {
          const Icon = ICON_MAP[feature.icon] || HelpCircle;
          const isActive = selectedFeature === feature.id;

          return (
            <button
              key={feature.id}
              onClick={() => onFeatureSelect(feature.id)}
              className={`w-full rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                isActive
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${feature.color}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {feature.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    {feature.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
