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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Sparkles,
  Upload,
  Download,
  ClipboardPaste,
  FolderPlus,
  Copy,
  Check,
  AlertTriangle,
  Search,
  FileText,
  ShieldAlert,
  Wand2,
  Edit3,
  Layers,
  ArrowUpDown,
  BookOpen,
  Filter,
} from "lucide-react";
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
  preconditions: string | null;
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
  critical: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  medium: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

const STEP_TEMPLATES = [
  {
    name: "Gherkin BDD (Given-When-Then)",
    steps: "Given the user is authenticated and on the target page\nWhen the user performs the primary action with valid input\nThen the application reflects the expected state change",
    expected: "Expected state change is observed with 200 OK telemetry and correct UI notifications.",
  },
  {
    name: "Standard 3-Step UI Procedure",
    steps: "1. Navigate to the target module / URL\n2. Fill mandatory fields with valid test dataset\n3. Click the Submit / Confirmation button",
    expected: "Form submits successfully, success modal/toast appears, and data persists.",
  },
  {
    name: "REST API Endpoint Validation",
    steps: "1. Send [POST/GET] request to /api/v1/{endpoint}\n2. Pass Bearer authentication header and JSON payload\n3. Validate response status code, headers, and payload schema",
    expected: "HTTP Status 200 OK / 201 Created with JSON schema matching OpenAPI specification.",
  },
  {
    name: "Negative & Boundary Value Test",
    steps: "1. Input invalid characters or extreme boundary values into input fields\n2. Trigger submission without required prerequisites\n3. Verify input sanitization and inline validation triggers",
    expected: "Inline error message highlights faulty field; submission is blocked; no unhandled exceptions.",
  },
  {
    name: "Accessibility (WCAG 2.1 AA)",
    steps: "1. Navigate interactive controls using Tab / Shift+Tab keyboard only\n2. Trigger controls via Enter and Spacebar\n3. Inspect contrast ratio (min 4.5:1) and ARIA live regions with screen reader",
    expected: "All interactive controls reachable and visible focus indicator present; announcements clear.",
  },
];

