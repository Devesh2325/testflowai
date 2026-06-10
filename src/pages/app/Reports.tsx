import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, TrendingUp, Bug as BugIcon, CheckCircle2, XCircle, Ban, Clock, FileSpreadsheet, FileText, AlertTriangle } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = { pass: "hsl(var(--success))", fail: "hsl(var(--destructive))", blocked: "hsl(var(--warning))", not_run: "hsl(var(--muted-foreground))" };

type Flaky = { id: string; title: string; runs: number; passes: number; fails: number; flipRate: number };

export default function Reports() {
  const [exec, setExec] = useState<{ pass: number; fail: number; blocked: number; not_run: number }>({ pass: 0, fail: 0, blocked: 0, not_run: 0 });
  const [bugs, setBugs] = useState<{ status: string; count: number }[]>([]);
  const [bySeverity, setBySeverity] = useState<{ severity: string; count: number }[]>([]);
  const [flaky, setFlaky] = useState<Flaky[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: b }, { data: tc }] = await Promise.all([
        supabase.from("test_executions").select("status,test_case_id,executed_at,created_at").order("created_at"),
        supabase.from("bugs").select("status,severity"),
        supabase.from("test_cases").select("id,title"),
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

      // Flaky detector — tests with ≥3 executions that produced BOTH pass and fail
      const tcMap = new Map<string, string>((tc ?? []).map((t: any) => [t.id, t.title]));
      const byTC = new Map<string, { status: string }[]>();
      (e ?? []).forEach((r: any) => {
        if (r.status === "not_run") return;
        if (!byTC.has(r.test_case_id)) byTC.set(r.test_case_id, []);
        byTC.get(r.test_case_id)!.push({ status: r.status });
      });
      const flakyList: Flaky[] = [];
      byTC.forEach((rows, id) => {
        const passes = rows.filter(r => r.status === "pass").length;
        const fails = rows.filter(r => r.status === "fail").length;
        if (rows.length >= 3 && passes > 0 && fails > 0) {
          // count status flips between consecutive runs
          let flips = 0;
          for (let i = 1; i < rows.length; i++) if (rows[i].status !== rows[i - 1].status) flips++;
          const flipRate = flips / (rows.length - 1);
          flakyList.push({ id, title: tcMap.get(id) ?? `TC-${id.slice(0, 6)}`, runs: rows.length, passes, fails, flipRate });
        }
      });
      flakyList.sort((a, b) => b.flipRate - a.flipRate);
      setFlaky(flakyList.slice(0, 20));
      setLoading(false);
    })();
  }, []);

  const total = exec.pass + exec.fail + exec.blocked + exec.not_run;
  const passRate = total ? Math.round((exec.pass / Math.max(1, exec.pass + exec.fail + exec.blocked)) * 100) : 0;
  const pieData = useMemo(() => [
    { name: "Pass", value: exec.pass, color: COLORS.pass },
    { name: "Fail", value: exec.fail, color: COLORS.fail },
    { name: "Blocked", value: exec.blocked, color: COLORS.blocked },
    { name: "Not Run", value: exec.not_run, color: COLORS.not_run },
  ].filter(d => d.value > 0), [exec]);

  const reportRows = () => [
    ["Pass", exec.pass], ["Fail", exec.fail], ["Blocked", exec.blocked], ["Not Run", exec.not_run],
    ["Pass Rate %", passRate],
    ...bugs.map(b => [`Bugs: ${b.status}`, b.count]),
    ...bySeverity.map(b => [`Severity: ${b.severity}`, b.count]),
  ] as (string | number)[][];

  const exportCSV = () => {
    const rows = [["Metric", "Value"], ...reportRows()];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `testflow-report-${stamp()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Metric", "Value"], ...reportRows()]), "Summary");
    if (flaky.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flaky.map(f => ({
        TestCase: f.title, Runs: f.runs, Passes: f.passes, Fails: f.fails, "Flip Rate %": Math.round(f.flipRate * 100),
      }))), "Flaky Tests");
    }
    XLSX.writeFile(wb, `testflow-report-${stamp()}.xlsx`);
    toast.success("Excel exported");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("TestFlow QA Report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 25);
    doc.setTextColor(0);
    autoTable(doc, {
      head: [["Metric", "Value"]],
      body: reportRows().map(r => r.map(String)),
      startY: 32,
      headStyles: { fillColor: [99, 102, 241] },
    });
    if (flaky.length) {
      const endY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(13);
      doc.text("Flaky tests (high flip rate)", 14, endY);
      autoTable(doc, {
        head: [["Test case", "Runs", "Pass", "Fail", "Flip %"]],
        body: flaky.map(f => [f.title, f.runs, f.passes, f.fails, `${Math.round(f.flipRate * 100)}%`]),
        startY: endY + 4,
        headStyles: { fillColor: [220, 38, 38] },
      });
    }
    doc.save(`testflow-report-${stamp()}.pdf`);
    toast.success("PDF exported");
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
          <p className="text-muted-foreground">Live insights, flaky test detection, and exportable reports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCSV} variant="outline" className="gap-2"><Download className="h-4 w-4" />CSV</Button>
          <Button onClick={exportXLSX} variant="outline" className="gap-2"><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button onClick={exportPDF} className="gap-2 bg-gradient-hero border-0"><FileText className="h-4 w-4" />PDF</Button>
        </div>
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
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h3 className="font-semibold">Flaky test detector</h3>
          <Badge variant="secondary" className="text-[10px]">AI · auto</Badge>
          <span className="ml-auto text-xs text-muted-foreground">Tests that flip between pass/fail across runs</span>
        </div>
        {flaky.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No flaky tests detected. Need ≥3 executions per test with mixed outcomes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3">Test case</th>
                  <th className="py-2 pr-3">Runs</th>
                  <th className="py-2 pr-3">Pass</th>
                  <th className="py-2 pr-3">Fail</th>
                  <th className="py-2 pr-3">Flip rate</th>
                  <th className="py-2 pr-3">Severity</th>
                </tr>
              </thead>
              <tbody>
                {flaky.map(f => {
                  const pct = Math.round(f.flipRate * 100);
                  const sev = pct >= 60 ? "Critical" : pct >= 35 ? "High" : "Medium";
                  const sevClass = pct >= 60 ? "bg-destructive/15 text-destructive border-destructive/30"
                    : pct >= 35 ? "bg-warning/15 text-warning border-warning/30"
                    : "bg-primary/15 text-primary border-primary/30";
                  return (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium">{f.title}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{f.runs}</td>
                      <td className="py-2 pr-3 text-success">{f.passes}</td>
                      <td className="py-2 pr-3 text-destructive">{f.fails}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-warning" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs tabular-nums">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3"><Badge variant="outline" className={sevClass}>{sev}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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

const stamp = () => new Date().toISOString().slice(0, 10);
