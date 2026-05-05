import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Bug as BugIcon } from "lucide-react";
import { toast } from "sonner";

type Bug = { id: string; title: string; severity: string; priority: string; status: string; project_id: string };
type Project = { id: string; name: string };

const COLS = ["open", "in_progress", "resolved", "closed"];
const sevColor: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground",
};

export default function Bugs() {
  const { user } = useAuth();
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium", priority: "medium", project_id: "" });

  const load = async () => {
    const [b, p] = await Promise.all([
      supabase.from("bugs").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
    ]);
    setBugs(b.data ?? []); setProjects(p.data ?? []);
    if (p.data?.[0] && !form.project_id) setForm(f => ({ ...f, project_id: p.data![0].id }));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.project_id || !user) return toast.error("Title and project required");
    const { error } = await supabase.from("bugs").insert({ ...form, owner_id: user.id, severity: form.severity as any, priority: form.priority as any });
    if (error) return toast.error(error.message);
    toast.success("Bug logged");
    setOpen(false); setForm({ ...form, title: "", description: "" }); load();
  };

  const move = async (id: string, status: string) => {
    await supabase.from("bugs").update({ status: status as any }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bugs</h1>
          <p className="text-muted-foreground">Kanban view of issues across projects.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-hero border-0 gap-2" disabled={!projects.length}><Plus className="h-4 w-4" />New bug</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log a bug</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Project</Label>
                <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Severity</Label>
                  <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["low", "medium", "high", "critical"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["low", "medium", "high", "urgent"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={create} className="w-full bg-gradient-hero border-0">Log bug</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLS.map(col => (
          <div key={col} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-semibold capitalize text-sm">{col.replace("_", " ")}</h3>
              <Badge variant="secondary" className="text-[10px]">{bugs.filter(b => b.status === col).length}</Badge>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {bugs.filter(b => b.status === col).map(b => (
                <Card key={b.id} className="p-3 hover:shadow-elegant transition-all cursor-pointer">
                  <div className="flex items-start gap-2 mb-2">
                    <BugIcon className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="font-medium text-sm leading-tight">{b.title}</div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${sevColor[b.severity]}`}>{b.severity}</Badge>
                  <div className="flex gap-1 mt-2">
                    {COLS.filter(c => c !== col).map(c => (
                      <Button key={c} size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => move(b.id, c)}>{c.replace("_", " ")}</Button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
