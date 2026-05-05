import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  FileText, PlayCircle, Bug, FolderKanban, TrendingUp, Shield, Activity, Sparkles
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

type Stats = { projects: number; testCases: number; runs: number; bugs: number; openBugs: number; passRate: number };

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ projects: 0, testCases: 0, runs: 0, bugs: 0, openBugs: 0, passRate: 0 });

  useEffect(() => {
    (async () => {
      const [p, tc, r, b, ob, ex] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("test_cases").select("id", { count: "exact", head: true }),
        supabase.from("test_runs").select("id", { count: "exact", head: true }),
        supabase.from("bugs").select("id", { count: "exact", head: true }),
        supabase.from("bugs").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "reopened"]),
        supabase.from("test_executions").select("status"),
      ]);
      const all = ex.data ?? [];
      const passed = all.filter(e => e.status === "pass").length;
      const total = all.filter(e => e.status !== "not_run").length;
      setStats({
        projects: p.count ?? 0, testCases: tc.count ?? 0, runs: r.count ?? 0,
        bugs: b.count ?? 0, openBugs: ob.count ?? 0,
        passRate: total ? Math.round((passed / total) * 100) : 0,
      });
    })();
  }, []);

  const readiness = Math.max(0, Math.min(100, stats.passRate - stats.openBugs * 3));

  const cards = [
    { label: "Projects", value: stats.projects, icon: FolderKanban, color: "text-primary", to: "/app/projects" },
    { label: "Test Cases", value: stats.testCases, icon: FileText, color: "text-accent", to: "/app/test-cases" },
    { label: "Test Runs", value: stats.runs, icon: PlayCircle, color: "text-success", to: "/app/test-runs" },
    { label: "Open Bugs", value: stats.openBugs, icon: Bug, color: "text-destructive", to: "/app/bugs" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back 👋</h1>
        <p className="text-muted-foreground mt-1">{user?.email} — here's your testing pulse.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Link key={c.label} to={c.to}>
            <Card className="p-5 hover:shadow-elegant transition-all hover:-translate-y-0.5 bg-gradient-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="text-3xl font-bold">{c.value}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2 bg-gradient-hero text-primary-foreground border-0 shadow-elegant relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_70%_30%,white,transparent_50%)]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4" />
              <span className="text-sm opacity-90">AI Release Readiness</span>
            </div>
            <div className="text-5xl font-bold mb-3">{readiness}%</div>
            <Progress value={readiness} className="bg-white/20" />
            <p className="mt-4 text-sm opacity-90">
              {readiness >= 80 ? "Strong signals — ready to ship." : readiness >= 50 ? "Moderate risk — review failing areas." : "High risk — stabilize before release."}
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="font-medium">Pass rate</span>
          </div>
          <div className="text-4xl font-bold mb-2">{stats.passRate}%</div>
          <Progress value={stats.passRate} />
          <div className="mt-4 text-xs text-muted-foreground">Across all executed test cases</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">High-risk modules</h3>
            <Badge variant="secondary" className="ml-auto text-[10px]">AI</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Once you log a few runs, AI will surface modules with rising failure rates here.</p>
        </Card>
        <Card className="p-6 bg-gradient-card">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Quick start with AI</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Generate your first 5 test cases from a simple requirement.</p>
          <Link to="/app/ai" className="text-sm font-medium text-primary hover:underline">Open AI Assistant →</Link>
        </Card>
      </div>
    </div>
  );
}
