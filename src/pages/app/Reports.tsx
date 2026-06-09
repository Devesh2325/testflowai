import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, TrendingUp, Bug as BugIcon, CheckCircle2, XCircle, Ban, Clock } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";

const COLORS = { pass: "hsl(var(--success))", fail: "hsl(var(--destructive))", blocked: "hsl(var(--warning))", not_run: "hsl(var(--muted-foreground))" };

export default function Reports() {
  const [exec, setExec] = useState<{ pass: number; fail: number; blocked: number; not_run: number }>({ pass: 0, fail: 0, blocked: 0, not_run: 0 });
  const [bugs, setBugs] = useState<{ status: string; count: number }[]>([]);
  const [bySeverity, setBySeverity] = useState<{ severity: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: b }] = await Promise.all([
        supabase.from("test_executions").select("status"),
        supabase.from("bugs").select("status,severity"),
      ]);
      const ex = { pass: 0, fail: 0, blocked: 0, not_run: 0 };
      (e ?? []).forEach((r: any) => { ex[r.status as keyof typeof ex] = (ex[r.status as keyof typeof ex] ?? 0) + 1; });
      setExec(ex);

      const sMap: Record<string, number> = {};
      const vMap: Record<string, number> = {};
      (b ?? []).forEach((r: any) => {
        sMap[r.status] = (sMap[r.status] ?? 0) + 1;
        vMap[r.severity] = (vMap[r.severity] ?? 0) + 1;
      });
      setBugs(Object.entries(sMap).map(([status, count]) => ({ status, count })));
      setBySeverity(Object.entries(vMap).map(([severity, count]) => ({ severity, count })));
      setLoading(false);
    })();
  }, []);

  const total = exec.pass + exec.fail + exec.blocked + exec.not_run;
  const passRate = total ? Math.round((exec.pass / Math.max(1, exec.pass + exec.fail + exec.blocked)) * 100) : 0;
  const pieData = [
    { name: "Pass", value: exec.pass, color: COLORS.pass },
    { name: "Fail", value: exec.fail, color: COLORS.fail },
    { name: "Blocked", value: exec.blocked, color: COLORS.blocked },
    { name: "Not Run", value: exec.not_run, color: COLORS.not_run },
  ].filter(d => d.value > 0);

  const exportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      ["Pass", exec.pass], ["Fail", exec.fail], ["Blocked", exec.blocked], ["Not Run", exec.not_run],
      ["Pass Rate %", passRate],
      ...bugs.map(b => [`Bugs: ${b.status}`, b.count]),
      ...bySeverity.map(b => [`Severity: ${b.severity}`, b.count]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `testflow-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  const stats = [
    { label: "Pass Rate", value: `${passRate}%`, icon: TrendingUp, color: "text-success" },
    { label: "Passed", value: exec.pass, icon: CheckCircle2, color: "text-success" },
    { label: "Failed", value: exec.fail, icon: XCircle, color: "text-destructive" },
    { label: "Blocked", value: exec.blocked, icon: Ban, color: "text-warning" },
    { label: "Not Run", value: exec.not_run, icon: Clock, color: "text-muted-foreground" },
    { label: "Total Bugs", value: bugs.reduce((s, b) => s + b.count, 0), icon: BugIcon, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><BarChart3 className="h-7 w-7 text-primary" />Reports</h1>
          <p className="text-muted-foreground">Live insights from your test executions and bugs.</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2"><Download className="h-4 w-4" />Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="p-4 bg-gradient-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Execution outcomes</h3>
          {pieData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No execution data yet. Run a test to see charts.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }} itemStyle={{ color: "hsl(var(--popover-foreground))" }} labelStyle={{ color: "hsl(var(--popover-foreground))" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Bugs by severity</h3>
          {bySeverity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No bugs logged yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bySeverity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="severity" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }} itemStyle={{ color: "hsl(var(--popover-foreground))" }} labelStyle={{ color: "hsl(var(--popover-foreground))" }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Bugs by status</h3>
        {bugs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bugs to report.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bugs.map(b => (
              <Badge key={b.status} variant="secondary" className="text-sm py-1.5 px-3">
                {b.status.replace("_", " ")}: <strong className="ml-1">{b.count}</strong>
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
}
