import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Workspace = { id: string; name: string; owner_id: string; role?: string };

type Ctx = {
  workspaces: Workspace[];
  current: Workspace | null;
  loading: boolean;
  switchTo: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  refresh: () => Promise<void>;
};

const WorkspaceCtx = createContext<Ctx>({
  workspaces: [], current: null, loading: true,
  switchTo: async () => {}, createWorkspace: async () => null, refresh: async () => {},
});

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrent] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setWorkspaces([]); setCurrent(null); setLoading(false); return; }
    setLoading(true);
    const { data: members } = await supabase
      .from("workspace_members")
      .select("role, workspace_id, workspaces ( id, name, owner_id )")
      .eq("user_id", user.id);
    const list: Workspace[] = (members ?? [])
      .map((m: any) => m.workspaces ? { ...m.workspaces, role: m.role } : null)
      .filter(Boolean);
    setWorkspaces(list);
    const { data: prof } = await supabase.from("profiles").select("current_workspace_id").eq("id", user.id).maybeSingle();
    let cur = list.find(w => w.id === prof?.current_workspace_id) ?? list[0] ?? null;
    if (cur && cur.id !== prof?.current_workspace_id) {
      await supabase.from("profiles").update({ current_workspace_id: cur.id }).eq("id", user.id);
    }
    setCurrent(cur);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const switchTo = async (id: string) => {
    if (!user) return;
    await supabase.from("profiles").update({ current_workspace_id: id }).eq("id", user.id);
    const next = workspaces.find(w => w.id === id) ?? null;
    setCurrent(next);
  };

  const createWorkspace = async (name: string) => {
    if (!user) return null;
    const { data: ws, error } = await supabase.from("workspaces").insert({ name, owner_id: user.id }).select().maybeSingle();
    if (error || !ws) return null;
    await supabase.from("workspace_members").insert({ workspace_id: ws.id, user_id: user.id, role: "admin" as any });
    await refresh();
    await switchTo(ws.id);
    return ws as Workspace;
  };

  return (
    <WorkspaceCtx.Provider value={{ workspaces, current, loading, switchTo, createWorkspace, refresh }}>
      {children}
    </WorkspaceCtx.Provider>
  );
};

export const useWorkspace = () => useContext(WorkspaceCtx);
