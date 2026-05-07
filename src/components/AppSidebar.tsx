import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, FileText, PlayCircle, Bug,
  BarChart3, Sparkles, BookOpen, GraduationCap, Plug, Settings, LogOut, TestTube2, MessageSquare, Database, Users
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const main = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, exact: true },
  { title: "Projects", url: "/app/projects", icon: FolderKanban },
  { title: "Test Cases", url: "/app/test-cases", icon: FileText },
  { title: "Test Runs", url: "/app/test-runs", icon: PlayCircle },
  { title: "Bugs", url: "/app/bugs", icon: Bug },
  { title: "Reports", url: "/app/reports", icon: BarChart3 },
];
const ai = [
  { title: "AI Assistant", url: "/app/ai", icon: Sparkles },
  { title: "Docs", url: "/app/docs", icon: BookOpen },
  { title: "Learning", url: "/app/learning", icon: GraduationCap },
];
const sys = [
  { title: "Master Data", url: "/app/master-data", icon: Database },
  { title: "Team", url: "/app/team", icon: Users },
  { title: "Integrations", url: "/app/integrations", icon: Plug },
  { title: "Enquiries", url: "/app/enquiries", icon: MessageSquare },
  { title: "Settings", url: "/app/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const isActive = (url: string, exact?: boolean) => exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const renderGroup = (label: string, items: typeof main) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                <NavLink to={item.url} end={item.exact} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <NavLink to="/app" className="flex items-center gap-2 px-2 py-1.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-hero grid place-items-center shadow-md">
            <TestTube2 className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-semibold text-sm leading-tight">TestFlow AI</div>
              <div className="text-[10px] text-muted-foreground">Test smarter. Release faster.</div>
            </div>
          )}
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Workspace", main)}
        {renderGroup("Intelligence", ai)}
        {renderGroup("System", sys)}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user?.email}</div>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start gap-2">
          <LogOut className="h-4 w-4" />{!collapsed && "Sign out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
