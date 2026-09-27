import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, TrendingUp, Bug, PlayCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

export default function ReleaseReadiness() {
  const { current: ws } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    score: number;
    verdict: string;
    factors: { label: string; impact: "positive" | "warning" | "negative"; detail: string }[];
    totalTests: number;
    passRate: number;
    openBugs: number;
    criticalBugs: number;
    highBugs: number;
  }>({
    score: 0,
    verdict: "Analyzing...",
    factors: [],
    totalTests: 0,
    passRate: 0,
    openBugs: 0,
    criticalBugs: 0,
    highBugs: 0,
  });

  const analyzeReadiness = async () => {
    setLoading(true);
    const [bugsRes, execsRes, runsRes] = await Promise.all([
      supabase.from("bugs").select("id, title, severity, priority, status"),
      supabase.from("test_executions").select("status, executed_at"),
      supabase.from("test_runs").select("id, status, created_at").limit(10),
    ]);

    const bugs = bugsRes.data ?? [];
    const execs = execsRes.data ?? [];
    const openBugs = bugs.filter(b => ["open", "in_progress", "reopened"].includes(b.status));
    const criticalBugs = openBugs.filter(b => b.severity === "critical");
    const highBugs = openBugs.filter(b => b.severity === "high" || b.priority === "urgent");

    const passed = execs.filter(e => e.status === "pass").length;
    const executed = execs.filter(e => e.status !== "not_run").length;
    const passRate = executed ? Math.round((passed / executed) * 100) : 0;

    // Multi-factor grounded scoring (Section 23)
    const factors: { label: string; impact: "positive" | "warning" | "negative"; detail: string }[] = [];
    let deduction = 0;

    if (criticalBugs.length > 0) {
      deduction += criticalBugs.length * 25;
      factors.push({
        label: "Blocker Defects",
        impact: "negative",
        detail: `${criticalBugs.length} critical severity bug(s) remain open. Release is blocked until resolved.`,
      });
    }

    if (highBugs.length > 0) {
      deduction += highBugs.length * 10;
      factors.push({
        label: "High Priority Bugs",
        impact: "warning",
        detail: `${highBugs.length} high priority bug(s) active in workspace.`,
      });
    }

    if (passRate >= 90) {
      factors.push({
        label: "High Test Pass Rate",
        impact: "positive",
        detail: `Pass rate stands strong at ${passRate}% across ${executed} recorded executions.`,
      });
    } else if (passRate >= 70) {
      deduction += 15;
      factors.push({
        label: "Sub-Optimal Pass Rate",
        impact: "warning",
        detail: `Pass rate is ${passRate}%. Target is 90%+ for confident production release.`,
      });
    } else {
      deduction += 35;
      factors.push({
        label: "Failing Test Executions",
        impact: "negative",
        detail: `Pass rate is low (${passRate}%). Multiple test scenarios failing.`,
      });
    }

    if (executed === 0) {
      deduction += 30;
      factors.push({
        label: "Zero Executions",
        impact: "negative",
        detail: "No active test executions logged. Run a QA Mission to establish verification data.",
      });
    }

    const calculatedScore = Math.max(0, Math.min(100, 100 - deduction));
    const verdict =
      calculatedScore >= 85
        ? "Release Ready — High Confidence"
        : calculatedScore >= 60
        ? "Release Requires Attention — Moderate Risk"
        : "Release Blocked — Critical Risks Detected";

    setData({
      score: calculatedScore,
      verdict,
      factors,
      totalTests: executed,
      passRate,
      openBugs: openBugs.length,
      criticalBugs: criticalBugs.length,
      highBugs: highBugs.length,
    });
    setLoading(false);
  };

  useEffect(() => {
    analyzeReadiness();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            AI Release Readiness
          </h1>
          <p className="text-muted-foreground">
            Multi-factor release health grounded in actual test executions, defect severities, and regression coverage.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={analyzeReadiness} className="gap-2 self-start">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Recalculate Readiness
        </Button>
      </div>

      {/* Main Readiness Gauge */}
      <Card className="p-8 bg-gradient-hero text-primary-foreground border-0 shadow-elegant relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_70%_30%,white,transparent_50%)]" />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <Badge variant="outline" className="border-white/30 text-white bg-white/10 uppercase tracking-widest text-[10px]">
              Grounded AI Verdict
            </Badge>
            <h2 className="text-3xl font-extrabold">{data.verdict}</h2>
            <p className="text-sm opacity-90 max-w-xl">
              Calculated across {data.totalTests} executed tests, {data.openBugs} open defects, and active blocker severity ratings.
            </p>
          </div>

          <div className="text-center bg-black/20 p-6 rounded-2xl border border-white/15 backdrop-blur-sm min-w-44">
            <div className="text-6xl font-extrabold tracking-tight">{data.score}%</div>
            <span className="text-xs uppercase tracking-wider opacity-80 mt-1 block">Readiness Score</span>
          </div>
        </div>
      </Card>

      {/* Breakdown Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-card">
          <span className="text-xs text-muted-foreground">Pass Rate</span>
          <div className="text-3xl font-bold mt-1 text-success">{data.passRate}%</div>
        </Card>
        <Card className="p-4 bg-gradient-card">
          <span className="text-xs text-muted-foreground">Tests Executed</span>
          <div className="text-3xl font-bold mt-1">{data.totalTests}</div>
        </Card>
        <Card className="p-4 bg-gradient-card">
          <span className="text-xs text-muted-foreground">Open Defects</span>
          <div className="text-3xl font-bold mt-1 text-destructive">{data.openBugs}</div>
        </Card>
        <Card className="p-4 bg-gradient-card">
          <span className="text-xs text-muted-foreground">Critical Blockers</span>
          <div className="text-3xl font-bold mt-1 text-destructive">{data.criticalBugs}</div>
        </Card>
      </div>

      {/* Explanatory Factors (Section 23 Requirement) */}
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Factor Breakdown & Why It Matters
        </h3>

        <div className="space-y-3">
          {data.factors.map((f, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg border flex items-start gap-3 ${
                f.impact === "negative"
                  ? "bg-destructive/5 border-destructive/30"
                  : f.impact === "warning"
                  ? "bg-warning/5 border-warning/30"
                  : "bg-success/5 border-success/30"
              }`}
            >
              <div className="mt-0.5">
                {f.impact === "negative" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                {f.impact === "warning" && <AlertTriangle className="h-4 w-4 text-warning" />}
                {f.impact === "positive" && <CheckCircle2 className="h-4 w-4 text-success" />}
              </div>
              <div>
                <h4 className="font-semibold text-sm">{f.label}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
