import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  PlayCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Bug,
  Check,
  Trash2,
  Sparkles,
  Loader2,
  ListChecks,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Download,
  FileText,
  Search,
  Maximize2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Copy,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Run = { id: string; name: string; status: string; project_id: string; created_at: string };
type Project = { id: string; name: string };
type Module = { id: string; name: string; project_id: string };
type TC = {
  id: string;
  title: string;
  module_id: string | null;
  steps: string | null;
  expected_result: string | null;
  preconditions: string | null;
  priority: string | null;
  type: string | null;
};
type Exec = {
  id: string;
  status: string;
  test_case_id: string;
  notes: string | null;
  browser: string | null;
  device: string | null;
  executed_at?: string | null;
};
type BugRow = {
  id: string;
  title: string;
  severity: string;
  status: string;
  linked_test_case: string | null;
  run_id: string | null;
};

const STATUSES = ["not_run", "pass", "fail", "blocked", "skipped"];
const SEVERITIES = ["low", "medium", "high", "critical"];

const statusColor: Record<string, string> = {
  pass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  fail: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  blocked: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  skipped: "bg-muted text-muted-foreground border-border",
  not_run: "bg-muted/60 text-muted-foreground border-border",
};

const priorityColor: Record<string, string> = {
  critical: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  medium: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  low: "bg-muted text-muted-foreground border-border",
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
  const [searchQuery, setSearchQuery] = useState("");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [selectedExecs, setSelectedExecs] = useState<Set<string>>(new Set());

  // Bug Dialog state
  const [bugOpen, setBugOpen] = useState<Exec | null>(null);
  const [bugForm, setBugForm] = useState({ title: "", description: "", severity: "medium" });

  // AI summary state
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Executive Sign-off Report modal state
  const [reportOpen, setReportOpen] = useState(false);

  // Expansion state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const expandAll = () => setExpanded(new Set(executions.map((e) => e.id)));
  const collapseAll = () => setExpanded(new Set());

  // ==========================================
  // FASTTRACK / FOCUS MODE PLAYER STATE
  // ==========================================
  const [playerOpen, setPlayerOpen] = useState(false);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [playerNotes, setPlayerNotes] = useState("");
  const [playerActualResult, setPlayerActualResult] = useState("");
  const [playerBrowser, setPlayerBrowser] = useState("Chrome 122");
  const [playerDevice, setPlayerDevice] = useState("Desktop");
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  // Stopwatch timer ref
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    const [r, p, m, c, b] = await Promise.all([
      supabase.from("test_runs").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
      supabase.from("modules").select("id,name,project_id"),
      supabase
        .from("test_cases")
        .select("id,title,module_id,steps,expected_result,preconditions,priority,type"),
      supabase.from("bugs").select("id,title,severity,status,linked_test_case,run_id"),
    ]);
    setRuns(r.data ?? []);
    setProjects(p.data ?? []);
    setModules(m.data ?? []);
    setCases((c.data ?? []) as any);
    setBugs((b.data ?? []) as any);
    if (p.data?.[0] && !projectId) setProjectId(p.data[0].id);
  };

  useEffect(() => {
    load();
  }, []);

  const loadExecs = async (run: Run) => {
    setActiveRun(run);
    setSelectedExecs(new Set());
    const { data } = await supabase
      .from("test_executions")
      .select("*")
      .eq("run_id", run.id)
      .order("created_at");
    setExecutions((data as any) ?? []);
  };

  const flash = (id: string) => {
    setSavedFlash(id);
    setTimeout(() => setSavedFlash((s) => (s === id ? null : s)), 1000);
  };

  const create = async () => {
    if (!name || !projectId || !user || !ws) return;
    const { data: run, error } = await supabase
      .from("test_runs")
      .insert({ name, project_id: projectId, owner_id: user.id, workspace_id: ws.id })
      .select()
      .single();
    if (error) return toast.error(error.message);
    const { data: cs } = await supabase
      .from("test_cases")
      .select("id")
      .eq("project_id", projectId);
    if (cs?.length) {
      await supabase.from("test_executions").insert(
        cs.map((c) => ({
          run_id: run.id,
          test_case_id: c.id,
          owner_id: user.id,
          workspace_id: ws.id,
        }))
      );
    }
    toast.success("Run created with " + (cs?.length || 0) + " cases");
    setOpen(false);
    setName("");
    load();
  };

  const updateExec = async (id: string, patch: Partial<Exec>) => {
    setExecutions((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const fullPatch: any = { ...patch };
    if (patch.status && patch.status !== "not_run") fullPatch.executed_at = new Date().toISOString();
    const { error } = await supabase.from("test_executions").update(fullPatch).eq("id", id);
    if (error) return toast.error(error.message);
    flash(id);
  };

  // Bulk actions on executions
  const bulkSetStatus = async (status: string) => {
    const ids = Array.from(selectedExecs);
    if (!ids.length) return;
    setExecutions((es) => es.map((e) => (ids.includes(e.id) ? { ...e, status } : e)));
    const fullPatch: any = { status };
    if (status !== "not_run") fullPatch.executed_at = new Date().toISOString();
    const { error } = await supabase.from("test_executions").update(fullPatch).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${ids.length} cases as ${status.toUpperCase()}`);
    setSelectedExecs(new Set());
  };

  const bulkSetEnvironment = async (browser: string, device: string) => {
    const ids = Array.from(selectedExecs);
    if (!ids.length) return;
    setExecutions((es) =>
      es.map((e) => (ids.includes(e.id) ? { ...e, browser, device } : e))
    );
    const { error } = await supabase
      .from("test_executions")
      .update({ browser, device })
      .in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Updated environment for ${ids.length} test cases`);
  };

  const updateRunStatus = async (id: string, status: string) => {
    setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    await supabase.from("test_runs").update({ status }).eq("id", id);
    if (status === "completed" && activeRun?.id === id) {
      const counts = executions.reduce(
        (acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }),
        {} as Record<string, number>
      );
      const total = executions.length || 1;
      const passRate = Math.round(((counts.pass ?? 0) / total) * 100);
      supabase.functions
        .invoke("send-notification", {
          body: {
            title: `✅ Run completed: ${activeRun.name}`,
            message: `Pass ${counts.pass ?? 0} · Fail ${counts.fail ?? 0} · Blocked ${counts.blocked ?? 0} · ${passRate}% pass rate`,
          },
        })
        .catch(() => {});
    }
  };

  const deleteRun = async (id: string) => {
    if (!confirm("Delete this run and all its executions?")) return;
    await supabase.from("test_executions").delete().eq("run_id", id);
    await supabase.from("bugs").update({ run_id: null }).eq("run_id", id);
    await supabase.from("test_runs").delete().eq("id", id);
    setRuns((rs) => rs.filter((r) => r.id !== id));
    toast.success("Run deleted");
  };

  const openBug = (e: Exec) => {
    const tc = cases.find((c) => c.id === e.test_case_id);
    const desc = [
      `**Failed Test:** ${tc?.title ?? "Test"}`,
      `**Module:** ${modules.find((m) => m.id === tc?.module_id)?.name ?? "N/A"}`,
      `**Environment:** ${e.browser || "Chrome"} on ${e.device || "Desktop"}`,
      tc?.preconditions ? `**Preconditions:**\n${tc.preconditions}` : "",
      tc?.steps ? `**Steps to Reproduce:**\n${tc.steps}` : "",
      tc?.expected_result ? `**Expected Result:**\n${tc.expected_result}` : "",
      e.notes ? `**Actual Result / Notes:**\n${e.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    setBugForm({
      title: `[Failure] ${tc?.title ?? "Test"} - ${activeRun?.name ?? "Run"}`,
      description: desc,
      severity: tc?.priority === "critical" ? "critical" : "high",
    });
    setBugOpen(e);
  };

  const fileBug = async () => {
    if (!bugOpen || !user || !activeRun) return;
    const { error } = await supabase.from("bugs").insert({
      title: bugForm.title,
      description: bugForm.description,
      severity: bugForm.severity as any,
      priority: "medium" as any,
      status: "open" as any,
      project_id: activeRun.project_id,
      owner_id: user.id,
      run_id: activeRun.id,
      linked_test_case: bugOpen.test_case_id,
    });
    if (error) return toast.error(error.message);
    toast.success("Bug filed & linked to execution");
    setBugOpen(null);
    load();
  };

  const runSummary = async () => {
    if (!activeRun) return;
    setSummaryLoading(true);
    setSummaryOpen(true);
    setSummary(null);
    const { data, error } = await supabase.functions.invoke("summarize-test-run", {
      body: { run_id: activeRun.id },
    });
    setSummaryLoading(false);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    setSummary(data?.summary ?? "No summary generated.");
  };

  // ----------------------------------------------------
  // FILTERED EXECUTIONS
  // ----------------------------------------------------
  const filtered = useMemo(() => {
    if (!activeRun) return [];
    return executions.filter((e) => {
      const tc = cases.find((c) => c.id === e.test_case_id);
      if (
        filterModule !== "all" &&
        (filterModule === "none" ? tc?.module_id : tc?.module_id !== filterModule)
      )
        return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      if (
        searchQuery &&
        !tc?.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [executions, cases, activeRun, filterModule, filterStatus, searchQuery]);

  // Bulk selection helpers
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selectedExecs.has(e.id));
  const toggleSelectAll = () => {
    setSelectedExecs((s) => {
      if (allFilteredSelected) return new Set();
      const n = new Set(s);
      filtered.forEach((e) => n.add(e.id));
      return n;
    });
  };

  // ====================================================
  // FASTTRACK / FOCUS MODE PLAYER CONTROLLERS
  // ====================================================
  const startPlayer = (startIndex = 0) => {
    if (!filtered.length) {
      toast.error("No test cases match the current filter to execute.");
      return;
    }
    const idx = Math.min(Math.max(0, startIndex), filtered.length - 1);
    setActivePlayerIndex(idx);
    setPlayerOpen(true);
    loadPlayerTestCase(idx);
  };

  const loadPlayerTestCase = (index: number) => {
    const exec = filtered[index];
    if (!exec) return;
    setTimerSeconds(0);
    setIsTimerRunning(true);
    setPlayerNotes(exec.notes ?? "");
    setPlayerActualResult("");
    setPlayerBrowser(exec.browser || "Chrome 122");
    setPlayerDevice(exec.device || "Desktop");
    setCheckedSteps({});
  };

  // Timer tick
  useEffect(() => {
    if (isTimerRunning && playerOpen) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, playerOpen]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Record verdict in FastTrack
  const recordVerdictAndAdvance = async (verdict: string) => {
    const currentExec = filtered[activePlayerIndex];
    if (!currentExec) return;

    const timeStr = `[⏱ ${formatTime(timerSeconds)}]`;
    const finalNotes = [
      playerActualResult ? `Actual: ${playerActualResult}` : "",
      playerNotes,
      timeStr,
    ]
      .filter(Boolean)
      .join(" | ");

    await updateExec(currentExec.id, {
      status: verdict,
      notes: finalNotes || currentExec.notes,
      browser: playerBrowser,
      device: playerDevice,
    });

    toast.success(`Test marked as ${verdict.toUpperCase()}`);

    // If fail, prompt quick bug filing dialog
    if (verdict === "fail") {
      openBug({
        ...currentExec,
        notes: finalNotes,
        browser: playerBrowser,
        device: playerDevice,
      });
    }

    // Auto advance to next case if available
    if (activePlayerIndex < filtered.length - 1) {
      const nextIdx = activePlayerIndex + 1;
      setActivePlayerIndex(nextIdx);
      loadPlayerTestCase(nextIdx);
    } else {
      toast.info("Reached end of test run queue!");
    }
  };

  // Global Keyboard shortcuts when player is open
  useEffect(() => {
    if (!playerOpen) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Don't trigger hotkeys if user is focused inside an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "p" || key === "1") {
        e.preventDefault();
        recordVerdictAndAdvance("pass");
      } else if (key === "f" || key === "2") {
        e.preventDefault();
        recordVerdictAndAdvance("fail");
      } else if (key === "b" || key === "3") {
        e.preventDefault();
        recordVerdictAndAdvance("blocked");
      } else if (key === "s" || key === "4") {
        e.preventDefault();
        recordVerdictAndAdvance("skipped");
      } else if (key === "arrowright" || key === "j") {
        e.preventDefault();
        if (activePlayerIndex < filtered.length - 1) {
          const next = activePlayerIndex + 1;
          setActivePlayerIndex(next);
          loadPlayerTestCase(next);
        }
      } else if (key === "arrowleft" || key === "k") {
        e.preventDefault();
        if (activePlayerIndex > 0) {
          const prev = activePlayerIndex - 1;
          setActivePlayerIndex(prev);
          loadPlayerTestCase(prev);
        }
      } else if (e.key === " ") {
        e.preventDefault();
        setIsTimerRunning((r) => !r);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    playerOpen,
    activePlayerIndex,
    filtered,
    timerSeconds,
    playerNotes,
    playerActualResult,
    playerBrowser,
    playerDevice,
  ]);

  // Export Run to CSV
  const exportRunCsv = () => {
    if (!activeRun) return;
    const headers = [
      "Run Name",
      "Test Case ID",
      "Title",
      "Module",
      "Priority",
      "Status",
      "Browser",
      "Device",
      "Notes",
      "Executed At",
      "Bugs Count",
    ];

    const rows = executions.map((e) => {
      const tc = cases.find((c) => c.id === e.test_case_id);
      const mod = tc ? modules.find((m) => m.id === tc.module_id) : null;
      const bCount = bugs.filter(
        (b) =>
          b.linked_test_case === e.test_case_id &&
          (b.run_id === activeRun.id || !b.run_id)
      ).length;

      const clean = (val: string | null | undefined) =>
        `"${(val ?? "").toString().replace(/"/g, '""')}"`;

      return [
        clean(activeRun.name),
        clean(`TC-${e.test_case_id.slice(0, 6)}`),
        clean(tc?.title),
        clean(mod?.name ?? "General"),
        clean(tc?.priority ?? "medium"),
        clean(e.status),
        clean(e.browser ?? "Chrome"),
        clean(e.device ?? "Desktop"),
        clean(e.notes ?? ""),
        clean(e.executed_at ?? "N/A"),
        bCount,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `test-run-${activeRun.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Test run exported to CSV");
  };

  // Generate Executive Sign-Off Markdown report
  const generateSignOffReport = () => {
    if (!activeRun) return "";
    const counts = executions.reduce(
      (acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }),
      {} as Record<string, number>
    );
    const total = executions.length || 1;
    const passCount = counts.pass ?? 0;
    const failCount = counts.fail ?? 0;
    const blockedCount = counts.blocked ?? 0;
    const skippedCount = counts.skipped ?? 0;
    const notRunCount = counts.not_run ?? 0;
    const passRate = Math.round((passCount / total) * 100);
    const executedTotal = total - notRunCount;
    const executionProgress = Math.round((executedTotal / total) * 100);

    const linkedBugs = bugs.filter((b) => b.run_id === activeRun.id);
    const criticalBugs = linkedBugs.filter(
      (b) => b.severity === "critical" || b.severity === "high"
    );

    const isGo = passRate >= 95 && criticalBugs.length === 0;

    return `# QA RELEASE SIGN-OFF CERTIFICATE
**Test Run:** ${activeRun.name}
**Project:** ${projects.find((p) => p.id === activeRun.project_id)?.name ?? "N/A"}
**Sign-off Date:** ${new Date().toLocaleDateString()}
**Lead QA Signatory:** ${user?.email ?? "QA Lead"}
**Execution Status:** ${activeRun.status.toUpperCase()}

---

## 1. Executive Summary & Quality Gate
- **Recommendation:** ${isGo ? "🟢 GO FOR RELEASE (Passed Quality Gate)" : "🔴 CONDITIONAL / NO-GO (Action Required)"}
- **Overall Pass Rate:** **${passRate}%** (Target threshold: ≥ 95%)
- **Test Execution Coverage:** **${executionProgress}%** (${executedTotal} / ${total} planned cases executed)
- **Open Critical / Blocker Defects:** **${criticalBugs.length}** (Threshold: 0)

---

## 2. ISTQB Execution Metrics Breakdown
| Metric | Count | Percentage |
| :--- | :--- | :--- |
| **Total Test Cases Planned** | ${total} | 100% |
| **Passed (P)** | ${passCount} | ${Math.round((passCount / total) * 100)}% |
| **Failed (F)** | ${failCount} | ${Math.round((failCount / total) * 100)}% |
| **Blocked (B)** | ${blockedCount} | ${Math.round((blockedCount / total) * 100)}% |
| **Skipped (S)** | ${skippedCount} | ${Math.round((skippedCount / total) * 100)}% |
| **Not Run / Remaining** | ${notRunCount} | ${Math.round((notRunCount / total) * 100)}% |

---

## 3. Defect & Blocker Log
${
  linkedBugs.length === 0
    ? "_No defects logged during this execution cycle._"
    : linkedBugs
        .map(
          (b) =>
            `- **[${b.severity.toUpperCase()}]** ${b.title} *(Status: ${b.status})*`
        )
        .join("\n")
}

---
*Generated by TestFlow AI Enterprise QA Suite*
`;
  };

  // ----------------------------------------------------
  // DETAIL VIEW
  // ----------------------------------------------------
  if (activeRun) {
    const projectModules = modules.filter((m) => m.project_id === activeRun.project_id);
    const counts = executions.reduce(
      (acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }),
      {} as Record<string, number>
    );
    const total = executions.length;
    const passRate = total ? Math.round(((counts.pass ?? 0) / total) * 100) : 0;
    const executedCount = total - (counts.not_run ?? 0);
    const progressPct = total ? Math.round((executedCount / total) * 100) : 0;

    // Active test case in player
    const activePlayerExec = filtered[activePlayerIndex];
    const activePlayerTC = activePlayerExec
      ? cases.find((c) => c.id === activePlayerExec.test_case_id)
      : null;
    const activePlayerModule = activePlayerTC
      ? modules.find((m) => m.id === activePlayerTC.module_id)
      : null;

    // Parse steps into numbered list for checklist
    const parsedSteps = activePlayerTC?.steps
      ? activePlayerTC.steps
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    return (
      <div className="space-y-4 max-w-[1500px]">
        {/* Top Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveRun(null);
                load();
              }}
            >
              ← Back to runs
            </Button>
            <div className="h-4 w-px bg-border" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{activeRun.name}</h1>
                <Badge
                  variant="outline"
                  className={
                    activeRun.status === "completed"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-primary/15 text-primary border-primary/30"
                  }
                >
                  {activeRun.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {projects.find((p) => p.id === activeRun.project_id)?.name} · Created{" "}
                {new Date(activeRun.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary CTA: Start FastTrack Execution Player */}
            <Button
              onClick={() => startPlayer(0)}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium shadow-lg shadow-emerald-900/20 gap-2"
            >
              <Play className="h-4 w-4 fill-white" />
              FastTrack Player
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setReportOpen(true)}
            >
              <FileText className="h-4 w-4 text-primary" />
              Sign-Off Report
            </Button>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportRunCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={runSummary}
              disabled={summaryLoading}
            >
              {summaryLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary" />
              )}
              AI summary
            </Button>

            <Select
              value={activeRun.status}
              onValueChange={(v) => {
                setActiveRun({ ...activeRun, status: v });
                updateRunStatus(activeRun.id, v);
              }}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="aborted">Aborted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Progress & Metrics Dashboard Bar */}
        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border/70">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center divide-x divide-border/40">
            <div>
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Total Planned
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">{counts.pass ?? 0}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Passed
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-400">{counts.fail ?? 0}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Failed
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">{counts.blocked ?? 0}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Blocked
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-muted-foreground">
                {counts.not_run ?? 0}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Pending
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{passRate}%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Pass Rate ({progressPct}% executed)
              </div>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="mt-3.5 w-full bg-muted/40 h-2 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${((counts.pass ?? 0) / (total || 1)) * 100}%` }}
              className="bg-emerald-500 h-full transition-all"
              title={`Passed: ${counts.pass ?? 0}`}
            />
            <div
              style={{ width: `${((counts.fail ?? 0) / (total || 1)) * 100}%` }}
              className="bg-rose-500 h-full transition-all"
              title={`Failed: ${counts.fail ?? 0}`}
            />
            <div
              style={{ width: `${((counts.blocked ?? 0) / (total || 1)) * 100}%` }}
              className="bg-amber-500 h-full transition-all"
              title={`Blocked: ${counts.blocked ?? 0}`}
            />
            <div
              style={{ width: `${((counts.skipped ?? 0) / (total || 1)) * 100}%` }}
              className="bg-slate-500 h-full transition-all"
              title={`Skipped: ${counts.skipped ?? 0}`}
            />
          </div>
        </Card>

        {/* Filter and Bulk Operations Bar */}
        <Card className="p-3 flex flex-wrap items-center gap-2.5">
          <div className="relative w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search test cases…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          <Select value={filterModule} onValueChange={setFilterModule}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue />
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
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Quick status filter chips */}
          <div className="flex items-center gap-1 border-l border-border/50 pl-2">
            <Button
              size="sm"
              variant={filterStatus === "fail" ? "destructive" : "ghost"}
              className="h-8 text-xs px-2.5 gap-1"
              onClick={() => setFilterStatus(filterStatus === "fail" ? "all" : "fail")}
            >
              <XCircle className="h-3.5 w-3.5 text-rose-400" />
              Failed ({counts.fail ?? 0})
            </Button>
            <Button
              size="sm"
              variant={filterStatus === "not_run" ? "secondary" : "ghost"}
              className="h-8 text-xs px-2.5 gap-1"
              onClick={() => setFilterStatus(filterStatus === "not_run" ? "all" : "not_run")}
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Pending ({counts.not_run ?? 0})
            </Button>
          </div>

          <div className="flex items-center gap-1 border-l border-border/50 pl-2">
            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={expandAll}>
              <ChevronDown className="h-3.5 w-3.5" />
              Expand all
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={collapseAll}>
              <ChevronRight className="h-3.5 w-3.5" />
              Collapse
            </Button>
          </div>

          <div className="ml-auto text-xs text-muted-foreground font-mono">
            {filtered.length} of {total} cases
          </div>
        </Card>

        {/* Bulk Action Banner when rows selected */}
        {selectedExecs.size > 0 && (
          <Card className="p-2.5 px-4 bg-primary/10 border-primary/30 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40 font-mono">
                {selectedExecs.size} selected
              </Badge>
              <span className="text-xs text-muted-foreground">Apply bulk verdict:</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 gap-1"
                onClick={() => bulkSetStatus("pass")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Pass Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 gap-1"
                onClick={() => bulkSetStatus("fail")}
              >
                <XCircle className="h-3.5 w-3.5" />
                Fail Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 gap-1"
                onClick={() => bulkSetStatus("blocked")}
              >
                <MinusCircle className="h-3.5 w-3.5" />
                Block Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => bulkSetStatus("skipped")}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Skip Selected
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setSelectedExecs(new Set())}
              >
                Clear selection
              </Button>
            </div>
          </Card>
        )}

        {/* Executions Table */}
        <Card className="overflow-hidden border-border/70">
          <div className="overflow-auto max-h-[calc(100vh-370px)]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-card z-10 border-b border-border/60">
                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="p-2.5 w-10 text-center">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all executions"
                    />
                  </th>
                  <th className="p-2.5" style={{ minWidth: 300 }}>
                    Test Case & Preconditions
                  </th>
                  <th className="p-2.5" style={{ minWidth: 120 }}>
                    Module
                  </th>
                  <th className="p-2.5" style={{ minWidth: 150 }}>
                    Verdict
                  </th>
                  <th className="p-2.5" style={{ minWidth: 110 }}>
                    Browser
                  </th>
                  <th className="p-2.5" style={{ minWidth: 110 }}>
                    Device
                  </th>
                  <th className="p-2.5" style={{ minWidth: 200 }}>
                    Execution Notes
                  </th>
                  <th className="p-2.5" style={{ minWidth: 180 }}>
                    Linked Defects
                  </th>
                  <th className="p-2.5 w-24 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((e, index) => {
                  const tc = cases.find((c) => c.id === e.test_case_id);
                  const mod = tc ? modules.find((m) => m.id === tc.module_id) : null;
                  const linked = bugs.filter(
                    (b) =>
                      b.linked_test_case === e.test_case_id &&
                      (b.run_id === activeRun.id || !b.run_id)
                  );
                  const isOpen = expanded.has(e.id);
                  const hasDetail = !!(tc?.steps || tc?.expected_result || tc?.preconditions);
                  const isSelected = selectedExecs.has(e.id);

                  return (
                    <Fragment key={e.id}>
                      <tr
                        className={`transition-colors hover:bg-muted/40 ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="p-2.5 align-top text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              setSelectedExecs((s) => {
                                const n = new Set(s);
                                checked ? n.add(e.id) : n.delete(e.id);
                                return n;
                              });
                            }}
                          />
                        </td>
                        <td className="p-2.5 align-top">
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExpand(e.id)}
                              className="mt-0.5 p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0"
                              title={isOpen ? "Collapse details" : "Expand details"}
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-foreground">{tc?.title ?? "—"}</span>
                                {tc?.priority && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 uppercase ${priorityColor[tc.priority]}`}
                                  >
                                    {tc.priority}
                                  </Badge>
                                )}
                              </div>
                              {tc?.preconditions && (
                                <p className="text-xs text-muted-foreground line-clamp-1 italic">
                                  Pre: {tc.preconditions}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-2.5 align-top text-xs text-muted-foreground">
                          {mod?.name ?? "—"}
                        </td>
                        <td className="p-2.5 align-top">
                          <div className="flex items-center gap-1 flex-wrap">
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`h-7 w-7 p-0 rounded-full ${
                                      e.status === "pass"
                                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                        : "hover:bg-muted text-muted-foreground"
                                    }`}
                                    onClick={() => updateExec(e.id, { status: "pass" })}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mark as Pass (P)</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`h-7 w-7 p-0 rounded-full ${
                                      e.status === "fail"
                                        ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                                        : "hover:bg-muted text-muted-foreground"
                                    }`}
                                    onClick={() => updateExec(e.id, { status: "fail" })}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mark as Fail (F)</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`h-7 w-7 p-0 rounded-full ${
                                      e.status === "blocked"
                                        ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                                        : "hover:bg-muted text-muted-foreground"
                                    }`}
                                    onClick={() => updateExec(e.id, { status: "blocked" })}
                                  >
                                    <MinusCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mark as Blocked (B)</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`h-7 w-7 p-0 rounded-full ${
                                      e.status === "skipped"
                                        ? "bg-muted text-foreground"
                                        : "hover:bg-muted text-muted-foreground"
                                    }`}
                                    onClick={() => updateExec(e.id, { status: "skipped" })}
                                  >
                                    <HelpCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mark as Skipped (S)</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <Badge
                              variant="outline"
                              className={`text-[11px] capitalize ${statusColor[e.status]}`}
                            >
                              {e.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-2.5 align-top">
                          <Input
                            defaultValue={e.browser ?? ""}
                            placeholder="Chrome"
                            onBlur={(ev) =>
                              ev.target.value !== (e.browser ?? "") &&
                              updateExec(e.id, { browser: ev.target.value })
                            }
                            className="h-8 text-xs border-transparent hover:border-input focus-visible:ring-1 bg-transparent"
                          />
                        </td>
                        <td className="p-2.5 align-top">
                          <Input
                            defaultValue={e.device ?? ""}
                            placeholder="Desktop"
                            onBlur={(ev) =>
                              ev.target.value !== (e.device ?? "") &&
                              updateExec(e.id, { device: ev.target.value })
                            }
                            className="h-8 text-xs border-transparent hover:border-input focus-visible:ring-1 bg-transparent"
                          />
                        </td>
                        <td className="p-2.5 align-top">
                          <Textarea
                            defaultValue={e.notes ?? ""}
                            rows={1}
                            placeholder="Add actual result or notes…"
                            onBlur={(ev) =>
                              ev.target.value !== (e.notes ?? "") &&
                              updateExec(e.id, { notes: ev.target.value })
                            }
                            className="min-h-[2rem] text-xs border-transparent hover:border-input focus-visible:ring-1 resize-y bg-transparent"
                          />
                        </td>
                        <td className="p-2.5 align-top">
                          <div className="flex flex-wrap gap-1 items-center">
                            {linked.map((b) => (
                              <Link
                                key={b.id}
                                to="/app/bugs"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
                              >
                                <Bug className="h-3 w-3" />
                                {b.title.slice(0, 20)}...
                              </Link>
                            ))}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => openBug(e)}
                            >
                              <Plus className="h-3 w-3" />
                              Defect
                            </Button>
                          </div>
                        </td>
                        <td className="p-2.5 align-top text-right">
                          <div className="flex items-center justify-end gap-1">
                            {savedFlash === e.id ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium animate-in fade-in">
                                <Check className="h-3.5 w-3.5" />
                                Saved
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => startPlayer(index)}
                                title="Run in FastTrack Player"
                              >
                                <Play className="h-3 w-3 fill-current" />
                                Play
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable step details row */}
                      {isOpen && (
                        <tr className="border-b border-border/40 bg-muted/20">
                          <td colSpan={9} className="p-4 pl-12">
                            <div className="grid md:grid-cols-3 gap-4 text-sm">
                              {tc?.preconditions && (
                                <div className="space-y-1.5">
                                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    Preconditions
                                  </div>
                                  <div className="text-xs bg-card/80 border rounded p-3 leading-relaxed whitespace-pre-wrap">
                                    {tc.preconditions}
                                  </div>
                                </div>
                              )}
                              <div
                                className={tc?.preconditions ? "space-y-1.5" : "space-y-1.5 md:col-span-2"}
                              >
                                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                  <ListChecks className="h-3.5 w-3.5" />
                                  Steps to Reproduce
                                </div>
                                {tc?.steps ? (
                                  <pre className="whitespace-pre-wrap font-sans text-xs bg-card/80 border rounded p-3 leading-relaxed">
                                    {tc.steps}
                                  </pre>
                                ) : (
                                  <div className="text-xs text-muted-foreground italic p-2">
                                    No steps recorded.{" "}
                                    <Link to="/app/test-cases" className="text-primary underline">
                                      Add steps
                                    </Link>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  Expected Result
                                </div>
                                {tc?.expected_result ? (
                                  <pre className="whitespace-pre-wrap font-sans text-xs bg-card/80 border rounded p-3 leading-relaxed">
                                    {tc.expected_result}
                                  </pre>
                                ) : (
                                  <div className="text-xs text-muted-foreground italic p-2">
                                    No expected result recorded.
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-muted-foreground">
                      No executions match the selected filters or search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ========================================================= */}
        {/* FASTTRACK / FOCUS MODE MANUAL EXECUTION PLAYER MODAL       */}
        {/* ========================================================= */}
        <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
          <DialogContent className="max-w-5xl h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border/80 shadow-2xl">
            {/* Player Top Navigation Bar */}
            <div className="p-4 border-b border-border/70 flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  FastTrack Execution Player
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">
                  Case {activePlayerIndex + 1} of {filtered.length}
                </span>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={activePlayerIndex <= 0}
                    onClick={() => {
                      const prev = activePlayerIndex - 1;
                      setActivePlayerIndex(prev);
                      loadPlayerTestCase(prev);
                    }}
                    title="Previous Test Case (K or Left Arrow)"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={activePlayerIndex >= filtered.length - 1}
                    onClick={() => {
                      const next = activePlayerIndex + 1;
                      setActivePlayerIndex(next);
                      loadPlayerTestCase(next);
                    }}
                    title="Next Test Case (J or Right Arrow)"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Stopwatch & Environment */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-background border border-border">
                  <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />
                  <span className="font-mono text-sm font-semibold tracking-wider">
                    {formatTime(timerSeconds)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 ml-1"
                    onClick={() => setIsTimerRunning((r) => !r)}
                    title={isTimerRunning ? "Pause timer (Space)" : "Resume timer (Space)"}
                  >
                    {isTimerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setTimerSeconds(0)}
                    title="Reset stopwatch"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    value={playerBrowser}
                    onChange={(e) => setPlayerBrowser(e.target.value)}
                    placeholder="Browser"
                    className="h-8 w-28 text-xs bg-background"
                  />
                  <Input
                    value={playerDevice}
                    onChange={(e) => setPlayerDevice(e.target.value)}
                    placeholder="Device"
                    className="h-8 w-28 text-xs bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Player Body Split Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Test Queue Sidebar */}
              <div className="w-72 border-r border-border/70 overflow-y-auto bg-muted/10 p-2 space-y-1">
                <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Run Queue ({filtered.length})
                </div>
                {filtered.map((item, idx) => {
                  const tc = cases.find((c) => c.id === item.test_case_id);
                  const isCurrent = idx === activePlayerIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActivePlayerIndex(idx);
                        loadPlayerTestCase(idx);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                        isCurrent
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "hover:bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      <span className="truncate flex-1">
                        {idx + 1}. {tc?.title ?? "Untitled Case"}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 uppercase shrink-0 ${
                          isCurrent
                            ? "border-primary-foreground/40 text-primary-foreground"
                            : statusColor[item.status]
                        }`}
                      >
                        {item.status.replace("_", "")}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* Main Execution Arena */}
              <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-5">
                {activePlayerTC ? (
                  <>
                    {/* Header info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs uppercase">
                          {activePlayerModule?.name ?? "General Module"}
                        </Badge>
                        {activePlayerTC.priority && (
                          <Badge
                            variant="outline"
                            className={`text-xs uppercase ${priorityColor[activePlayerTC.priority]}`}
                          >
                            {activePlayerTC.priority}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-xs uppercase ${statusColor[activePlayerExec?.status ?? "not_run"]}`}
                        >
                          Status: {activePlayerExec?.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <h2 className="text-xl font-bold tracking-tight text-foreground">
                        {activePlayerTC.title}
                      </h2>
                    </div>

                    {/* Preconditions callout if any */}
                    {activePlayerTC.preconditions && (
                      <Card className="p-3.5 bg-amber-500/10 border-amber-500/20 text-xs">
                        <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Preconditions
                        </div>
                        <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {activePlayerTC.preconditions}
                        </p>
                      </Card>
                    )}

                    {/* Test Steps with interactive step-by-step checkboxes */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ListChecks className="h-4 w-4 text-primary" />
                        Step-by-Step Test Procedure
                      </div>
                      {parsedSteps.length > 0 ? (
                        <div className="space-y-2">
                          {parsedSteps.map((step, sIdx) => (
                            <div
                              key={sIdx}
                              onClick={() =>
                                setCheckedSteps((prev) => ({ ...prev, [sIdx]: !prev[sIdx] }))
                              }
                              className={`p-3 rounded-lg border text-xs cursor-pointer flex items-start gap-3 transition-colors ${
                                checkedSteps[sIdx]
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                  : "bg-card border-border hover:border-primary/50"
                              }`}
                            >
                              <Checkbox
                                checked={!!checkedSteps[sIdx]}
                                onCheckedChange={() =>
                                  setCheckedSteps((prev) => ({ ...prev, [sIdx]: !prev[sIdx] }))
                                }
                                className="mt-0.5"
                              />
                              <div className="leading-relaxed flex-1 select-none">{step}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-muted/30 border rounded-lg text-xs text-muted-foreground italic">
                          No procedural steps specified for this test case.
                        </div>
                      )}
                    </div>

                    {/* Expected Result */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        Expected Result
                      </div>
                      <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
                        {activePlayerTC.expected_result || "No expected result documented."}
                      </div>
                    </div>

                    {/* Tester Actual Result & Notes Input */}
                    <div className="grid md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Actual Result / Observation</Label>
                        <Textarea
                          rows={2}
                          value={playerActualResult}
                          onChange={(e) => setPlayerActualResult(e.target.value)}
                          placeholder="e.g. Button responded within 120ms with correct payload..."
                          className="text-xs resize-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Tester Execution Notes</Label>
                        <Textarea
                          rows={2}
                          value={playerNotes}
                          onChange={(e) => setPlayerNotes(e.target.value)}
                          placeholder="Additional notes, screenshots, or observations..."
                          className="text-xs resize-none"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center text-muted-foreground">No case selected.</div>
                )}
              </div>
            </div>

            {/* Player Bottom Verdict Action Bar with Keyboard Shortcuts */}
            <div className="p-4 border-t border-border/70 bg-card/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Hotkeys:</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">P</kbd> Pass
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">F</kbd> Fail & Bug
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">B</kbd> Block
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">S</kbd> Skip
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">Space</kbd> Pause
                </span>
              </div>

              {/* Big Verdict Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 px-4 text-xs font-semibold bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 gap-2"
                  onClick={() => recordVerdictAndAdvance("fail")}
                >
                  <XCircle className="h-4 w-4" />
                  Fail & Log Defect (F)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 px-4 text-xs font-semibold bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 gap-2"
                  onClick={() => recordVerdictAndAdvance("blocked")}
                >
                  <MinusCircle className="h-4 w-4" />
                  Blocked (B)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 px-4 text-xs font-semibold gap-2"
                  onClick={() => recordVerdictAndAdvance("skipped")}
                >
                  <HelpCircle className="h-4 w-4" />
                  Skip (S)
                </Button>
                <Button
                  size="sm"
                  className="h-10 px-6 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 gap-2"
                  onClick={() => recordVerdictAndAdvance("pass")}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Pass & Next (P)
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* File bug dialog */}
        <Dialog open={!!bugOpen} onOpenChange={(v) => !v && setBugOpen(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-400">
                <Bug className="h-5 w-5" />
                File defect for execution failure
              </DialogTitle>
              <DialogDescription>
                Linked automatically to this test run and failed test case.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 pt-2">
              <div>
                <Label className="text-xs">Defect Title</Label>
                <Input
                  value={bugForm.title}
                  onChange={(e) => setBugForm({ ...bugForm, title: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Severity</Label>
                <Select
                  value={bugForm.severity}
                  onValueChange={(v) => setBugForm({ ...bugForm, severity: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Steps to Reproduce & Observations</Label>
                <Textarea
                  rows={6}
                  value={bugForm.description}
                  onChange={(e) => setBugForm({ ...bugForm, description: e.target.value })}
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <Button onClick={fileBug} className="w-full bg-gradient-hero border-0">
                Log Bug & Link to Test
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* AI summary dialog */}
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Test Run Summary
              </DialogTitle>
              <DialogDescription>
                Generated from this run's executions, failures, and linked bugs.
              </DialogDescription>
            </DialogHeader>
            {summaryLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing run telemetry and defect density...
              </div>
            ) : (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed p-2">
                {summary}
              </div>
            )}
            {summary && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(summary);
                  toast.success("Summary copied to clipboard");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Summary
              </Button>
            )}
          </DialogContent>
        </Dialog>

        {/* Executive Sign-off Report Dialog */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <FileText className="h-5 w-5" />
                QA Release Sign-Off Certificate
              </DialogTitle>
              <DialogDescription>
                Formal release governance certificate adhering to IEEE 829 & ISTQB standards.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-card border rounded-lg p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {generateSignOffReport()}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(generateSignOffReport());
                  toast.success("Sign-off certificate copied to clipboard");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Markdown
              </Button>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground gap-1.5"
                onClick={() => {
                  const blob = new Blob([generateSignOffReport()], {
                    type: "text/markdown;charset=utf-8;",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `QA-SignOff-${activeRun.name.replace(/\s+/g, "-")}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Downloaded Sign-Off Certificate");
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Download .md
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ----------------------------------------------------
  // RUNS LIST VIEW
  // ----------------------------------------------------
  const runStats = (runId: string) => bugs.filter((b) => b.run_id === runId).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Runs</h1>
          <p className="text-muted-foreground text-sm">
            Execute manual and automated test cycles with the FastTrack focus player.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-hero border-0 gap-2" disabled={!projects.length}>
              <Plus className="h-4 w-4" />
              New test run
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New test run</DialogTitle>
              <DialogDescription>
                Creates a test execution cycle populated with all test cases in the project.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 pt-2">
              <div>
                <Label className="text-xs">Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
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
              <div>
                <Label className="text-xs">Run Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sprint 24 Regression & Sanity"
                  className="mt-1"
                />
              </div>
              <Button onClick={create} className="w-full bg-gradient-hero border-0">
                Create execution cycle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {runs.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card">
          <PlayCircle className="h-12 w-12 mx-auto text-primary mb-3.5 opacity-80" />
          <h3 className="font-semibold text-lg mb-1">No test runs created yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
            Test runs track the execution of test cases against specific versions, builds, and
            environments.
          </p>
          <Button
            onClick={() => setOpen(true)}
            className="bg-primary text-primary-foreground gap-2"
            disabled={!projects.length}
          >
            <Plus className="h-4 w-4" />
            Create First Run
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3.5">
          {runs.map((r) => {
            const project = projects.find((p) => p.id === r.project_id);
            const bugCount = runStats(r.id);
            return (
              <Card
                key={r.id}
                className="p-4 flex items-center hover:shadow-elegant transition-all border-border/80 group cursor-pointer"
                onClick={() => loadExecs(r)}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mr-3.5 group-hover:scale-105 transition-transform">
                  <PlayCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span className="truncate">{r.name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase ${
                        r.status === "completed"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-primary/15 text-primary border-primary/30"
                      }`}
                    >
                      {r.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {project?.name} · Created {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {bugCount > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-rose-500/10 text-rose-400 border-rose-500/30 gap-1 text-xs"
                    >
                      <Bug className="h-3.5 w-3.5" />
                      {bugCount} {bugCount === 1 ? "defect" : "defects"}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                    onClick={() => loadExecs(r)}
                  >
                    Open Cycle
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-rose-400"
                    onClick={() => deleteRun(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
