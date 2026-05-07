import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Input } from "@/components/ui/input";
import { Search, Sparkles } from "lucide-react";
import NotificationsBell from "@/components/NotificationsBell";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom";

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-subtle">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-background/80 backdrop-blur-sm flex items-center gap-3 px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="relative flex-1 max-w-xl">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search test cases, bugs, docs…" className="pl-9 h-9 bg-secondary/60 border-transparent focus-visible:bg-background" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <NavLink to="/app/ai"><Sparkles className="h-4 w-4 text-primary" /> AI</NavLink>
              </Button>
              <NotificationsBell />
            </div>
          </header>
          <main className="flex-1 p-6 min-w-0"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
