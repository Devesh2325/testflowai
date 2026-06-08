import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, PlayCircle, CheckCircle2, XCircle, MinusCircle, ChevronRight, ChevronDown, Bug, Check, Trash2, Sparkles, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Run = { id: string; name: string; status: string; project_id: string; created_at: string };
type Project = { id: string; name: string };
type Module = { id: string; name: string; project_id: string };
type TC = { id: string; title: string; module_id: string | null; steps: string | null; expected_result: string | null };
type Exec = { id: string; status: string; test_case_id: string; notes: string | null; browser: string | null; device: string | null };
type BugRow = { id: string; title: string; severity: string; status: string; linked_test_case: string | null; run_id: string | null };

const STATUSES = ["not_run", "pass", "fail", "blocked", "skipped"];
const SEVERITIES = ["low", "medium", "high", "critical"];

const statusColor: Record<string, string> = {
  pass: "bg-success/15 text-success",
  fail: "bg-destructive/15 text-destructive",
  blocked: "bg-warning/15 text-warning",
  skipped: "bg-muted text-muted-foreground",
  not_run: "bg-muted text-muted-foreground",
};

export default function TestRuns() {
  const { user } = useAuth();
  const { current: ws } = useWorkspace();
  const [runs, setRuns] = useState<Run[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [cases, setCases] = useState<TC[]>([]);
  const [bugs, setBugs] = useState<BugRow[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [executions, setExecutions] = useState<Exec[]>([]);
  const [filterModule, setFilterModule] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [bugOpen, setBugOpen] = useState<Exec | null>(null);
  const [bugForm, setBugForm] = useState({ title: "", description: "", severity: "medium" });
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const runSummary = async () => {
    if (!activeRun) return;
    setSummaryLoading(true); setSummaryOpen(true); setSummary(null);
    const { data, error } = await supabase.functions.invoke("summarize-test-run", { body: { run_id: activeRun.id } });
    setSummaryLoading(false);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    setSummary(data?.summary ?? "No summary generated.");
  };

  const load = async () => {
    const [r, p, m, c, b] = await Promise.all([
      supabase.from("test_runs").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
      supabase.from("modules").select("id,name,project_id"),
      supabase.from("test_cases").select("id,title,module_id,steps,expected_result"),
      supabase.from("bugs").select("id,title,severity,status,linked_test_case,run_id"),
    ]);
    setRuns(r.data ?? []); setProjects(p.data ?? []); setModules(m.data ?? []);
    setCases((c.data ?? []) as any); setBugs((b.data ?? []) as any);
    if (p.data?.[0] && !projectId) setProjectId(p.data[0].id);
  };
  useEffect(() => { load(); }, []);

  const loadExecs = async (run: Run) => {
    setActiveRun(run);
    const { data } = await supabase.from("test_executions").select("*").eq("run_id", run.id).order("created_at");
    setExecutions((data as any) ?? []);
  };

  const flash = (id: string) => { setSavedFlash(id); setTimeout(() => setSavedFlash(s => s === id ? null : s), 1000); };

  const create = async () => {
    if (!name || !projectId || !user || !ws) return;
    const { data: run, error } = await supabase.from("test_runs").insert({ name, project_id: projectId, owner_id: user.id, workspace_id: ws.id }).select().single();
    if (error) return toast.error(error.message);
    const { data: cs } = await supabase.from("test_cases").select("id").eq("project_id", projectId);
    if (cs?.length) {
      await supabase.from("test_executions").insert(cs.map(c => ({ run_id: run.id, test_case_id: c.id, owner_id: user.id, workspace_id: ws.id })));
    }
    toast.success("Run created with " + (cs?.length || 0) + " cases");
    setOpen(false); setName(""); load();
  };

  const updateExec = async (id: string, patch: Partial<Exec>) => {
    setExecutions(es => es.map(e => e.id === id ? { ...e, ...patch } : e));
    const fullPatch: any = { ...patch };
    if (patch.status && patch.status !== "not_run") fullPatch.executed_at = new Date().toISOString();
    const { error } = await supabase.from("test_executions").update(fullPatch).eq("id", id);
    if (error) return toast.error(error.message);
    flash(id);
  };

  const updateRunStatus = async (id: string, status: string) => {
    setRuns(rs => rs.map(r => r.id === id ? { ...r, status } : r));
    await supabase.from("test_runs").update({ status }).eq("id", id);
  };

  const deleteRun = async (id: string) => {
    if (!confirm("Delete this run and all its executions?")) return;
    await supabase.from("test_executions").delete().eq("run_id", id);
    await supabase.from("bugs").update({ run_id: null }).eq("run_id", id);
    await supabase.from("test_runs").delete().eq("id", id);
    setRuns(rs => rs.filter(r => r.id !== id));
    toast.success("Run deleted");
  };

  const openBug = (e: Exec) => {
    const tc = cases.find(c => c.id === e.test_case_id);
    setBugForm({ title: `${tc?.title ?? "Test"} failed`, description: e.notes ?? "", severity: "medium" });
    setBugOpen(e);
  };

  const fileBug = async () => {
    if (!bugOpen || !user || !activeRun) return;
    const { error } = await supabase.from("bugs").insert({
      title: bugForm.title, description: bugForm.description,
      severity: bugForm.severity as any, priority: "medium" as any, status: "open" as any,
      project_id: activeRun.project_id, owner_id: user.id,
      run_id: activeRun.id, linked_test_case: bugOpen.test_case_id,
    });
    if (error) return toast.error(error.message);
    toast.success("Bug filed");
    setBugOpen(null); load();
  };

  // -------- Detail view --------
  if (activeRun) {
    const projectModules = modules.filter(m => m.project_id === activeRun.project_id);
    const filtered = executions.filter(e => {
      const tc = cases.find(c => c.id === e.test_case_id);
      if (filterModule !== "all" && (filterModule === "none" ? tc?.module_id : tc?.module_id !== filterModule)) return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      return true;
    });
    const counts = executions.reduce((acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }), {} as Record<string, number>);
    const total = executions.length;
    const passRate = total ? Math.round(((counts.pass ?? 0) / total) * 100) : 0;

    return (
      <div className="space-y-4 max-w-[1400px]">
        <Button variant="ghost" onClick={() => { setActiveRun(null); load(); }}>← Back to runs</Button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">{activeRun.name}</h1>
            <p className="text-muted-foreground text-sm">Pass {counts.pass ?? 0} · Fail {counts.fail ?? 0} · Blocked {counts.blocked ?? 0} · Not run {counts.not_run ?? 0} · {passRate}% pass</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={runSummary} disabled={summaryLoading}>
              {summaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
              AI summary
            </Button>
            <Select value={activeRun.status} onValueChange={v => { setActiveRun({ ...activeRun, status: v }); updateRunStatus(activeRun.id, v); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="aborted">Aborted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="p-3 flex flex-wrap items-center gap-2">
          <Select value={filterModule} onValueChange={setFilterModule}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              <SelectItem value="none">No module</SelectItem>
              {projectModules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {total}</div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-background z-10 border-b">
                <tr className="text-left text-xs font-medium text-muted-foreground">
                  <th className="p-2" style={{ minWidth: 280 }}>Test Case</th>
                  <th className="p-2" style={{ minWidth: 140 }}>Module</th>
                  <th className="p-2" style={{ minWidth: 140 }}>Status</th>
                  <th className="p-2" style={{ minWidth: 120 }}>Browser</th>
                  <th className="p-2" style={{ minWidth: 120 }}>Device</th>
                  <th className="p-2" style={{ minWidth: 200 }}>Notes</th>
                  <th className="p-2" style={{ minWidth: 200 }}>Bugs</th>
                  <th className="p-2 w-20">Saved</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const tc = cases.find(c => c.id === e.test_case_id);
                  const mod = tc ? modules.find(m => m.id === tc.module_id) : null;
                  const linked = bugs.filter(b => b.linked_test_case === e.test_case_id && (b.run_id === activeRun.id || !b.run_id));
                  return (
                    <tr key={e.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 align-top font-medium">{tc?.title ?? "—"}</td>
                      <td className="p-2 align-top text-xs text-muted-foreground">{mod?.name ?? "—"}</td>
                      <td className="p-2 align-top">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className={`h-7 px-2 ${e.status === "pass" ? "bg-success/15 text-success" : ""}`} onClick={() => updateExec(e.id, { status: "pass" })}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className={`h-7 px-2 ${e.status === "fail" ? "bg-destructive/15 text-destructive" : ""}`} onClick={() => updateExec(e.id, { status: "fail" })}><XCircle className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className={`h-7 px-2 ${e.status === "blocked" ? "bg-warning/15 text-warning" : ""}`} onClick={() => updateExec(e.id, { status: "blocked" })}><MinusCircle className="h-3.5 w-3.5" /></Button>
                          <Badge variant="outline" className={`ml-1 text-xs ${statusColor[e.status]}`}>{e.status}</Badge>
                        </div>
                      </td>
                      <td className="p-2 align-top">
                        <Input data-cell={`${e.id}-browser`} defaultValue={e.browser ?? ""} placeholder="Chrome"
                          onBlur={ev => ev.target.value !== (e.browser ?? "") && updateExec(e.id, { browser: ev.target.value })}
                          className="h-8 text-xs border-transparent hover:border-input focus-visible:ring-1" />
                      </td>
                      <td className="p-2 align-top">
                        <Input defaultValue={e.device ?? ""} placeholder="Desktop"
                          onBlur={ev => ev.target.value !== (e.device ?? "") && updateExec(e.id, { device: ev.target.value })}
                          className="h-8 text-xs border-transparent hover:border-input focus-visible:ring-1" />
                      </td>
                      <td className="p-2 align-top">
                        <Textarea defaultValue={e.notes ?? ""} rows={1} placeholder="Notes…"
                          onBlur={ev => ev.target.value !== (e.notes ?? "") && updateExec(e.id, { notes: ev.target.value })}
                          className="min-h-[2rem] text-xs border-transparent hover:border-input focus-visible:ring-1 resize-y" />
                      </td>
                      <td className="p-2 align-top">
                        <div className="flex flex-wrap gap-1 items-center">
                          {linked.map(b => (
                            <Link key={b.id} to="/app/bugs" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-destructive/10 text-destructive hover:bg-destructive/20">
                              <Bug className="h-3 w-3" />{b.title.slice(0, 24)}
                            </Link>
                          ))}
                          <Button size="sm" variant="ghost" className="h-6 px-1 text-xs gap-1" onClick={() => openBug(e)}>
                            <Plus className="h-3 w-3" />File bug
                          </Button>
                        </div>
                      </td>
                      <td className="p-2 align-top text-xs text-muted-foreground">
                        {savedFlash === e.id && <span className="inline-flex items-center gap-1 text-success"><Check className="h-3 w-3" />Saved</span>}
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">No executions match filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* File bug dialog */}
        <Dialog open={!!bugOpen} onOpenChange={v => !v && setBugOpen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>File bug</DialogTitle><DialogDescription>Linked to this run and test case.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={bugForm.title} onChange={e => setBugForm({ ...bugForm, title: e.target.value })} /></div>
              <div><Label>Severity</Label>
                <Select value={bugForm.severity} onValueChange={v => setBugForm({ ...bugForm, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Textarea rows={4} value={bugForm.description} onChange={e => setBugForm({ ...bugForm, description: e.target.value })} /></div>
              <Button onClick={fileBug} className="w-full bg-gradient-hero border-0">Create bug</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* AI summary dialog */}
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />AI test run summary</DialogTitle>
              <DialogDescription>Generated from this run's executions, failures, and linked bugs.</DialogDescription>
            </DialogHeader>
            {summaryLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" />Analyzing run...</div>
            ) : (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">{summary}</div>
            )}
            {summary && (
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(summary); toast.success("Copied"); }}>Copy</Button>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // -------- List view --------
  const runStats = (runId: string) => bugs.filter(b => b.run_id === runId).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Test Runs</h1>
          <p className="text-muted-foreground">Execute test cases in cycles. Inline edit, link bugs.</p>
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
          {runs.map(r => {
            const project = projects.find(p => p.id === r.project_id);
            const bugCount = runStats(r.id);
            return (
              <Card key={r.id} className="p-4 flex items-center hover:shadow-elegant">
                <PlayCircle className="h-5 w-5 text-primary mr-3" />
                <div className="flex-1 cursor-pointer" onClick={() => loadExecs(r)}>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{project?.name} · {new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                {bugCount > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive mr-2 gap-1"><Bug className="h-3 w-3" />{bugCount}</Badge>}
                <Badge variant="secondary" className="mr-2">{r.status}</Badge>
                <Button size="icon" variant="ghost" onClick={() => deleteRun(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                <ChevronRight className="h-4 w-4 ml-2 text-muted-foreground cursor-pointer" onClick={() => loadExecs(r)} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
