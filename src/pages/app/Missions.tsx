import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bot, Play, Square, AlertCircle, CheckCircle2, Clock, ShieldAlert,
  Layers, Terminal, Bug, FileCheck, RefreshCw, Cpu, Activity,
  ExternalLink, Sparkles, Monitor, Smartphone, Tablet, Globe, Check
} from "lucide-react";
import { toast } from "sonner";
import {
  AgentOrchestrator,
  MissionConfig,
  AgentStepEvent,
  TestingScopeItem,
  HumanApprovalRequest,
  QAMissionReport,
  browserBridge,
  BrowserRunnerStatus
} from "@/services/agent";
import { EvidenceModal, EvidenceData } from "@/components/agent/EvidenceModal";
import { Link } from "react-router-dom";

type Project = { id: string; name: string };

const SCOPE_OPTIONS: { id: TestingScopeItem; label: string; desc: string }[] = [
  { id: "functional", label: "Functional Testing", desc: "User flows, happy path, state transitions" },
  { id: "regression", label: "Regression Testing", desc: "Verify previously passing modules" },
  { id: "ui", label: "UI & Visual Testing", desc: "Element visibility, layout, missing items" },
  { id: "responsive", label: "Responsive Testing", desc: "Viewport adapting across screen sizes" },
  { id: "form", label: "Form Testing", desc: "Input validation, field constraints, submits" },
  { id: "accessibility", label: "Accessibility Testing", desc: "Semantic tags, labels, contrast" },
  { id: "performance", label: "Performance Testing", desc: "Page load, latency, response times" },
  { id: "api", label: "API Testing", desc: "Endpoint status codes and payload schema" },
];

const PHASE_ORDER = [
  "MISSION_CREATED",
  "PLANNING",
  "DISCOVERING",
  "TEST_DESIGN",
  "EXECUTING",
  "OBSERVING",
  "INVESTIGATING",
  "VERIFYING",
  "BUG_CREATION",
  "REPORTING",
  "COMPLETED"
];

