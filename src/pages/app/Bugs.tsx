import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Bug as BugIcon, Paperclip, X, Send, Image as ImageIcon, Trash2, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Attachment = { name: string; path: string; url: string; type: string };
type Bug = {
  id: string; title: string; description: string | null; severity: string; priority: string; status: string;
  project_id: string; module_id: string | null; linked_test_case: string | null;
  steps_to_reproduce: string | null; expected_result: string | null; actual_result: string | null;
  environment: string | null; browser: string | null; device: string | null; app_version: string | null;
  assignee_email: string | null; reporter_email: string | null;
  attachments: Attachment[]; tags: string[]; created_at: string; updated_at: string;
};
type Project = { id: string; name: string };
type Module = { id: string; name: string; project_id: string };
type TC = { id: string; title: string; project_id: string };
type Comment = { id: string; body: string; author_email: string | null; created_at: string };

const COLS = ["open", "in_progress", "resolved", "closed"];
const sevColor: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground",
};

type Member = { user_id: string; email: string | null; full_name: string | null };

const cap = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export default function Bugs() {
  const { user } = useAuth();
  const { current: ws } = useWorkspace();
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [tcs, setTCs] = useState<TC[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Bug | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    title: "", description: "", severity: "medium", priority: "medium",
    project_id: "", module_id: "", linked_test_case: "",
    steps_to_reproduce: "", expected_result: "", actual_result: "",
    environment: "", browser: "", device: "", app_version: "",
    assignee_email: "", reporter_email: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRefDetail = useRef<HTMLInputElement>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [dupes, setDupes] = useState<Bug[]>([]);

  const findDuplicates = (title: string, desc: string, projectId: string): Bug[] => {
    const tokens = new Set(
      `${title} ${desc}`.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(t => t.length > 3)
    );
    if (tokens.size === 0) return [];
    return bugs
      .filter(b => b.project_id === projectId && b.status !== "closed")
      .map(b => {
        const bt = new Set(`${b.title} ${b.description ?? ""}`.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(t => t.length > 3));
        let overlap = 0;
        tokens.forEach(t => bt.has(t) && overlap++);
        const score = overlap / Math.max(tokens.size, 1);
        return { b, score };
      })
      .filter(x => x.score >= 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => x.b);
  };

  const memberLabel = (em: string | null | undefined) => {
    if (!em) return "—";
    const m = members.find(x => x.email?.toLowerCase() === em.toLowerCase());
    return m?.full_name || m?.email || em;
  };

  const autofillFromTC = (tcId: string) => {
    const tc = tcs.find(t => t.id === tcId);
    if (!tc) return;
    setForm((f: any) => ({
      ...f, linked_test_case: tcId,
      title: f.title || `Bug in: ${tc.title}`,
      description: f.description || `Issue found while executing test case "${tc.title}".`,
    }));
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return toast.error("Describe the bug first");
    setAiLoading(true);
    const tc = tcs.find(t => t.id === form.linked_test_case);
    const { data, error } = await supabase.functions.invoke("generate-bug", {
      body: { description: aiPrompt, test_case_title: tc?.title },
    });
    setAiLoading(false);
    if (error) return toast.error(error.message);
    const b = data?.bug ?? {};
    setForm((f: any) => ({
      ...f,
      title: b.title || f.title,
      description: b.description || f.description,
      severity: b.severity || f.severity,
      priority: b.priority || f.priority,
      steps_to_reproduce: b.steps_to_reproduce || f.steps_to_reproduce,
      expected_result: b.expected_result || f.expected_result,
      actual_result: b.actual_result || f.actual_result,
      environment: b.environment || f.environment,
      browser: b.browser || f.browser,
      device: b.device || f.device,
      app_version: b.app_version || f.app_version,
    }));
    toast.success("AI filled the form — review & submit");
  };

  const load = async () => {
    const [b, p, m, t, prof] = await Promise.all([
      supabase.from("bugs").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
      supabase.from("modules").select("id,name,project_id"),
      supabase.from("test_cases").select("id,title,project_id"),
      supabase.from("profiles").select("id,current_workspace_id").eq("id", user?.id ?? "").maybeSingle(),
    ]);
    setBugs((b.data ?? []) as any);
    setProjects(p.data ?? []);
    setModules(m.data ?? []);
    setTCs(t.data ?? []);
    if (p.data?.[0] && !form.project_id) setForm((f: any) => ({ ...f, project_id: p.data![0].id }));
    const wsId = (prof.data as any)?.current_workspace_id;
    if (wsId) {
      const { data: wms } = await supabase.from("workspace_members").select("user_id").eq("workspace_id", wsId);
      const ids = (wms ?? []).map((x: any) => x.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,email,full_name").in("id", ids);
        setMembers((profs ?? []).map((p: any) => ({ user_id: p.id, email: p.email, full_name: p.full_name })));
      }
    }
  };
  useEffect(() => { load(); }, [user?.id]);

  const loadComments = async (bugId: string) => {
    const { data } = await supabase.from("bug_comments").select("*").eq("bug_id", bugId).order("created_at");
    setComments((data ?? []) as any);
  };

  const openDetail = async (b: Bug) => { setActive(b); await loadComments(b.id); };

  const uploadFiles = async (files: FileList | null): Promise<Attachment[]> => {
    if (!files || !user) return [];
    const out: Attachment[] = [];
    for (const file of Array.from(files)) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("bug-attachments").upload(path, file);
      if (error) { toast.error(`Upload failed: ${file.name}`); continue; }
      const { data: signed } = await supabase.storage.from("bug-attachments").createSignedUrl(path, 60 * 60 * 24 * 30);
      out.push({ name: file.name, path, url: signed?.signedUrl ?? "", type: file.type });
    }
    return out;
  };

  const create = async () => {
    if (!form.title || !form.project_id || !user) return toast.error("Title and project required");
    const atts = await uploadFiles(fileRef.current?.files ?? null);
    const payload: any = {
      ...form, owner_id: user.id, attachments: atts,
      module_id: form.module_id || null, linked_test_case: form.linked_test_case || null,
      reporter_email: form.reporter_email || user.email,
    };
    const { error } = await supabase.from("bugs").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Bug logged");
    setOpen(false);
    setForm({ ...form, title: "", description: "", steps_to_reproduce: "", expected_result: "", actual_result: "" });
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const updateBug = async (id: string, patch: Partial<Bug>) => {
    const { error } = await supabase.from("bugs").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    setBugs(s => s.map(b => b.id === id ? { ...b, ...patch } as Bug : b));
    if (active?.id === id) setActive(a => a ? { ...a, ...patch } as Bug : a);
  };

  const move = async (id: string, status: string) => updateBug(id, { status });

  const addAttachments = async (files: FileList | null) => {
    if (!active) return;
    const newOnes = await uploadFiles(files);
    if (!newOnes.length) return;
    const merged = [...(active.attachments ?? []), ...newOnes];
    await updateBug(active.id, { attachments: merged });
    toast.success(`Added ${newOnes.length} file(s)`);
    if (fileRefDetail.current) fileRefDetail.current.value = "";
  };

  const removeAttachment = async (att: Attachment) => {
    if (!active) return;
    await supabase.storage.from("bug-attachments").remove([att.path]);
    await updateBug(active.id, { attachments: active.attachments.filter(a => a.path !== att.path) });
  };

  const addComment = async () => {
    if (!active || !newComment.trim() || !user) return;
    if (!ws) return;
    const { error } = await supabase.from("bug_comments").insert({
      bug_id: active.id, owner_id: user.id, author_email: user.email, body: newComment.trim(),
      workspace_id: ws.id,
    });
    if (error) return toast.error(error.message);
    setNewComment(""); loadComments(active.id);
  };

  const deleteBug = async (id: string) => {
    if (!confirm("Delete this bug?")) return;
    await supabase.from("bugs").delete().eq("id", id);
    setActive(null); load();
  };

  const moduleMap = useMemo(() => Object.fromEntries(modules.map(m => [m.id, m.name])), [modules]);
  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p.name])), [projects]);
  const tcMap = useMemo(() => Object.fromEntries(tcs.map(t => [t.id, t.title])), [tcs]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bugs</h1>
          <p className="text-muted-foreground">Detailed bug tracking with attachments, environment & comments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-hero border-0 gap-2" disabled={!projects.length}><Plus className="h-4 w-4" />New bug</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Log a bug</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" />Generate with AI</div>
                <Textarea rows={2} placeholder="Describe what went wrong, e.g. 'Login button not responding on Safari iOS 17 after entering credentials…'" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                <Button size="sm" onClick={generateWithAI} disabled={aiLoading} className="gap-2">
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {aiLoading ? "Generating…" : "Auto-fill form"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Project</Label>
                  <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v, module_id: "", linked_test_case: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Module</Label>
                  <Select value={form.module_id} onValueChange={v => setForm({ ...form, module_id: v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{modules.filter(m => m.project_id === form.project_id).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description / Summary</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Severity</Label>
                  <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["low", "medium", "high", "critical"].map(p => <SelectItem key={p} value={p}>{cap(p)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["low", "medium", "high", "urgent"].map(p => <SelectItem key={p} value={p}>{cap(p)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Linked Test Case</Label>
                  <Select value={form.linked_test_case} onValueChange={autofillFromTC}>
                    <SelectTrigger><SelectValue placeholder="Select test case" /></SelectTrigger>
                    <SelectContent>
                      {tcs.filter(t => t.project_id === form.project_id).length === 0
                        ? <div className="px-2 py-1.5 text-xs text-muted-foreground">No test cases for this project</div>
                        : tcs.filter(t => t.project_id === form.project_id).map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Steps to reproduce</Label><Textarea rows={3} placeholder="1. Open app&#10;2. Click login&#10;3. ..." value={form.steps_to_reproduce} onChange={e => setForm({ ...form, steps_to_reproduce: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Expected result</Label><Textarea rows={2} value={form.expected_result} onChange={e => setForm({ ...form, expected_result: e.target.value })} /></div>
                <div><Label>Actual result</Label><Textarea rows={2} value={form.actual_result} onChange={e => setForm({ ...form, actual_result: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><Label>Environment</Label><Input placeholder="staging" value={form.environment} onChange={e => setForm({ ...form, environment: e.target.value })} /></div>
                <div><Label>Browser</Label><Input placeholder="Chrome 130" value={form.browser} onChange={e => setForm({ ...form, browser: e.target.value })} /></div>
                <div><Label>Device</Label><Input placeholder="iPhone 15" value={form.device} onChange={e => setForm({ ...form, device: e.target.value })} /></div>
                <div><Label>App version</Label><Input placeholder="1.4.2" value={form.app_version} onChange={e => setForm({ ...form, app_version: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Assign To (User Name)</Label>
                  <Select value={form.assignee_email || "__none__"} onValueChange={v => setForm({ ...form, assignee_email: v === "__none__" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {members.map(m => <SelectItem key={m.user_id} value={m.email ?? m.user_id}>{m.full_name || m.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Reported By (User Name)</Label>
                  <Select value={form.reporter_email || user?.email || ""} onValueChange={v => setForm({ ...form, reporter_email: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {members.map(m => <SelectItem key={m.user_id} value={m.email ?? m.user_id}>{m.full_name || m.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-2"><Paperclip className="h-3 w-3" />Attachments (images / files)</Label>
                <Input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.log,.json" />
              </div>
              <Button onClick={create} className="w-full bg-gradient-hero border-0">Log bug</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLS.map(col => (
          <div
            key={col}
            className={`space-y-2 rounded-lg p-2 transition-colors ${dragOver === col ? "bg-primary/10 ring-2 ring-primary/40" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragOver(col); }}
            onDragLeave={() => setDragOver(d => (d === col ? null : d))}
            onDrop={async e => {
              e.preventDefault();
              setDragOver(null);
              if (dragId) { await move(dragId, col); setDragId(null); }
            }}
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="font-semibold capitalize text-sm">{col.replace("_", " ")}</h3>
              <Badge variant="secondary" className="text-[10px]">{bugs.filter(b => b.status === col).length}</Badge>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {bugs.filter(b => b.status === col).map(b => (
                <Card
                  key={b.id}
                  draggable
                  onDragStart={() => setDragId(b.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`p-3 hover:shadow-elegant transition-all cursor-grab active:cursor-grabbing ${dragId === b.id ? "opacity-50" : ""}`}
                  onClick={() => openDetail(b)}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <BugIcon className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="font-medium text-sm leading-tight flex-1">{b.title}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    <Badge variant="outline" className={`text-[10px] ${sevColor[b.severity]}`}>{cap(b.severity)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{cap(b.priority)}</Badge>
                    {b.module_id && moduleMap[b.module_id] && <Badge variant="outline" className="text-[10px]">{moduleMap[b.module_id]}</Badge>}
                    {b.attachments?.length > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Paperclip className="h-2.5 w-2.5" />{b.attachments.length}</Badge>}
                  </div>
                  {b.assignee_email && (
                    <div className="text-[11px] text-muted-foreground mb-1">Assigned: <span className="text-foreground font-medium">{memberLabel(b.assignee_email)}</span></div>
                  )}
                  <div className="flex gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                    {COLS.filter(c => c !== col).map(c => (
                      <Button key={c} size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => move(b.id, c)}>{cap(c)}</Button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2"><BugIcon className="h-5 w-5 text-destructive" />{active.title}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={sevColor[active.severity]}>Severity: {cap(active.severity)}</Badge>
                  <Badge variant="outline">Priority: {cap(active.priority)}</Badge>
                  <Badge variant="outline">{projectMap[active.project_id]}</Badge>
                  {active.module_id && <Badge variant="outline">{moduleMap[active.module_id]}</Badge>}
                  {active.linked_test_case && <Badge variant="outline">TC: {tcMap[active.linked_test_case]}</Badge>}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Status</Label>
                    <Select value={active.status} onValueChange={v => updateBug(active.id, { status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{COLS.map(c => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Severity</Label>
                    <Select value={active.severity} onValueChange={v => updateBug(active.id, { severity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["low", "medium", "high", "critical"].map(p => <SelectItem key={p} value={p}>{cap(p)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Priority</Label>
                    <Select value={active.priority} onValueChange={v => updateBug(active.id, { priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["low", "medium", "high", "urgent"].map(p => <SelectItem key={p} value={p}>{cap(p)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Assign To (User Name)</Label>
                    <Select value={active.assignee_email || "__none__"} onValueChange={v => updateBug(active.id, { assignee_email: v === "__none__" ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {members.map(m => <SelectItem key={m.user_id} value={m.email ?? m.user_id}>{m.full_name || m.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Linked Test Case</Label>
                    <Select value={active.linked_test_case || "__none__"} onValueChange={v => updateBug(active.id, { linked_test_case: v === "__none__" ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {tcs.filter(t => t.project_id === active.project_id).map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {active.description && <Section label="Description"><p className="text-sm whitespace-pre-wrap">{active.description}</p></Section>}
                {active.steps_to_reproduce && <Section label="Steps to reproduce"><pre className="text-sm whitespace-pre-wrap font-sans">{active.steps_to_reproduce}</pre></Section>}
                <div className="grid grid-cols-2 gap-3">
                  {active.expected_result && <Section label="Expected"><p className="text-sm whitespace-pre-wrap">{active.expected_result}</p></Section>}
                  {active.actual_result && <Section label="Actual"><p className="text-sm whitespace-pre-wrap">{active.actual_result}</p></Section>}
                </div>

                <Section label="Environment">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <KV k="Environment" v={active.environment} />
                    <KV k="Browser" v={active.browser} />
                    <KV k="Device" v={active.device} />
                    <KV k="Version" v={active.app_version} />
                    <KV k="Assigned User" v={memberLabel(active.assignee_email)} />
                    <KV k="Reported By" v={memberLabel(active.reporter_email)} />
                  </div>
                </Section>

                <Section label={`Attachments (${active.attachments?.length ?? 0})`}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(active.attachments ?? []).map(a => (
                      <div key={a.path} className="border rounded-lg p-2 group relative">
                        {a.type?.startsWith("image/") ? (
                          <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name} className="w-full h-24 object-cover rounded" /></a>
                        ) : (
                          <a href={a.url} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center h-24 text-xs gap-1 text-muted-foreground">
                            <ImageIcon className="h-6 w-6" /><span className="truncate w-full text-center">{a.name}</span>
                          </a>
                        )}
                        <button onClick={() => removeAttachment(a)} className="absolute top-1 right-1 bg-background/90 rounded p-1 opacity-0 group-hover:opacity-100">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input ref={fileRefDetail} type="file" multiple accept="image/*,.pdf,.txt,.log,.json" onChange={e => addAttachments(e.target.files)} className="text-xs" />
                  </div>
                </Section>

                <Section label={`Comments (${comments.length})`}>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {comments.map(c => (
                      <div key={c.id} className="text-sm border-l-2 border-primary/40 pl-3 py-1">
                        <div className="text-xs text-muted-foreground">{c.author_email} · {new Date(c.created_at).toLocaleString()}</div>
                        <div className="whitespace-pre-wrap">{c.body}</div>
                      </div>
                    ))}
                    {!comments.length && <p className="text-xs text-muted-foreground">No comments yet.</p>}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Textarea rows={2} value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment…" />
                    <Button size="icon" onClick={addComment}><Send className="h-4 w-4" /></Button>
                  </div>
                </Section>

                <Separator />
                <div className="flex justify-between">
                  <Button variant="destructive" size="sm" onClick={() => deleteBug(active.id)} className="gap-2"><Trash2 className="h-4 w-4" />Delete</Button>
                  <div className="text-xs text-muted-foreground self-center">Updated {new Date(active.updated_at).toLocaleString()}</div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">{label}</div>
      {children}
    </div>
  );
}
function KV({ k, v }: { k: string; v: any }) {
  return <div><span className="text-muted-foreground">{k}:</span> <span className="font-medium">{v || "—"}</span></div>;
}