const COLS = [
  { key: "title", w: 240 },
  { key: "module", w: 130 },
  { key: "priority", w: 110 },
  { key: "type", w: 120 },
  { key: "preconditions", w: 200 },
  { key: "steps", w: 230 },
  { key: "expected_result", w: 230 },
  { key: "status", w: 90 },
  { key: "tags", w: 140 },
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
  const [filterType, setFilterType] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  // Dialogs
  const [importOpen, setImportOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [detailModalCase, setDetailModalCase] = useState<TC | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateTargetCaseId, setTemplateTargetCaseId] = useState<string | null>(null);
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

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return cases.filter(
      (c) =>
        (!activeProject || c.project_id === activeProject) &&
        (!search || c.title.toLowerCase().includes(search.toLowerCase())) &&
        (filterPriority === "all" || c.priority === filterPriority) &&
        (filterType === "all" || c.type === filterType) &&
        (filterModule === "all" || (filterModule === "none" ? !c.module_id : c.module_id === filterModule)) &&
        (filterStatus === "all" || c.status === filterStatus)
    );
  }, [cases, activeProject, search, filterPriority, filterType, filterModule, filterStatus]);

  // Duplicate detection
  const dupTitles = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((c) =>
      counts.set(c.title.trim().toLowerCase(), (counts.get(c.title.trim().toLowerCase()) ?? 0) + 1)
    );
    return new Set(Array.from(counts.entries()).filter(([k, v]) => k && v > 1).map(([k]) => k));
  }, [filtered]);

  const projectModules = modules.filter((m) => m.project_id === activeProject);

  const flash = (id: string) => {
    setSavedFlash(id);
    setTimeout(() => setSavedFlash((s) => (s === id ? null : s)), 1200);
  };

  const updateCell = async (id: string, patch: Partial<TC>) => {
    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (detailModalCase && detailModalCase.id === id) {
      setDetailModalCase((curr) => (curr ? { ...curr, ...patch } : null));
    }
    const { error } = await supabase.from("test_cases").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    flash(id);
  };

  const addRow = async (copyFrom?: TC) => {
    if (!user || !activeProject) return toast.error("Select a project first");
    const base: any = copyFrom
      ? {
          title: copyFrom.title + " (Copy)",
          priority: copyFrom.priority,
          type: copyFrom.type,
          preconditions: copyFrom.preconditions,
          steps: copyFrom.steps,
          expected_result: copyFrom.expected_result,
          module_id: copyFrom.module_id,
          tags: copyFrom.tags,
        }
      : {
          title: "Untitled test case",
          priority: "medium",
          type: "functional",
          preconditions: "",
          steps: "1. Navigate to...\n2. Perform action...\n3. Verify result...",
          expected_result: "Action completes successfully with expected UI feedback.",
        };

    const { data, error } = await supabase
      .from("test_cases")
      .insert({ ...base, project_id: activeProject, owner_id: user.id })
      .select()
      .single();

    if (error) return toast.error(error.message);
    setCases((cs) => [data as any, ...cs]);
    flash((data as any).id);
    toast.success("Test case created");
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(
        `input[data-cell="${(data as any).id}-title"]`
      );
      el?.focus();
      el?.select();
    }, 50);
  };

  const remove = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`Are you sure you want to delete ${ids.length} test case(s)?`)) return;
    const { error } = await supabase.from("test_cases").delete().in("id", ids);
    if (error) return toast.error(error.message);
    setCases((cs) => cs.filter((c) => !ids.includes(c.id)));
    setSelected(new Set());
    if (detailModalCase && ids.includes(detailModalCase.id)) setDetailModalCase(null);
    toast.success(`Deleted ${ids.length} test cases`);
  };

  // Bulk Operations
  const bulkDuplicate = async () => {
    const ids = Array.from(selected);
    if (!ids.length || !user || !activeProject) return;
    const toClone = cases.filter((c) => ids.includes(c.id));
    const inserts = toClone.map((c) => ({
      title: `${c.title} (Clone)`,
      priority: c.priority,
      type: c.type,
      preconditions: c.preconditions,
      steps: c.steps,
      expected_result: c.expected_result,
      module_id: c.module_id,
      tags: c.tags,
      project_id: activeProject,
      owner_id: user.id,
    }));

    const { data, error } = await supabase.from("test_cases").insert(inserts as any).select();
    if (error) return toast.error(error.message);
    setCases((cs) => [...((data as any) ?? []), ...cs]);
    setSelected(new Set());
    toast.success(`Cloned ${inserts.length} test cases successfully`);
  };

  const bulkSetPriority = async (priority: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("test_cases").update({ priority: priority as any }).in("id", ids);
    if (error) return toast.error(error.message);
    setCases((cs) => cs.map((c) => (ids.includes(c.id) ? { ...c, priority } : c)));
    toast.success(`Updated priority for ${ids.length} cases`);
  };

  const bulkSetType = async (type: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("test_cases").update({ type: type as any }).in("id", ids);
    if (error) return toast.error(error.message);
    setCases((cs) => cs.map((c) => (ids.includes(c.id) ? { ...c, type } : c)));
    toast.success(`Updated type for ${ids.length} cases`);
  };

  const bulkSetStatus = async (status: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("test_cases").update({ status: status as any }).in("id", ids);
    if (error) return toast.error(error.message);
    setCases((cs) => cs.map((c) => (ids.includes(c.id) ? { ...c, status } : c)));
    toast.success(`Updated status for ${ids.length} cases`);
  };

  const bulkSetModule = async (module_id: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const v = module_id === "none" ? null : module_id;
    const { error } = await supabase.from("test_cases").update({ module_id: v }).in("id", ids);
    if (error) return toast.error(error.message);
    setCases((cs) => cs.map((c) => (ids.includes(c.id) ? { ...c, module_id: v } : c)));
    toast.success(`Assigned module for ${ids.length} cases`);
  };

  const addModule = async () => {
    if (!newModule || !activeProject || !user) return toast.error("Module name required");
    const { data, error } = await supabase
      .from("modules")
      .insert({ name: newModule, project_id: activeProject, owner_id: user.id })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setModules((m) => [...m, data as Module]);
    setNewModule("");
    setModuleOpen(false);
    toast.success("Module added");
  };

  // Keyboard navigation
  const onCellKey = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowIdx: number,
    colKey: string
  ) => {
    if (e.key === "Enter" && !e.shiftKey && e.currentTarget.tagName !== "TEXTAREA") {
      e.preventDefault();
      const next = filtered[rowIdx + 1];
      if (next)
        document
          .querySelector<HTMLInputElement>(`input[data-cell="${next.id}-${colKey}"]`)
          ?.focus();
      else addRow();
    }
    if (e.key === "Tab") {
      const idx = COLS.findIndex((c) => c.key === colKey);
      const nextCol = COLS[idx + (e.shiftKey ? -1 : 1)];
      if (nextCol) {
        e.preventDefault();
        const sel = `[data-cell="${filtered[rowIdx].id}-${nextCol.key}"]`;
        document.querySelector<HTMLElement>(sel)?.focus();
      }
    }
  };

  // Apply Step Template
  const applyTemplate = (template: (typeof STEP_TEMPLATES)[0]) => {
    if (!templateTargetCaseId) return;
    updateCell(templateTargetCaseId, {
      steps: template.steps,
      expected_result: template.expected,
    });
    setTemplateOpen(false);
    toast.success(`Applied ${template.name} template!`);
  };

  // Import / Export
  const exportXlsx = () => {
    const rows = filtered.map((c) => ({
      "Case ID": `TC-${c.id.slice(0, 6)}`,
      Title: c.title,
      Module: modules.find((m) => m.id === c.module_id)?.name ?? "",
      Priority: c.priority,
      Type: c.type,
      Status: c.status,
      Preconditions: c.preconditions ?? "",
      Steps: c.steps ?? "",
      "Expected Result": c.expected_result ?? "",
      Tags: (c.tags ?? []).join(", "),
      "Updated At": c.updated_at,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TestCases");
    XLSX.writeFile(wb, `testcases-${Date.now()}.xlsx`);
    toast.success("Exported test cases to Excel");
  };

  const exportCsv = () => {
    const headers = [
      "Case ID",
      "Title",
      "Module",
      "Priority",
      "Type",
      "Status",
      "Preconditions",
      "Steps",
      "Expected Result",
      "Tags",
    ];

    const clean = (val: string | null | undefined) =>
      `"${(val ?? "").toString().replace(/"/g, '""')}"`;

    const rows = filtered.map((c) => [
      clean(`TC-${c.id.slice(0, 6)}`),
      clean(c.title),
      clean(modules.find((m) => m.id === c.module_id)?.name ?? "General"),
      clean(c.priority),
      clean(c.type),
      clean(c.status),
      clean(c.preconditions),
      clean(c.steps),
      clean(c.expected_result),
      clean((c.tags ?? []).join(", ")),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `testcases-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported test cases to CSV");
  };

  const downloadSampleTemplate = () => {
    const sampleRows = [
      {
        Title: "User Login with valid credentials",
        Module: "Authentication",
        Priority: "high",
        Type: "smoke",
        Preconditions: "User has registered account and confirmed email.",
        Steps: "1. Navigate to /login\n2. Enter valid email and password\n3. Click Login",
        "Expected Result": "User redirected to /dashboard and auth session persisted.",
        Tags: "auth, smoke, p1",
      },
      {
        Title: "Verify password mask / unmask visibility toggle",
        Module: "Authentication",
        Priority: "medium",
        Type: "functional",
        Preconditions: "On login screen.",
        Steps: "1. Type password in input\n2. Click eye toggle icon\n3. Click eye toggle again",
        "Expected Result": "Password switches between hidden dots and clear text.",
        Tags: "ui, usability",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SampleTestCases");
    XLSX.writeFile(wb, `sample-qa-testcases-template.xlsx`);
    toast.success("Sample template downloaded");
  };

  const importRows = async (rows: any[]) => {
    if (!user || !activeProject) return toast.error("Choose a project first");
    const valid = rows
      .filter((r) => r.title || r.Title)
      .map((r) => {
        const get = (k: string) =>
          r[k] ?? r[k.toLowerCase()] ?? r[k.charAt(0).toUpperCase() + k.slice(1)] ?? "";
        const priority = String(get("priority") || "medium").toLowerCase();
        const type = String(get("type") || "functional").toLowerCase();
        return {
          title: String(get("title")),
          preconditions: String(get("preconditions") || get("Preconditions") || ""),
          steps: String(get("steps") || ""),
          expected_result: String(get("expected_result") || get("Expected Result") || ""),
          priority: PRIORITIES.includes(priority) ? priority : "medium",
          type: TYPES.includes(type) ? type : "functional",
          project_id: activeProject,
          owner_id: user.id,
        };
      });
    if (!valid.length) return toast.error("No valid test case rows found");
    const { error } = await supabase.from("test_cases").insert(valid as any);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${valid.length} test cases`);
    setImportOpen(false);
    setPaste("");
    load();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
    await importRows(rows);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onPaste = async () => {
    const lines = paste.trim().split(/\r?\n/);
    if (lines.length < 2) return toast.error("Paste header row + at least 1 data row");
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((l) => {
      const parts = l.split(sep);
      const obj: any = {};
      headers.forEach((h, i) => (obj[h] = (parts[i] ?? "").trim()));
      return obj;
    });
    await importRows(rows);
  };

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => {
    setSelected((s) => {
      if (allSelected) return new Set();
      const n = new Set(s);
      filtered.forEach((c) => n.add(c.id));
      return n;
    });
  };

  return (
    <div className="space-y-4 max-w-[1500px]">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Cases Repository</h1>
          <p className="text-muted-foreground text-sm">
            Manage, author, and organize standard QA test cases with inline spreadsheet speed.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild className="gap-2">
            <Link to="/app/ai">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Test Generator
            </Link>
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={exportXlsx}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={exportCsv}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => filtered[0] && addRow(filtered[0])}
            disabled={!filtered.length}
          >
            <Copy className="h-4 w-4" />
            Duplicate last
          </Button>

          <Button
            className="bg-gradient-hero border-0 hover:opacity-90 gap-2 font-medium"
            onClick={() => addRow()}
            disabled={!projects.length}
          >
            <Plus className="h-4 w-4" />
            Add Test Case
          </Button>
        </div>
      </div>

      {/* Filter and Query Bar */}
      <Card className="p-3 flex flex-wrap items-center gap-2.5">
        <Select
          value={activeProject}
          onValueChange={(v) => {
            setActiveProject(v);
            setFilterModule("all");
          }}
        >
          <SelectTrigger className="w-[190px] h-9 text-xs">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-[210px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search test cases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            <SelectItem value="none">No module</SelectItem>
            {projectModules.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[120px] h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1 text-xs"
          onClick={() => setModuleOpen(true)}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          New Module
        </Button>

        <div className="ml-auto text-xs text-muted-foreground font-mono">
          {filtered.length} test cases
        </div>
      </Card>

      {/* Bulk Operations Toolbar */}
      {selected.size > 0 && (
        <Card className="p-2.5 px-4 flex items-center gap-2.5 bg-primary/10 border-primary/30 flex-wrap animate-in fade-in">
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40 font-mono">
            {selected.size} selected
          </Badge>
          <span className="text-xs text-muted-foreground">Bulk actions:</span>

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 bg-background"
            onClick={bulkDuplicate}
          >
            <Copy className="h-3 w-3" />
            Clone Selected
          </Button>

          <Select onValueChange={bulkSetPriority}>
            <SelectTrigger className="w-[140px] h-7 text-xs bg-background">
              <SelectValue placeholder="Set priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={bulkSetType}>
            <SelectTrigger className="w-[140px] h-7 text-xs bg-background">
              <SelectValue placeholder="Set type" />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={bulkSetModule}>
            <SelectTrigger className="w-[150px] h-7 text-xs bg-background">
              <SelectValue placeholder="Assign module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No module</SelectItem>
              {projectModules.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={bulkSetStatus}>
            <SelectTrigger className="w-[130px] h-7 text-xs bg-background">
              <SelectValue placeholder="Set status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="destructive"
            className="gap-1 h-7 text-xs ml-auto"
            onClick={() => remove(Array.from(selected))}
          >
            <Trash2 className="h-3 w-3" />
            Delete Selected
          </Button>
        </Card>
      )}

      {/* Spreadsheet Grid */}
      <Card className="overflow-hidden border-border/70">
        <div ref={tableRef} className="overflow-auto max-h-[calc(100vh-340px)]">
          {!projects.length ? (
            <div className="p-12 text-center text-muted-foreground">
              Create a{" "}
              <Link to="/app/projects" className="text-primary underline">
                project
              </Link>{" "}
              first to manage test cases.
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-card z-10 border-b border-border/70">
                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="p-2.5 w-10 text-center">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </th>
                  <th className="p-2.5 w-16">ID</th>
                  <th className="p-2.5" style={{ minWidth: 240 }}>
                    Test Case Title
                  </th>
                  <th className="p-2.5" style={{ minWidth: 130 }}>
                    Module
                  </th>
                  <th className="p-2.5" style={{ minWidth: 105 }}>
                    Priority
                  </th>
                  <th className="p-2.5" style={{ minWidth: 115 }}>
                    Type
                  </th>
                  <th className="p-2.5" style={{ minWidth: 200 }}>
                    Preconditions
                  </th>
                  <th className="p-2.5" style={{ minWidth: 240 }}>
                    Test Steps
                  </th>
                  <th className="p-2.5" style={{ minWidth: 240 }}>
                    Expected Result
                  </th>
                  <th className="p-2.5" style={{ minWidth: 95 }}>
                    Status
                  </th>
                  <th className="p-2.5" style={{ minWidth: 140 }}>
                    Tags
                  </th>
                  <th className="p-2.5 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((c, rowIdx) => {
                  const isDup = dupTitles.has(c.title.trim().toLowerCase());
                  const missing = !c.title.trim();
                  const isSelected = selected.has(c.id);

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors hover:bg-muted/30 ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="p-2.5 align-top text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(v) => {
                            setSelected((s) => {
                              const n = new Set(s);
                              v ? n.add(c.id) : n.delete(c.id);
                              return n;
                            });
                          }}
                        />
                      </td>
                      <td className="p-2.5 align-top text-xs text-muted-foreground font-mono">
                        TC-{c.id.slice(0, 4)}
                      </td>
                      <td className="p-2.5 align-top">
                        <div className="flex items-center gap-1.5">
                          <Input
                            data-cell={`${c.id}-title`}
                            defaultValue={c.title}
                            onBlur={(e) =>
                              e.target.value !== c.title &&
                              updateCell(c.id, { title: e.target.value })
                            }
                            onKeyDown={(e) => onCellKey(e, rowIdx, "title")}
                            className={`h-8 border-transparent hover:border-input focus-visible:ring-1 bg-transparent ${
                              missing ? "border-rose-500" : ""
                            }`}
                          />
                          {(isDup || missing) && (
                            <span title={isDup ? "Duplicate title detected" : "Title is required"}>
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 align-top">
                        <Select
                          value={c.module_id ?? "none"}
                          onValueChange={(v) =>
                            updateCell(c.id, { module_id: v === "none" ? null : v } as any)
                          }
                        >
                          <SelectTrigger
                            data-cell={`${c.id}-module`}
                            className="h-8 border-transparent hover:border-input bg-transparent text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {projectModules.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2.5 align-top">
                        <Select
                          value={c.priority}
                          onValueChange={(v) => updateCell(c.id, { priority: v } as any)}
                        >
                          <SelectTrigger
                            data-cell={`${c.id}-priority`}
                            className={`h-8 border-transparent hover:border-input bg-transparent text-xs capitalize ${priorityColor[c.priority]}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2.5 align-top">
                        <Select
                          value={c.type}
                          onValueChange={(v) => updateCell(c.id, { type: v } as any)}
                        >
                          <SelectTrigger
                            data-cell={`${c.id}-type`}
                            className="h-8 border-transparent hover:border-input bg-transparent text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2.5 align-top">
                        <Textarea
                          data-cell={`${c.id}-preconditions`}
                          defaultValue={c.preconditions ?? ""}
                          rows={2}
                          placeholder="Preconditions…"
                          onBlur={(e) =>
                            e.target.value !== (c.preconditions ?? "") &&
                            updateCell(c.id, { preconditions: e.target.value })
                          }
                          onKeyDown={(e) => onCellKey(e, rowIdx, "preconditions")}
                          className="min-h-[2rem] text-xs border-transparent hover:border-input focus-visible:ring-1 resize-y bg-transparent"
                        />
                      </td>
                      <td className="p-2.5 align-top">
                        <div className="relative group/step">
                          <Textarea
                            data-cell={`${c.id}-steps`}
                            defaultValue={c.steps ?? ""}
                            rows={2}
                            placeholder="Numbered steps…"
                            onBlur={(e) =>
                              e.target.value !== (c.steps ?? "") &&
                              updateCell(c.id, { steps: e.target.value })
                            }
                            onKeyDown={(e) => onCellKey(e, rowIdx, "steps")}
                            className="min-h-[2rem] text-xs border-transparent hover:border-input focus-visible:ring-1 resize-y bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateTargetCaseId(c.id);
                              setTemplateOpen(true);
                            }}
                            className="absolute right-1 top-1 p-1 rounded bg-muted/80 text-muted-foreground hover:text-primary opacity-0 group-hover/step:opacity-100 transition-opacity"
                            title="Insert Step Template"
                          >
                            <Wand2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-2.5 align-top">
                        <Textarea
                          data-cell={`${c.id}-expected_result`}
                          defaultValue={c.expected_result ?? ""}
                          rows={2}
                          placeholder="Expected result…"
                          onBlur={(e) =>
                            e.target.value !== (c.expected_result ?? "") &&
                            updateCell(c.id, { expected_result: e.target.value })
                          }
                          onKeyDown={(e) => onCellKey(e, rowIdx, "expected_result")}
                          className="min-h-[2rem] text-xs border-transparent hover:border-input focus-visible:ring-1 resize-y bg-transparent"
                        />
                      </td>
                      <td className="p-2.5 align-top">
                        <Select
                          value={c.status}
                          onValueChange={(v) => updateCell(c.id, { status: v } as any)}
                        >
                          <SelectTrigger
                            data-cell={`${c.id}-status`}
                            className="h-8 border-transparent hover:border-input bg-transparent text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2.5 align-top">
                        <Input
                          data-cell={`${c.id}-tags`}
                          defaultValue={(c.tags ?? []).join(", ")}
                          placeholder="auth, smoke"
                          onBlur={(e) => {
                            const v = e.target.value
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean);
                            if (JSON.stringify(v) !== JSON.stringify(c.tags ?? []))
                              updateCell(c.id, { tags: v } as any);
                          }}
                          onKeyDown={(e) => onCellKey(e, rowIdx, "tags")}
                          className="h-8 text-xs border-transparent hover:border-input focus-visible:ring-1 bg-transparent"
                        />
                      </td>
                      <td className="p-2.5 align-top text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setDetailModalCase(c)}
                            title="Open Test Case Detail Modal"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                            onClick={() => remove([c.id])}
                            title="Delete Test Case"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={12} className="p-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground w-full justify-start text-xs hover:text-primary"
                      onClick={() => addRow()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add new test case (Enter)
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* ========================================================= */}
      {/* DETAILED TEST CASE MODAL                                  */}
      {/* ========================================================= */}
      <Dialog open={!!detailModalCase} onOpenChange={(v) => !v && setDetailModalCase(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailModalCase && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-3 pr-6">
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Test Case Details
                  </DialogTitle>
                  <Badge variant="outline" className="font-mono text-xs">
                    TC-{detailModalCase.id.slice(0, 6)}
                  </Badge>
                </div>
                <DialogDescription>
                  Full structured definition with preconditions, procedural steps, and assertions.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold">Title</Label>
                  <Input
                    value={detailModalCase.title}
                    onChange={(e) =>
                      setDetailModalCase({ ...detailModalCase, title: e.target.value })
                    }
                    onBlur={() =>
                      updateCell(detailModalCase.id, { title: detailModalCase.title })
                    }
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Module</Label>
                    <Select
                      value={detailModalCase.module_id ?? "none"}
                      onValueChange={(v) => {
                        const mid = v === "none" ? null : v;
                        setDetailModalCase({ ...detailModalCase, module_id: mid });
                        updateCell(detailModalCase.id, { module_id: mid } as any);
                      }}
                    >
                      <SelectTrigger className="mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No module</SelectItem>
                        {projectModules.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select
                      value={detailModalCase.priority}
                      onValueChange={(v) => {
                        setDetailModalCase({ ...detailModalCase, priority: v });
                        updateCell(detailModalCase.id, { priority: v } as any);
                      }}
                    >
                      <SelectTrigger className="mt-1 text-xs capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={detailModalCase.type}
                      onValueChange={(v) => {
                        setDetailModalCase({ ...detailModalCase, type: v });
                        updateCell(detailModalCase.id, { type: v } as any);
                      }}
                    >
                      <SelectTrigger className="mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={detailModalCase.status}
                      onValueChange={(v) => {
                        setDetailModalCase({ ...detailModalCase, status: v });
                        updateCell(detailModalCase.id, { status: v } as any);
                      }}
                    >
                      <SelectTrigger className="mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-amber-400">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Preconditions & Test Setup
                  </Label>
                  <Textarea
                    rows={2}
                    value={detailModalCase.preconditions ?? ""}
                    onChange={(e) =>
                      setDetailModalCase({ ...detailModalCase, preconditions: e.target.value })
                    }
                    onBlur={() =>
                      updateCell(detailModalCase.id, {
                        preconditions: detailModalCase.preconditions,
                      })
                    }
                    placeholder="e.g. User logged in as admin with 2FA enabled; test wallet balance is positive..."
                    className="mt-1 text-xs font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold">Test Procedure / Steps</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-primary gap-1"
                      onClick={() => {
                        setTemplateTargetCaseId(detailModalCase.id);
                        setTemplateOpen(true);
                      }}
                    >
                      <Wand2 className="h-3 w-3" />
                      Insert Step Template
                    </Button>
                  </div>
                  <Textarea
                    rows={5}
                    value={detailModalCase.steps ?? ""}
                    onChange={(e) =>
                      setDetailModalCase({ ...detailModalCase, steps: e.target.value })
                    }
                    onBlur={() =>
                      updateCell(detailModalCase.id, { steps: detailModalCase.steps })
                    }
                    placeholder="1. Navigate to...\n2. Enter...\n3. Assert..."
                    className="mt-1 text-xs font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Expected Result / Assertions</Label>
                  <Textarea
                    rows={3}
                    value={detailModalCase.expected_result ?? ""}
                    onChange={(e) =>
                      setDetailModalCase({ ...detailModalCase, expected_result: e.target.value })
                    }
                    onBlur={() =>
                      updateCell(detailModalCase.id, {
                        expected_result: detailModalCase.expected_result,
                      })
                    }
                    placeholder="Expected outcome, status code, or UI element verification..."
                    className="mt-1 text-xs font-mono"
                  />
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      addRow(detailModalCase);
                      setDetailModalCase(null);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Clone Case
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground text-xs"
                    onClick={() => setDetailModalCase(null)}
                  >
                    Done Editing
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Step Templates Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Standard QA Step Templates
            </DialogTitle>
            <DialogDescription>
              Select an industry-standard template to populate structured procedural steps and assertions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {STEP_TEMPLATES.map((tmpl, idx) => (
              <Card
                key={idx}
                className="p-3.5 border-border hover:border-primary/50 cursor-pointer transition-all hover:bg-muted/40"
                onClick={() => applyTemplate(tmpl)}
              >
                <div className="font-semibold text-xs text-foreground mb-1 flex items-center justify-between">
                  <span>{tmpl.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    Insert
                  </Badge>
                </div>
                <pre className="text-[11px] font-sans text-muted-foreground whitespace-pre-wrap line-clamp-3 bg-muted/30 p-2 rounded">
                  {tmpl.steps}
                </pre>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import test cases</DialogTitle>
            <DialogDescription>
              Upload Excel/CSV or paste from a spreadsheet. Supports Title, Preconditions, Steps,
              Expected Result, Priority, and Type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 pt-2">
            <div>
              <Label className="text-xs">Project</Label>
              <Select value={activeProject} onValueChange={setActiveProject}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button
                variant="link"
                size="sm"
                className="text-xs text-primary p-0 h-auto"
                onClick={downloadSampleTemplate}
              >
                Download Sample Excel Template (.xlsx)
              </Button>
            </div>

            <Tabs defaultValue="file">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="file">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Excel / CSV File
                </TabsTrigger>
                <TabsTrigger value="paste">
                  <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
                  Paste TSV / CSV
                </TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="space-y-2 pt-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={onFile}
                  className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:bg-primary file:text-primary-foreground hover:file:opacity-90"
                />
                <p className="text-xs text-muted-foreground">
                  Accepted headers: Title, Preconditions, Steps, Expected Result, Priority, Type.
                </p>
              </TabsContent>
              <TabsContent value="paste" className="space-y-2 pt-3">
                <Textarea
                  rows={8}
                  placeholder={`Title\tPriority\tPreconditions\tSteps\tExpected Result\nVerify checkout\thigh\tUser cart has item\t1. Click pay\tOrder created`}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button onClick={onPaste} className="w-full">
                  Import Pasted Rows
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Module dialog */}
      <Dialog open={moduleOpen} onOpenChange={setModuleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add module</DialogTitle>
            <DialogDescription>
              Group test cases hierarchically (e.g. Authentication, Billing, Search).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Module name"
              value={newModule}
              onChange={(e) => setNewModule(e.target.value)}
            />
            <Button onClick={addModule} className="w-full">
              Create module
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