export default function Missions() {
  const { user } = useAuth();
  const { current: ws } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Mission Config Form
  const [form, setForm] = useState<{
    name: string;
    targetUrl: string;
    objective: string;
    environment: "development" | "staging" | "production" | "local";
    browser: "chrome" | "firefox" | "safari" | "edge";
    device: "desktop" | "tablet" | "mobile";
    authRequired: boolean;
    loginUrl: string;
    username: string;
    password: string;
    scope: TestingScopeItem[];
    projectId: string;
  }>({
    name: "Autonomous QA Regression",
    targetUrl: "https://example.com",
    objective: "Test the primary navigation, interactive controls, and error handling flows.",
    environment: "staging",
    browser: "chrome",
    device: "desktop",
    authRequired: false,
    loginUrl: "",
    username: "",
    password: "",
    scope: ["functional", "ui", "responsive", "form"],
    projectId: "",
  });

  // Runner state
  const [runnerStatus, setRunnerStatus] = useState<BrowserRunnerStatus>(browserBridge.getStatus());
  const [runnerDialogOpen, setRunnerDialogOpen] = useState(false);
  const [runnerUrlInput, setRunnerUrlInput] = useState(runnerStatus.endpoint);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [orchestrator, setOrchestrator] = useState<AgentOrchestrator | null>(null);
  const [events, setEvents] = useState<AgentStepEvent[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>("IDLE");
  const [report, setReport] = useState<QAMissionReport | null>(null);

  // Human approval modal state
  const [pendingApproval, setPendingApproval] = useState<HumanApprovalRequest | null>(null);
  const approvalResolverRef = useRef<((val: boolean) => void) | null>(null);

  // Evidence state
  const [activeEvidence, setActiveEvidence] = useState<EvidenceData | null>(null);

  const timelineEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("projects").select("id,name").then(({ data }) => {
      setProjects(data ?? []);
      if (data?.[0]) setForm(f => ({ ...f, projectId: data[0].id }));
    });
    browserBridge.checkConnection().then(setRunnerStatus);
  }, []);

  useEffect(() => {
    if (isRunning) {
      timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, isRunning]);

  const toggleScope = (id: TestingScopeItem) => {
    setForm(f => ({
      ...f,
      scope: f.scope.includes(id) ? f.scope.filter(s => s !== id) : [...f.scope, id]
    }));
  };

  const handleStartMission = async () => {
    if (!form.targetUrl.trim() || !form.objective.trim()) {
      return toast.error("Target URL and Testing Objective are required");
    }

    const config: MissionConfig = {
      id: `mission_${Date.now()}`,
      name: form.name,
      targetUrl: form.targetUrl,
      objective: form.objective,
      environment: form.environment,
      browser: form.browser,
      device: form.device,
      authRequired: form.authRequired,
      authConfig: form.authRequired ? {
        loginUrl: form.loginUrl,
        usernameOrEmail: form.username,
        password: form.password,
      } : undefined,
      scope: form.scope,
      projectId: form.projectId,
      workspaceId: ws?.id,
      userId: user?.id,
      autoHealEnabled: true,
    };

    const orch = new AgentOrchestrator(config);
    setOrchestrator(orch);
    setIsRunning(true);
    setEvents([]);
    setReport(null);
    setCurrentPhase("MISSION_CREATED");

    // Live Step Event Listener
    orch.onEvent((event) => {
      setEvents(prev => [...prev, event]);
      setCurrentPhase(event.phase);
    });

    // Human Approval Handler
    orch.setApprovalHandler(async (request) => {
      setPendingApproval(request);
      return new Promise<boolean>((resolve) => {
        approvalResolverRef.current = resolve;
      });
    });

    toast.info("AI QA Mission Launched");

    try {
      const finalReport = await orch.runMission();
      setReport(finalReport);
      toast.success(`Mission Finished: ${finalReport.passed} passed, ${finalReport.bugsCreated} bug(s) filed`);
    } catch (err: any) {
      toast.error(`Mission Failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStopMission = () => {
    if (orchestrator) {
      orchestrator.cancel();
      setIsRunning(false);
      toast.warning("Mission cancelled by operator");
    }
  };

  const resolveApproval = (approved: boolean) => {
    if (approvalResolverRef.current) {
      approvalResolverRef.current(approved);
      approvalResolverRef.current = null;
    }
    setPendingApproval(null);
  };

  const phaseIndex = Math.max(0, PHASE_ORDER.indexOf(currentPhase));
  const progressPercent = Math.min(100, Math.round(((phaseIndex + 1) / PHASE_ORDER.length) * 100));

  return (
    <div className="space-y-6 max-w-7xl pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-hero text-primary-foreground shadow">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">AI QA Mission</h1>
              <p className="text-muted-foreground text-sm">
                Autonomous AI QA Engineer: Plan ➔ Explore ➔ Design ➔ Execute ➔ Observe ➔ Investigate ➔ Report
              </p>
            </div>
          </div>
        </div>

        {/* Runner Status Badge */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRunnerDialogOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs bg-background/50 hover:bg-muted transition-colors cursor-pointer"
          >
            <span className={`h-2 w-2 rounded-full ${runnerStatus.connected ? "bg-success" : "bg-warning animate-pulse"}`} />
            <span className="font-medium">
              Runner: {runnerStatus.connected ? "Connected (CDP/Playwright)" : "Direct Mode (Integration Available)"}
            </span>
            <ExternalLink className="h-3 w-3 text-muted-foreground ml-1" />
          </button>
        </div>
      </div>

      {/* Main Grid: Form vs Active Timeline */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Mission Setup (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-6 bg-gradient-card border-border/80 shadow-elegant">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              Configure Mission
            </h2>

            <div className="space-y-4">
              <div>
                <Label>Mission Name</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Critical Path Regression"
                  disabled={isRunning}
                />
              </div>

              <div>
                <Label>Application Target URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 font-mono text-sm"
                    value={form.targetUrl}
                    onChange={e => setForm({ ...form, targetUrl: e.target.value })}
                    placeholder="https://app.example.com"
                    disabled={isRunning}
                  />
                </div>
              </div>

              <div>
                <Label>Testing Objective</Label>
                <Textarea
                  rows={3}
                  value={form.objective}
                  onChange={e => setForm({ ...form, objective: e.target.value })}
                  placeholder="e.g. Test user authentication, login validation errors, and profile updating."
                  disabled={isRunning}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Environment</Label>
                  <Select
                    value={form.environment}
                    onValueChange={(v: any) => setForm({ ...form, environment: v })}
                    disabled={isRunning}
                  >
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Dev</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Prod</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Browser</Label>
                  <Select
                    value={form.browser}
                    onValueChange={(v: any) => setForm({ ...form, browser: v })}
                    disabled={isRunning}
                  >
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chrome">Chrome</SelectItem>
                      <SelectItem value="firefox">Firefox</SelectItem>
                      <SelectItem value="safari">Safari</SelectItem>
                      <SelectItem value="edge">Edge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Device</Label>
                  <Select
                    value={form.device}
                    onValueChange={(v: any) => setForm({ ...form, device: v })}
                    disabled={isRunning}
                  >
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Scope Checkboxes */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Testing Scope</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {SCOPE_OPTIONS.map(opt => (
                    <div
                      key={opt.id}
                      onClick={() => !isRunning && toggleScope(opt.id)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2 ${
                        form.scope.includes(opt.id)
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 hover:border-border text-muted-foreground"
                      }`}
                    >
                      <Checkbox checked={form.scope.includes(opt.id)} className="mt-0.5" />
                      <div>
                        <div className="font-medium leading-none">{opt.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Authentication Toggle */}
              <div className="border rounded-lg p-3 space-y-3 bg-background/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Authentication Required</Label>
                    <p className="text-xs text-muted-foreground">Log in before running protected flows</p>
                  </div>
                  <Switch
                    checked={form.authRequired}
                    onCheckedChange={c => setForm({ ...form, authRequired: c })}
                    disabled={isRunning}
                  />
                </div>

                {form.authRequired && (
                  <div className="space-y-2 pt-2 border-t text-xs">
                    <div>
                      <Label className="text-[11px]">Login URL</Label>
                      <Input
                        value={form.loginUrl}
                        onChange={e => setForm({ ...form, loginUrl: e.target.value })}
                        placeholder="https://app.example.com/login"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px]">Username / Email</Label>
                        <Input
                          value={form.username}
                          onChange={e => setForm({ ...form, username: e.target.value })}
                          placeholder="qa@testflow.ai"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Password / Token</Label>
                        <Input
                          type="password"
                          value={form.password}
                          onChange={e => setForm({ ...form, password: e.target.value })}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Project Linkage */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Save to Project</Label>
                  <Select
                    value={form.projectId}
                    onValueChange={v => setForm({ ...form, projectId: v })}
                    disabled={isRunning}
                  >
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Scenario Generation</Label>
                  <div className="h-9 px-3 border rounded-md bg-primary/5 border-primary/20 flex items-center gap-2 text-xs font-medium text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
                    <span className="truncate">Auto (Discovered Footprint)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                {!isRunning ? (
                  <Button
                    onClick={handleStartMission}
                    className="w-full bg-gradient-hero border-0 shadow-md hover:opacity-95 gap-2 py-6 text-base font-semibold"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    Start QA Mission
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopMission}
                    variant="destructive"
                    className="w-full gap-2 py-6 text-base font-semibold"
                  >
                    <Square className="h-5 w-5 fill-current" />
                    Cancel Mission
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Real-Time Agent Stream & Report (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Phase Bar */}
          <Card className="p-4 bg-gradient-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className={`h-4 w-4 ${isRunning ? "text-primary animate-spin" : "text-muted-foreground"}`} />
                <span className="text-sm font-semibold">
                  Agent Lifecycle: <span className="text-primary">{currentPhase.replace(/_/g, " ")}</span>
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {progressPercent}% Complete
              </Badge>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </Card>

          {/* Results Tabs: Activity Timeline vs Scenarios vs Report */}
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="timeline" className="gap-1.5 text-xs">
                <Terminal className="h-3.5 w-3.5" />
                Live Activity
                {events.length > 0 && <span className="text-[10px] ml-1 opacity-70">({events.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="scenarios" className="gap-1.5 text-xs">
                <Layers className="h-3.5 w-3.5" />
                Scenarios
                {orchestrator?.scenarios.length ? <span className="text-[10px] ml-1 opacity-70">({orchestrator.scenarios.length})</span> : null}
              </TabsTrigger>
              <TabsTrigger value="bugs" className="gap-1.5 text-xs">
                <Bug className="h-3.5 w-3.5" />
                Bugs
                {report?.bugsCreated ? <Badge variant="destructive" className="h-4 px-1 text-[9px] ml-1">{report.bugsCreated}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger value="report" className="gap-1.5 text-xs">
                <FileCheck className="h-3.5 w-3.5" />
                QA Report
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Live Activity Timeline */}
            <TabsContent value="timeline" className="mt-4">
              <Card className="p-4 h-[540px] flex flex-col justify-between bg-card/60 backdrop-blur-sm">
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 font-mono text-xs">
                  {events.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center space-y-2">
                      <Cpu className="h-10 w-10 stroke-1 opacity-40 animate-pulse" />
                      <p className="font-sans font-medium">Ready to deploy autonomous QA engineer.</p>
                      <p className="text-xs opacity-75 max-w-sm">Configure your application URL and click "Start QA Mission" to begin automated planning, discovery, and execution.</p>
                    </div>
                  ) : (
                    events.map((ev) => (
                      <div
                        key={ev.id}
                        className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition-all ${
                          ev.status === "failed"
                            ? "bg-destructive/10 border-destructive/30 text-destructive-foreground"
                            : ev.status === "warning"
                            ? "bg-warning/10 border-warning/30"
                            : ev.status === "running"
                            ? "bg-primary/10 border-primary/30 animate-pulse"
                            : "bg-background/80 border-border/60"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {ev.status === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                          {ev.status === "failed" && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                          {ev.status === "warning" && <AlertCircle className="h-3.5 w-3.5 text-warning" />}
                          {ev.status === "running" && <Activity className="h-3.5 w-3.5 text-primary animate-spin" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-primary text-[11px]">[{ev.agent}]</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(ev.timestamp).toLocaleTimeString()}
                              {ev.durationMs ? ` (${ev.durationMs}ms)` : ""}
                            </span>
                          </div>
                          <p className="text-foreground mt-0.5 break-words font-sans text-xs">{ev.action}</p>
                          {ev.observedState && (
                            <p className="text-[11px] text-muted-foreground mt-1 bg-muted/30 p-1 rounded font-mono">
                              Observed: {ev.observedState}
                            </p>
                          )}
                          {ev.error && (
                            <p className="text-[11px] text-destructive mt-1 font-mono">
                              Error: {ev.error}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={timelineEndRef} />
                </div>

                <div className="pt-2 border-t text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Stream: {events.length} agent steps recorded</span>
                  {isRunning && <span className="flex items-center gap-1 text-primary animate-pulse">● Live execution active</span>}
                </div>
              </Card>
            </TabsContent>

            {/* TAB 2: Scenarios */}
            <TabsContent value="scenarios" className="mt-4">
              <Card className="p-4 h-[540px] overflow-y-auto space-y-3">
                {orchestrator?.scenarios.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No scenarios generated yet. Start a mission to generate atomic test suites.</p>
                  </div>
                ) : (
                  orchestrator?.scenarios.map((scen, sIdx) => (
                    <div key={scen.id} className="p-4 rounded-lg border bg-background/60 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">{scen.category}</Badge>
                          <h4 className="font-semibold text-sm">{scen.title}</h4>
                        </div>
                        <Badge
                          variant={
                            scen.status === "passed" ? "default" :
                            scen.status === "failed" ? "destructive" :
                            scen.status === "running" ? "secondary" : "outline"
                          }
                          className="capitalize text-[10px]"
                        >
                          {scen.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Preconditions: {scen.preconditions}</p>
                      <div className="space-y-1 mt-2">
                        {scen.steps.map((st) => (
                          <div key={st.stepNumber} className="text-xs flex items-center gap-2 text-muted-foreground">
                            <span className="font-mono text-[10px]">{st.stepNumber}.</span>
                            <span>{st.action}</span>
                          </div>
                        ))}
                      </div>
                      {scen.actualResult && (
                        <div className="flex items-center justify-between text-xs p-2 rounded bg-muted/40 mt-2">
                          <span className="font-mono text-foreground truncate max-w-md">Result: {scen.actualResult}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] gap-1 text-primary hover:text-primary"
                            onClick={() => setActiveEvidence({
                              title: scen.title,
                              url: form.targetUrl,
                              browser: form.browser,
                              device: form.device,
                              durationMs: scen.executionDurationMs,
                              domSnapshot: scen.actualResult,
                              screenshotUrl: scen.screenshotUrl,
                              testCaseId: scen.id,
                            })}
                          >
                            Inspect Evidence
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </Card>
            </TabsContent>

            {/* TAB 3: Bugs */}
            <TabsContent value="bugs" className="mt-4">
              <Card className="p-4 h-[540px] overflow-y-auto space-y-3">
                {orchestrator?.investigations.filter(i => i.isConfirmed).length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success opacity-80" />
                    <p className="font-medium text-foreground">No confirmed defects discovered yet.</p>
                    <p className="text-xs mt-1">When test steps fail, the AI Bug Investigator triages the issue, reproduces it, and records confirmed bugs here.</p>
                  </div>
                ) : (
                  orchestrator?.investigations.filter(i => i.isConfirmed).map((inv, idx) => (
                    <div key={idx} className="p-4 rounded-lg border border-destructive/40 bg-destructive/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="destructive" className="text-[10px] uppercase font-mono">
                          {inv.classification} ({inv.confidence}% confidence)
                        </Badge>
                        <span className="text-xs text-muted-foreground">Reproduction: {inv.reproductionSuccesses}/{inv.reproductionAttempts}</span>
                      </div>
                      <h4 className="font-semibold text-sm text-foreground">{inv.suggestedBugReport?.title}</h4>
                      <p className="text-xs text-muted-foreground">{inv.rootCauseHypothesis}</p>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">Severity: {inv.suggestedBugReport?.severity?.toUpperCase()}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => setActiveEvidence({
                              title: inv.suggestedBugReport?.title || "Defect Evidence",
                              url: form.targetUrl,
                              browser: form.browser,
                              device: form.device,
                              consoleErrors: inv.evidence.consoleErrors,
                              networkFailures: inv.evidence.networkFailures,
                              domSnapshot: inv.evidence.domSnapshot,
                              screenshotUrl: inv.evidence.screenshotUrl,
                              testCaseId: inv.scenarioId,
                            })}
                          >
                            Inspect Evidence
                          </Button>
                        </div>
                        <Link to="/app/bugs" className="text-xs text-primary hover:underline font-medium">
                          View in Bugs module →
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </TabsContent>

            {/* TAB 4: QA Executive Report */}
            <TabsContent value="report" className="mt-4">
              <Card className="p-6 h-[540px] overflow-y-auto space-y-5 bg-background">
                {!report ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <FileCheck className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>Report will be generated upon mission completion.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border-b pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold">{report.missionName}</h3>
                        <p className="text-xs text-muted-foreground">Target: {report.targetUrl} · Duration: {report.durationSeconds}s</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {report.passed}/{report.testsExecuted} Passed
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2.5 rounded-lg border bg-muted/20">
                        <div className="text-2xl font-bold text-success">{report.passed}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Passed</div>
                      </div>
                      <div className="p-2.5 rounded-lg border bg-muted/20">
                        <div className="text-2xl font-bold text-destructive">{report.failed}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Failed</div>
                      </div>
                      <div className="p-2.5 rounded-lg border bg-muted/20">
                        <div className="text-2xl font-bold text-warning">{report.selfHealed}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Self-Healed</div>
                      </div>
                      <div className="p-2.5 rounded-lg border bg-muted/20">
                        <div className="text-2xl font-bold text-primary">{report.bugsCreated}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Bugs Filed</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">AI Executive Findings</h4>
                      <div className="p-3 rounded-lg border bg-muted/20 text-xs leading-relaxed font-sans">
                        {report.aiAnalysis}
                      </div>
                    </div>

                    {report.findings.highRiskAreas.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-destructive">Identified Risk Areas</h4>
                        <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                          {report.findings.highRiskAreas.map((area, i) => (
                            <li key={i}>{area}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Recommendations</h4>
                      <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                        {report.findings.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* HUMAN APPROVAL MODAL (Section 21) */}
      <Dialog open={Boolean(pendingApproval)} onOpenChange={(open) => !open && resolveApproval(false)}>
        <DialogContent className="max-w-md border-warning/40">
          <DialogHeader>
            <div className="flex items-center gap-2 text-warning mb-1">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle className="text-foreground">Human Approval Required</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              The autonomous agent paused execution before performing a high-risk operation.
            </DialogDescription>
          </DialogHeader>

          {pendingApproval && (
            <div className="space-y-3 py-2 text-xs">
              <div>
                <span className="font-semibold text-muted-foreground">Action:</span>
                <p className="font-mono bg-muted/40 p-2 rounded mt-1">{pendingApproval.action}</p>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Reason:</span>
                <p className="mt-0.5 text-foreground">{pendingApproval.reason}</p>
              </div>
              <div>
                <span className="font-semibold text-destructive">Potential Impact:</span>
                <p className="mt-0.5 text-muted-foreground">{pendingApproval.potentialImpact}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => resolveApproval(false)}>
              Reject Action
            </Button>
            <Button size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90" onClick={() => resolveApproval(true)}>
              Approve & Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BROWSER RUNNER CONFIGURATION DIALOG */}
      <Dialog open={runnerDialogOpen} onOpenChange={setRunnerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              Browser Runner Configuration
            </DialogTitle>
            <DialogDescription className="text-xs">
              Connect a real Playwright / Chrome DevTools Protocol (CDP) headless runner for raster screenshots and full cross-origin DOM interaction.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-xs">Runner Endpoint URL</Label>
              <Input
                value={runnerUrlInput}
                onChange={e => setRunnerUrlInput(e.target.value)}
                placeholder="http://localhost:9222"
                className="font-mono mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Default: <code>http://localhost:9222</code> (Chrome remote debugging) or custom Playwright server.
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
              <div className="font-medium text-foreground">How to launch the built-in browser runner:</div>
              <div className="text-[11px] text-muted-foreground">
                Open a new terminal in your project directory and run:
              </div>
              <code className="block bg-background p-2 rounded text-[12px] font-mono text-primary font-semibold select-all border">
                npm run runner
              </code>
              <p className="text-[11px] text-muted-foreground">
                This automatically opens Chrome/Edge in CDP automation mode and binds to <code>http://localhost:9222</code> for real clicks, typing, and screenshots.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRunnerDialogOpen(false)}>Close</Button>
            <Button
              size="sm"
              onClick={async () => {
                browserBridge.setEndpoint(runnerUrlInput);
                const s = await browserBridge.checkConnection();
                setRunnerStatus(s);
                if (s.connected) toast.success("Browser runner connected!");
                else toast.warning("Saved. Runner unreachable at that address currently.");
                setRunnerDialogOpen(false);
              }}
            >
              Save & Test Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EVIDENCE CENTER MODAL (Section 14) */}
      <EvidenceModal
        open={Boolean(activeEvidence)}
        onOpenChange={(open) => !open && setActiveEvidence(null)}
        evidence={activeEvidence}
      />
    </div>
  );
}
