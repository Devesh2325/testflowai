import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Sparkles, Upload, Download, ClipboardPaste, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type TC = { id: string; title: string; priority: string; type: string; status: string; project_id: string; module_id: string | null; steps: string | null; expected_result: string | null };
type Project = { id: string; name: string };
type Module = { id: string; name: string; project_id: string };

const priorityColor: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground",
};

const PRIORITIES = ["low", "medium", "high", "critical"];
const TYPES = ["functional", "regression", "smoke", "integration", "performance", "security", "usability"];

export default function TestCases() {
  const { user } = useAuth();
  const [cases, setCases] = useState<TC[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [newModule, setNewModule] = useState("");
  const [paste, setPaste] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: "", steps: "", expected_result: "", preconditions: "", priority: "medium", type: "functional", project_id: "", module_id: "" });

  const load = async () => {
    const [tc, p, m] = await Promise.all([
      supabase.from("test_cases").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
      supabase.from("modules").select("id,name,project_id"),
    ]);
    setCases(tc.data ?? []); setProjects(p.data ?? []); setModules(m.data ?? []);
    if (p.data?.[0] && !form.project_id) setForm(f => ({ ...f, project_id: p.data![0].id }));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.project_id || !user) return toast.error("Title and project required");
    const payload: any = { ...form, owner_id: user.id, priority: form.priority as any, type: form.type as any };
    if (!payload.module_id) delete payload.module_id;
    const { error } = await supabase.from("test_cases").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Test case created");
    setOpen(false); setForm({ ...form, title: "", steps: "", expected_result: "", preconditions: "" }); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("test_cases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const addModule = async () => {
    if (!newModule || !form.project_id || !user) return toast.error("Module name and project required");
    const { data, error } = await supabase.from("modules").insert({ name: newModule, project_id: form.project_id, owner_id: user.id }).select().single();
    if (error) return toast.error(error.message);
    setModules(m => [...m, data as Module]);
    setForm(f => ({ ...f, module_id: data!.id }));
    setNewModule(""); setModuleOpen(false);
    toast.success("Module added");
  };

  // ---- Excel / CSV / paste ----
  const exportXlsx = () => {
    if (!cases.length) return toast.error("No test cases to export");
    const rows = cases.map(c => ({
      Title: c.title, Type: c.type, Priority: c.priority, Status: c.status,
      Steps: c.steps ?? "", "Expected Result": c.expected_result ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TestCases");
    XLSX.writeFile(wb, `testcases-${Date.now()}.xlsx`);
  };

  const exportCsv = () => {
    if (!cases.length) return toast.error("No test cases to export");
    const header = ["Title", "Type", "Priority", "Status", "Steps", "Expected Result"];
    const csv = [header.join(",")].concat(
      cases.map(c => [c.title, c.type, c.priority, c.status, c.steps ?? "", c.expected_result ?? ""]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `testcases-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const importRows = async (rows: any[]) => {
    if (!user || !form.project_id) return toast.error("Choose a project first (open New case to set context)");
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
        project_id: form.project_id,
        owner_id: user.id,
      };
    });
    if (!valid.length) return toast.error("No rows found");
    const { error } = await supabase.from("test_cases").insert(valid as any);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${valid.length} test cases`);
    setImportOpen(false); setPaste(""); load();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(ws);
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

  const projectModules = modules.filter(m => m.project_id === form.project_id);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Test Cases</h1>
          <p className="text-muted-foreground">Manage and version your test library.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild className="gap-2"><Link to="/app/ai"><Sparkles className="h-4 w-4 text-primary" />Generate with AI</Link></Button>
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />Import</Button>
          <Button variant="outline" className="gap-2" onClick={exportXlsx}><Download className="h-4 w-4" />Export Excel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-hero border-0 hover:opacity-90 gap-2" disabled={!projects.length}><Plus className="h-4 w-4" />New case</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New test case</DialogTitle><DialogDescription>Add a single test case manually.</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <div><Label>Project</Label>
                  <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v, module_id: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center justify-between"><Label>Module</Label>
                    <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={() => setModuleOpen(true)}><FolderPlus className="h-3 w-3" />Add module</Button>
                  </div>
                  <Select value={form.module_id || "none"} onValueChange={v => setForm({ ...form, module_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="No module" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No module</SelectItem>
                      {projectModules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Preconditions</Label><Textarea rows={2} value={form.preconditions} onChange={e => setForm({ ...form, preconditions: e.target.value })} /></div>
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
            {projects.length === 0 ? <>Create a <Link to="/app/projects" className="text-primary underline">project</Link> first.</> : "No test cases yet — create one or import from Excel."}
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

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import test cases</DialogTitle><DialogDescription>Upload Excel/CSV or paste from a spreadsheet. Required column: <b>Title</b>. Optional: Type, Priority, Steps, Expected Result.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Project</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose project" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Tabs defaultValue="file">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="file"><Upload className="h-3 w-3 mr-1" />Excel/CSV</TabsTrigger>
                <TabsTrigger value="paste"><ClipboardPaste className="h-3 w-3 mr-1" />Paste</TabsTrigger>
                <TabsTrigger value="export"><Download className="h-3 w-3 mr-1" />Export</TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="space-y-2 pt-3">
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="block w-full text-sm" />
                <p className="text-xs text-muted-foreground">First row should contain headers (Title, Type, Priority, Steps, Expected Result).</p>
              </TabsContent>
              <TabsContent value="paste" className="space-y-2 pt-3">
                <Textarea rows={8} placeholder={`Title\tType\tPriority\nLogin works\tfunctional\thigh`} value={paste} onChange={e => setPaste(e.target.value)} />
                <Button onClick={onPaste} className="w-full">Import {paste.trim().split(/\r?\n/).length - 1 > 0 ? `${paste.trim().split(/\r?\n/).length - 1} rows` : ""}</Button>
              </TabsContent>
              <TabsContent value="export" className="space-y-2 pt-3">
                <p className="text-sm text-muted-foreground">Download all your test cases.</p>
                <div className="flex gap-2">
                  <Button onClick={exportXlsx} className="flex-1">Excel (.xlsx)</Button>
                  <Button onClick={exportCsv} variant="outline" className="flex-1">CSV</Button>
                </div>
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
