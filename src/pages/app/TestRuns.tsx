import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, PlayCircle, CheckCircle2, XCircle, MinusCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Run = { id: string; name: string; status: string; project_id: string; created_at: string };
type Project = { id: string; name: string };
type Exec = { id: string; status: string; test_case_id: string; test_cases?: { title: string } };

export default function TestRuns() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [executions, setExecutions] = useState<Exec[]>([]);

  const load = async () => {
    const [r, p] = await Promise.all([
      supabase.from("test_runs").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
    ]);
    setRuns(r.data ?? []); setProjects(p.data ?? []);
    if (p.data?.[0] && !projectId) setProjectId(p.data[0].id);
  };
  useEffect(() => { load(); }, []);

  const loadExecs = async (run: Run) => {
    setActiveRun(run);
    const { data } = await supabase.from("test_executions").select("*, test_cases(title)").eq("run_id", run.id);
    setExecutions((data as any) ?? []);
  };

  const create = async () => {
    if (!name || !projectId || !user) return;
    const { data: run, error } = await supabase.from("test_runs").insert({ name, project_id: projectId, owner_id: user.id }).select().single();
    if (error) return toast.error(error.message);
    const { data: cases } = await supabase.from("test_cases").select("id").eq("project_id", projectId);
    if (cases?.length) {
      await supabase.from("test_executions").insert(cases.map(c => ({ run_id: run.id, test_case_id: c.id, owner_id: user.id })));
    }
    toast.success("Run created with " + (cases?.length || 0) + " cases");
    setOpen(false); setName(""); load();
  };

  const updateStatus = async (id: string, status: "pass" | "fail" | "blocked") => {
    await supabase.from("test_executions").update({ status, executed_at: new Date().toISOString() }).eq("id", id);
    if (activeRun) loadExecs(activeRun);
  };

  if (activeRun) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Button variant="ghost" onClick={() => setActiveRun(null)}>← Back to runs</Button>
        <h1 className="text-2xl font-bold">{activeRun.name}</h1>
        <Card>
          {executions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No test cases in this run.</div>
          ) : executions.map(e => (
            <div key={e.id} className="flex items-center gap-3 p-4 border-b last:border-0">
              <div className="flex-1 font-medium">{e.test_cases?.title}</div>
              <Badge variant="outline">{e.status}</Badge>
              <Button size="sm" variant="outline" className="text-success" onClick={() => updateStatus(e.id, "pass")}><CheckCircle2 className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus(e.id, "fail")}><XCircle className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus(e.id, "blocked")}><MinusCircle className="h-4 w-4" /></Button>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Test Runs</h1>
          <p className="text-muted-foreground">Execute test cases in cycles.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-hero border-0 gap-2" disabled={!projects.length}><Plus className="h-4 w-4" />New run</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New test run</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Run name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sprint 12 regression" /></div>
              <Button onClick={create} className="w-full bg-gradient-hero border-0">Create run</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {runs.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card">
          <PlayCircle className="h-10 w-10 mx-auto text-primary mb-3" />
          <p className="text-muted-foreground">No runs yet. Create one to start executing.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {runs.map(r => (
            <Card key={r.id} className="p-4 flex items-center hover:shadow-elegant cursor-pointer" onClick={() => loadExecs(r)}>
              <PlayCircle className="h-5 w-5 text-primary mr-3" />
              <div className="flex-1">
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <Badge variant="secondary">{r.status}</Badge>
              <ChevronRight className="h-4 w-4 ml-3 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
