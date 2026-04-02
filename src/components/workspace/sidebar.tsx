"use client";

import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  FileText,
  FolderOpen,
  Download,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
  Wand2,
} from "lucide-react";
import { useState, useEffect } from "react";

export type SidebarSection = "generate" | "prompts" | "sources" | "exports" | "genie";

interface SidebarProps {
  active: SidebarSection;
  onNavigate: (section: SidebarSection) => void;
  forceCollapsed?: boolean;
}

const NAV_ITEMS: { id: SidebarSection; label: string; icon: React.ElementType }[] = [
  { id: "sources", label: "Sources", icon: FolderOpen },
  { id: "prompts", label: "Prompts", icon: FileText },
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "genie", label: "Genie", icon: Wand2 },
  { id: "exports", label: "Exports", icon: Download },
];

export function Sidebar({ active, onNavigate, forceCollapsed }: SidebarProps) {
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (forceCollapsed !== undefined) {
      setCollapsed(forceCollapsed);
    }
  }, [forceCollapsed]);

  return (
    <div
      className={`flex flex-col bg-card border-r transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="px-3 py-4 border-b flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Content Gen</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setCollapsed(!collapsed)}
          className={collapsed ? "mx-auto" : ""}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t px-2 py-3 space-y-1">
        {session?.user?.role === "admin" && (
          <a
            href="/admin"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Shield className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Admin</span>}
          </a>
        )}
        <div
          className={`flex items-center gap-3 px-3 py-2 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {!collapsed && (
            <span className="text-xs text-muted-foreground truncate flex-1">
              {session?.user?.name || session?.user?.email}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
