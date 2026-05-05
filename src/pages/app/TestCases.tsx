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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type TC = { id: string; title: string; priority: string; type: string; status: string; project_id: string };
type Project = { id: string; name: string };

const priorityColor: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground",
};

export default function TestCases() {
  const { user } = useAuth();
  const [cases, setCases] = useState<TC[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", steps: "", expected_result: "", priority: "medium", type: "functional", project_id: "" });

  const load = async () => {
    const [tc, p] = await Promise.all([
      supabase.from("test_cases").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
    ]);
    setCases(tc.data ?? []); setProjects(p.data ?? []);
    if (p.data?.[0] && !form.project_id) setForm(f => ({ ...f, project_id: p.data![0].id }));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.project_id || !user) return toast.error("Title and project required");
    const { error } = await supabase.from("test_cases").insert({ ...form, owner_id: user.id, priority: form.priority as any, type: form.type as any });
    if (error) return toast.error(error.message);
    toast.success("Test case created");
    setOpen(false); setForm({ ...form, title: "", steps: "", expected_result: "" }); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("test_cases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Test Cases</h1>
          <p className="text-muted-foreground">Manage and version your test library.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2"><Link to="/app/ai"><Sparkles className="h-4 w-4 text-primary" />Generate with AI</Link></Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-hero border-0 hover:opacity-90 gap-2" disabled={!projects.length}><Plus className="h-4 w-4" />New case</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New test case</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Project</Label>
                  <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["low", "medium", "high", "critical"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["functional", "regression", "smoke", "integration", "performance", "security", "usability"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Steps</Label><Textarea rows={4} value={form.steps} onChange={e => setForm({ ...form, steps: e.target.value })} /></div>
                <div><Label>Expected result</Label><Textarea rows={2} value={form.expected_result} onChange={e => setForm({ ...form, expected_result: e.target.value })} /></div>
                <Button onClick={create} className="w-full bg-gradient-hero border-0">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        {cases.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {projects.length === 0 ? <>Create a <Link to="/app/projects" className="text-primary underline">project</Link> first.</> : "No test cases yet."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {cases.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={priorityColor[c.priority]}>{c.priority}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
