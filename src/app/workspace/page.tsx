"use client";

import { useState } from "react";
import { Sidebar, type SidebarSection } from "@/components/workspace/sidebar";
import { GenerateView } from "@/components/workspace/generate-view";
import { PromptsView } from "@/components/workspace/prompts-view";
import { SourcesView } from "@/components/workspace/sources-view";
import { ExportsView } from "@/components/workspace/exports-view";
import { GenieView } from "@/components/workspace/genie/genie-view";

export default function WorkspacePage() {
  const [activeSection, setActiveSection] = useState<SidebarSection>("generate");

  const isGenie = activeSection === "genie";

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar
        active={activeSection}
        onNavigate={setActiveSection}
        forceCollapsed={isGenie}
      />
      <main className="flex-1 overflow-hidden">
        {activeSection === "generate" && <GenerateView />}
        {activeSection === "sources" && <SourcesView />}
        {activeSection === "prompts" && <PromptsView />}
        {activeSection === "exports" && <ExportsView />}
        {activeSection === "genie" && <GenieView />}
      </main>
    </div>
  );
}
