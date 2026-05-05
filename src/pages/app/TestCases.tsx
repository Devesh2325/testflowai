import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Sparkles, Upload, Download, ClipboardPaste, FolderPlus, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type TC = {
  id: string;
  title: string;
  priority: string;
  type: string;
  status: string;
  project_id: string;
  module_id: string | null;
  steps: string | null;
  expected_result: string | null;
  tags: string[] | null;
  updated_at: string;
};
type Project = { id: string; name: string };
type Module = { id: string; name: string; project_id: string };

const PRIORITIES = ["low", "medium", "high", "critical"];
const TYPES = ["functional", "regression", "smoke", "integration", "performance", "security", "usability"];
const STATUSES = ["active", "inactive"];

const priorityColor: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-warning/15 text-warning",
  medium: "bg-primary/15 text-primary",
  low: "bg-muted text-muted-foreground",
};

const COLS = [
  { key: "title", w: 260 },
  { key: "module", w: 140 },
  { key: "priority", w: 110 },
  { key: "type", w: 130 },
  { key: "steps", w: 240 },
  { key: "expected_result", w: 240 },
  { key: "status", w: 100 },
  { key: "tags", w: 160 },
];

export default function TestCases() {
  const { user } = useAuth();
  const [cases, setCases] = useState<TC[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [activeProject, setActiveProject] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [newModule, setNewModule] = useState("");
  const [paste, setPaste] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [tc, p, m] = await Promise.all([
      supabase.from("test_cases").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
      supabase.from("modules").select("id,name,project_id"),
    ]);
    setCases((tc.data ?? []) as any);
    setProjects(p.data ?? []);
    setModules(m.data ?? []);
    if (p.data?.[0] && !activeProject) setActiveProject(p.data[0].id);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return cases.filter(c =>
      (!activeProject || c.project_id === activeProject) &&
      (!search || c.title.toLowerCase().includes(search.toLowerCase())) &&
      (filterPriority === "all" || c.priority === filterPriority) &&
      (filterModule === "all" || (filterModule === "none" ? !c.module_id : c.module_id === filterModule)) &&
      (filterStatus === "all" || c.status === filterStatus)
    );
  }, [cases, activeProject, search, filterPriority, filterModule, filterStatus]);

  // Duplicate detection
  const dupTitles = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach(c => counts.set(c.title.trim().toLowerCase(), (counts.get(c.title.trim().toLowerCase()) ?? 0) + 1));
    return new Set(Array.from(counts.entries()).filter(([k, v]) => k && v > 1).map(([k]) => k));
  }, [filtered]);

  const projectModules = modules.filter(m => m.project_id === activeProject);

  const flash = (id: string) => {
    setSavedFlash(id);
    setTimeout(() => setSavedFlash(s => (s === id ? null : s)), 1200);
  };

  const updateCell = async (id: string, patch: Partial<TC>) => {
    setCases(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from("test_cases").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    flash(id);
  };

  const addRow = async (copyFrom?: TC) => {
    if (!user || !activeProject) return toast.error("Select a project first");
    const base: any = copyFrom
      ? { title: copyFrom.title + " (copy)", priority: copyFrom.priority, type: copyFrom.type, steps: copyFrom.steps, expected_result: copyFrom.expected_result, module_id: copyFrom.module_id, tags: copyFrom.tags }
      : { title: "Untitled test case", priority: "medium", type: "functional" };
    const { data, error } = await supabase.from("test_cases").insert({ ...base, project_id: activeProject, owner_id: user.id }).select().single();
    if (error) return toast.error(error.message);
    setCases(cs => [data as any, ...cs]);
    flash((data as any).id);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(`input[data-cell="${(data as any).id}-title"]`);
      el?.focus(); el?.select();
    }, 50);
  };

  const remove = async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await supabase.from("test_cases").delete().in("id", ids);
    if (error) return toast.error(error.message);
    setCases(cs => cs.filter(c => !ids.includes(c.id)));
    setSelected(new Set());
    toast.success(`Deleted ${ids.length}`);
  };

  const bulkSetPriority = async (priority: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("test_cases").update({ priority: priority as any }).in("id", ids);
    if (error) return toast.error(error.message);
    setCases(cs => cs.map(c => (ids.includes(c.id) ? { ...c, priority } : c)));
    toast.success(`Updated ${ids.length}`);
  };

  const bulkSetModule = async (module_id: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const v = module_id === "none" ? null : module_id;
    const { error } = await supabase.from("test_cases").update({ module_id: v }).in("id", ids);
    if (error) return toast.error(error.message);
    setCases(cs => cs.map(c => (ids.includes(c.id) ? { ...c, module_id: v } : c)));
    toast.success(`Updated ${ids.length}`);
  };

  const addModule = async () => {
    if (!newModule || !activeProject || !user) return toast.error("Module name required");
    const { data, error } = await supabase.from("modules").insert({ name: newModule, project_id: activeProject, owner_id: user.id }).select().single();
    if (error) return toast.error(error.message);
    setModules(m => [...m, data as Module]);
    setNewModule(""); setModuleOpen(false);
    toast.success("Module added");
  };

  // Keyboard navigation
  const onCellKey = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, rowIdx: number, colKey: string) => {
    if (e.key === "Enter" && !e.shiftKey && e.currentTarget.tagName !== "TEXTAREA") {
      e.preventDefault();
      const next = filtered[rowIdx + 1];
      if (next) document.querySelector<HTMLInputElement>(`input[data-cell="${next.id}-${colKey}"]`)?.focus();
      else addRow();
    }
    if (e.key === "Tab") {
      const idx = COLS.findIndex(c => c.key === colKey);
      const nextCol = COLS[idx + (e.shiftKey ? -1 : 1)];
      if (nextCol) {
        e.preventDefault();
        const sel = `[data-cell="${filtered[rowIdx].id}-${nextCol.key}"]`;
        document.querySelector<HTMLElement>(sel)?.focus();
      }
    }
  };

  // Import / Export
  const exportXlsx = () => {
    const rows = filtered.map(c => ({
      Title: c.title, Type: c.type, Priority: c.priority, Status: c.status,
      Module: modules.find(m => m.id === c.module_id)?.name ?? "",
      Steps: c.steps ?? "", "Expected Result": c.expected_result ?? "",
      Tags: (c.tags ?? []).join(", "),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TestCases");
    XLSX.writeFile(wb, `testcases-${Date.now()}.xlsx`);
  };

  const importRows = async (rows: any[]) => {
    if (!user || !activeProject) return toast.error("Choose a project first");
    const valid = rows.filter(r => r.title || r.Title).map(r => {
      const get = (k: string) => r[k] ?? r[k.toLowerCase()] ?? r[k.charAt(0).toUpperCase() + k.slice(1)] ?? "";
      const priority = String(get("priority") || "medium").toLowerCase();
      const type = String(get("type") || "functional").toLowerCase();
      return {
        title: String(get("title")),
        steps: String(get("steps") || ""),
        expected_result: String(get("expected_result") || get("Expected Result") || ""),
        priority: PRIORITIES.includes(priority) ? priority : "medium",
        type: TYPES.includes(type) ? type : "functional",
        project_id: activeProject,
        owner_id: user.id,
      };
    });
    if (!valid.length) return toast.error("No rows found");
    const { error } = await supabase.from("test_cases").insert(valid as any);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${valid.length}`);
    setImportOpen(false); setPaste(""); load();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
    await importRows(rows);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onPaste = async () => {
    const lines = paste.trim().split(/\r?\n/);
    if (lines.length < 2) return toast.error("Paste header row + at least 1 row");
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(l => {
      const parts = l.split(sep);
      const obj: any = {}; headers.forEach((h, i) => obj[h] = (parts[i] ?? "").trim());
      return obj;
    });
    await importRows(rows);
  };

  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const toggleAll = () => {
    setSelected(s => {
      if (allSelected) return new Set();
      const n = new Set(s); filtered.forEach(c => n.add(c.id)); return n;
    });
  };

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Test Cases</h1>
          <p className="text-muted-foreground text-sm">Edit inline like a spreadsheet — changes auto-save.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild className="gap-2"><Link to="/app/ai"><Sparkles className="h-4 w-4 text-primary" />AI</Link></Button>
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />Import</Button>
          <Button variant="outline" className="gap-2" onClick={exportXlsx}><Download className="h-4 w-4" />Export</Button>
          <Button variant="outline" className="gap-2" onClick={() => filtered[0] && addRow(filtered[0])} disabled={!filtered.length}><Copy className="h-4 w-4" />Duplicate last</Button>
          <Button className="bg-gradient-hero border-0 hover:opacity-90 gap-2" onClick={() => addRow()} disabled={!projects.length}><Plus className="h-4 w-4" />Add test case</Button>
        </div>
      </div>

      {/* Filters bar */}
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Select value={activeProject} onValueChange={v => { setActiveProject(v); setFilterModule("all"); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Search by title…" value={search} onChange={e => setSearch(e.target.value)} className="w-[220px]" />
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            <SelectItem value="none">No module</SelectItem>
            {projectModules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="gap-1" onClick={() => setModuleOpen(true)}><FolderPlus className="h-3 w-3" />Module</Button>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} cases</div>
      </Card>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <Card className="p-3 flex items-center gap-2 bg-primary/5 border-primary/20">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select onValueChange={bulkSetPriority}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Set priority" /></SelectTrigger>
            <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={bulkSetModule}>
            <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Assign module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No module</SelectItem>
              {projectModules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="destructive" className="gap-1 ml-auto" onClick={() => remove(Array.from(selected))}><Trash2 className="h-3 w-3" />Delete</Button>
        </Card>
      )}

      {/* Grid */}
      <Card className="overflow-hidden">
        <div ref={tableRef} className="overflow-auto max-h-[calc(100vh-320px)]">
          {!projects.length ? (
            <div className="p-12 text-center text-muted-foreground">Create a <Link to="/app/projects" className="text-primary underline">project</Link> first.</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-background z-10 border-b">
                <tr className="text-left text-xs font-medium text-muted-foreground">
                  <th className="p-2 w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></th>
                  <th className="p-2 w-16">ID</th>
                  <th className="p-2" style={{ minWidth: 260 }}>Title</th>
                  <th className="p-2" style={{ minWidth: 140 }}>Module</th>
                  <th className="p-2" style={{ minWidth: 110 }}>Priority</th>
                  <th className="p-2" style={{ minWidth: 130 }}>Type</th>
                  <th className="p-2" style={{ minWidth: 240 }}>Steps</th>
                  <th className="p-2" style={{ minWidth: 240 }}>Expected Result</th>
                  <th className="p-2" style={{ minWidth: 100 }}>Status</th>
                  <th className="p-2" style={{ minWidth: 160 }}>Tags</th>
                  <th className="p-2 w-24">Updated</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, rowIdx) => {
                  const isDup = dupTitles.has(c.title.trim().toLowerCase());
                  const missing = !c.title.trim();
                  return (
                    <tr key={c.id} className={`border-b hover:bg-muted/30 ${selected.has(c.id) ? "bg-primary/5" : ""}`}>
                      <td className="p-2 align-top">
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => {
                          setSelected(s => { const n = new Set(s); v ? n.add(c.id) : n.delete(c.id); return n; });
                        }} />
                      </td>
                      <td className="p-2 align-top text-xs text-muted-foreground font-mono">TC-{c.id.slice(0, 4)}</td>
                      <td className="p-2 align-top">
                        <div className="flex items-center gap-1">
                          <Input
                            data-cell={`${c.id}-title`}
                            defaultValue={c.title}
                            onBlur={e => e.target.value !== c.title && updateCell(c.id, { title: e.target.value })}
                            onKeyDown={e => onCellKey(e, rowIdx, "title")}
                            className={`h-8 border-transparent hover:border-input focus-visible:ring-1 ${missing ? "border-destructive" : ""}`}
                          />
                          {(isDup || missing) && <AlertTriangle className="h-3 w-3 text-warning shrink-0" />}
                        </div>
                      </td>
                      <td className="p-2 align-top">
                        <Select value={c.module_id ?? "none"} onValueChange={v => updateCell(c.id, { module_id: v === "none" ? null : v } as any)}>
                          <SelectTrigger data-cell={`${c.id}-module`} className="h-8 border-transparent hover:border-input"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {projectModules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 align-top">
                        <Select value={c.priority} onValueChange={v => updateCell(c.id, { priority: v } as any)}>
                          <SelectTrigger data-cell={`${c.id}-priority`} className={`h-8 border-transparent hover:border-input ${priorityColor[c.priority]}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 align-top">
                        <Select value={c.type} onValueChange={v => updateCell(c.id, { type: v } as any)}>
                          <SelectTrigger data-cell={`${c.id}-type`} className="h-8 border-transparent hover:border-input"><SelectValue /></SelectTrigger>
                          <SelectContent>{TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 align-top">
                        <Textarea
                          data-cell={`${c.id}-steps`}
                          defaultValue={c.steps ?? ""}
                          rows={2}
                          onBlur={e => e.target.value !== (c.steps ?? "") && updateCell(c.id, { steps: e.target.value })}
                          onKeyDown={e => onCellKey(e, rowIdx, "steps")}
                          className="min-h-[2rem] text-xs border-transparent hover:border-input focus-visible:ring-1 resize-y"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <Textarea
                          data-cell={`${c.id}-expected_result`}
                          defaultValue={c.expected_result ?? ""}
                          rows={2}
                          onBlur={e => e.target.value !== (c.expected_result ?? "") && updateCell(c.id, { expected_result: e.target.value })}
                          onKeyDown={e => onCellKey(e, rowIdx, "expected_result")}
                          className="min-h-[2rem] text-xs border-transparent hover:border-input focus-visible:ring-1 resize-y"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <Select value={c.status} onValueChange={v => updateCell(c.id, { status: v } as any)}>
                          <SelectTrigger data-cell={`${c.id}-status`} className="h-8 border-transparent hover:border-input"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 align-top">
                        <Input
                          data-cell={`${c.id}-tags`}
                          defaultValue={(c.tags ?? []).join(", ")}
                          placeholder="auth, smoke"
                          onBlur={e => {
                            const v = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
                            if (JSON.stringify(v) !== JSON.stringify(c.tags ?? [])) updateCell(c.id, { tags: v } as any);
                          }}
                          onKeyDown={e => onCellKey(e, rowIdx, "tags")}
                          className="h-8 text-xs border-transparent hover:border-input focus-visible:ring-1"
                        />
                      </td>
                      <td className="p-2 align-top text-xs text-muted-foreground">
                        {savedFlash === c.id ? <span className="inline-flex items-center gap-1 text-success"><Check className="h-3 w-3" />Saved</span>
                          : new Date(c.updated_at).toLocaleDateString()}
                      </td>
                      <td className="p-2 align-top">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove([c.id])}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={12} className="p-2">
                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground w-full justify-start" onClick={() => addRow()}>
                      <Plus className="h-3 w-3" />Add test case (Enter)
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import test cases</DialogTitle><DialogDescription>Upload Excel/CSV or paste from a spreadsheet. Required: <b>Title</b>. Optional: Type, Priority, Steps, Expected Result.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Project</Label>
              <Select value={activeProject} onValueChange={setActiveProject}>
                <SelectTrigger><SelectValue placeholder="Choose project" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Tabs defaultValue="file">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="file"><Upload className="h-3 w-3 mr-1" />Excel/CSV</TabsTrigger>
                <TabsTrigger value="paste"><ClipboardPaste className="h-3 w-3 mr-1" />Paste</TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="space-y-2 pt-3">
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="block w-full text-sm" />
                <p className="text-xs text-muted-foreground">First row should contain headers (Title, Type, Priority, Steps, Expected Result).</p>
              </TabsContent>
              <TabsContent value="paste" className="space-y-2 pt-3">
                <Textarea rows={8} placeholder={`Title\tType\tPriority\nLogin works\tfunctional\thigh`} value={paste} onChange={e => setPaste(e.target.value)} />
                <Button onClick={onPaste} className="w-full">Import rows</Button>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Module dialog */}
      <Dialog open={moduleOpen} onOpenChange={setModuleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add module</DialogTitle><DialogDescription>Group related test cases (e.g. Auth, Checkout).</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Module name" value={newModule} onChange={e => setNewModule(e.target.value)} />
            <Button onClick={addModule} className="w-full">Create module</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
