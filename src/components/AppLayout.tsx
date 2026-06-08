import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Sparkles } from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationsBell from "@/components/NotificationsBell";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "@/hooks/useWorkspace";
import ThemeToggle from "@/components/ThemeToggle";

function WorkspaceScopedOutlet() {
  const { current } = useWorkspace();
  // Remount all child pages when active workspace changes — clears local state & refetches data
  return <main key={current?.id ?? "no-ws"} className="flex-1 p-6 min-w-0"><Outlet /></main>;
}

export default function AppLayout() {
  return (
    <WorkspaceProvider>
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-subtle">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-background/80 backdrop-blur-sm flex items-center gap-3 px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-2">
              <WorkspaceSwitcher />
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <NavLink to="/app/ai"><Sparkles className="h-4 w-4 text-primary" /> AI</NavLink>
              </Button>
              <ThemeToggle />
              <NotificationsBell />
            </div>
          </header>
          <WorkspaceScopedOutlet />
        </div>
      </div>
    </SidebarProvider>
    </WorkspaceProvider>
  );
}
