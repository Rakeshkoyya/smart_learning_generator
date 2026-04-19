"use client";

import { useState, useEffect } from "react";
import { Sidebar, type SidebarSection } from "@/components/workspace/sidebar";
import { GenerateView } from "@/components/workspace/generate-view";
import { PromptsView } from "@/components/workspace/prompts-view";
import { SourcesView } from "@/components/workspace/sources-view";
import { ExportsView } from "@/components/workspace/exports-view";
import { GenieView } from "@/components/workspace/genie/genie-view";
import { WorkflowView } from "@/components/workspace/workflow-view";
import { DocForgeView } from "@/components/workspace/docforge/docforge-view";
import { DocAgentView } from "@/components/workspace/docagent/docagent-view";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";

function WorkspaceContent() {
  const [activeSection, setActiveSection] = useState<SidebarSection>("generate");
  const { fetchAll } = useWorkspace();

  // Fetch all data on initial mount
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
        {activeSection === "workflows" && <WorkflowView />}
        {activeSection === "docforge" && <DocForgeView />}
        {activeSection === "docagent" && <DocAgentView />}
        {activeSection === "exports" && <ExportsView />}
        {activeSection === "genie" && <GenieView />}
      </main>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <WorkspaceProvider>
      <WorkspaceContent />
    </WorkspaceProvider>
  );
}
