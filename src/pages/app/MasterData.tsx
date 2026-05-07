import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, Plus, Trash2, FolderKanban, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";

type Project = { id: string; name: string };
type Module = { id: string; name: string; project_id: string };
type Tag = { id: string; label: string; color: string };

export default function MasterData() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [newModule, setNewModule] = useState({ name: "", project_id: "" });
  const [newTag, setNewTag] = useState({ label: "", color: "primary" });

  const load = async () => {
    const [p, m, t] = await Promise.all([
      supabase.from("projects").select("id,name").order("name"),
      supabase.from("modules").select("id,name,project_id").order("name"),
      supabase.from("tags").select("id,label,color").order("label"),
    ]);
    setProjects(p.data ?? []);
    setModules(m.data ?? []);
    setTags((t.data ?? []) as any);
    if (p.data?.[0] && !newModule.project_id) setNewModule(s => ({ ...s, project_id: p.data![0].id }));
  };
  useEffect(() => { load(); }, []);

  const addModule = async () => {
    if (!user || !newModule.name || !newModule.project_id) return;
    const { error } = await supabase.from("modules").insert({ ...newModule, owner_id: user.id });
    if (error) return toast.error(error.message);
    setNewModule(s => ({ ...s, name: "" }));
    toast.success("Module added");
    load();
  };

  const delModule = async (id: string) => {
    await supabase.from("modules").delete().eq("id", id);
    load();
  };

  const addTag = async () => {
    if (!user || !newTag.label) return;
    const { error } = await supabase.from("tags").insert({ ...newTag, owner_id: user.id });
    if (error) return toast.error(error.message);
    setNewTag({ label: "", color: "primary" });
    load();
  };
  const delTag = async (id: string) => { await supabase.from("tags").delete().eq("id", id); load(); };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Database className="h-7 w-7 text-primary" />Master Data</h1>
        <p className="text-muted-foreground">Manage shared lookup data: modules and tags used across test cases & bugs.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4"><FolderKanban className="h-4 w-4 text-primary" /><h2 className="font-semibold">Modules</h2></div>
        <div className="flex gap-2 items-end mb-4">
          <div className="flex-1"><Label>Name</Label><Input value={newModule.name} onChange={e => setNewModule({ ...newModule, name: e.target.value })} placeholder="Authentication" /></div>
          <div className="w-56"><Label>Project</Label>
            <Select value={newModule.project_id} onValueChange={v => setNewModule({ ...newModule, project_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={addModule} className="gap-2"><Plus className="h-4 w-4" />Add</Button>
        </div>
        <div className="space-y-1">
          {projects.map(p => {
            const list = modules.filter(m => m.project_id === p.id);
            if (!list.length) return null;
            return (
              <div key={p.id} className="border rounded-lg p-3">
                <div className="text-xs font-semibold text-muted-foreground mb-2">{p.name}</div>
                <div className="flex flex-wrap gap-2">
                  {list.map(m => (
                    <Badge key={m.id} variant="secondary" className="gap-1.5 pr-1">
                      {m.name}
                      <button onClick={() => delModule(m.id)} className="hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
          {!modules.length && <p className="text-sm text-muted-foreground">No modules yet.</p>}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4"><TagIcon className="h-4 w-4 text-primary" /><h2 className="font-semibold">Tags</h2></div>
        <div className="flex gap-2 items-end mb-4">
          <div className="flex-1"><Label>Label</Label><Input value={newTag.label} onChange={e => setNewTag({ ...newTag, label: e.target.value })} placeholder="regression" /></div>
          <div className="w-40"><Label>Color</Label>
            <Select value={newTag.color} onValueChange={v => setNewTag({ ...newTag, color: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["primary", "secondary", "destructive", "warning", "success"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={addTag} className="gap-2"><Plus className="h-4 w-4" />Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map(t => (
            <Badge key={t.id} variant="outline" className="gap-1.5 pr-1">
              {t.label}
              <button onClick={() => delTag(t.id)} className="hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </Badge>
          ))}
          {!tags.length && <p className="text-sm text-muted-foreground">No tags yet.</p>}
        </div>
      </Card>
    </div>
  );
}
