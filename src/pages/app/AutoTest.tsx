import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Play, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AgentOrchestrator, MissionConfig, QAMissionReport } from "@/services/agent";

export default function AutoTest() {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<QAMissionReport | null>(null);

  const runQuickTest = async () => {
    if (!url.trim()) return toast.error("Enter a valid URL");
    setLoading(true);
    setReport(null);

    const config: MissionConfig = {
      id: `auto_${Date.now()}`,
      name: `Auto Test: ${new URL(url).hostname}`,
      targetUrl: url,
      objective: "Quick automated smoke test of main view and core interactive controls",
      environment: "staging",
      browser: "chrome",
      device: "desktop",
      authRequired: false,
      scope: ["functional", "ui", "responsive"],
      maxTestCases: 3,
    };

    const orch = new AgentOrchestrator(config);
    try {
      const res = await orch.runMission();
      setReport(res);
      toast.success("Auto Test Completed");
    } catch (e: any) {
      toast.error(`Auto Test failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Globe className="h-7 w-7 text-primary" />
          Auto Test (URL)
        </h1>
        <p className="text-muted-foreground">
          Instant autonomous smoke testing: enter any accessible URL and let the agent plan, explore, and verify basic stability in seconds.
        </p>
      </div>

      <Card className="p-6 bg-gradient-card space-y-4">
        <div className="space-y-2">
          <Label>Target URL to Test</Label>
          <div className="flex gap-3">
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={loading}
              className="font-mono text-sm"
            />
            <Button
              onClick={runQuickTest}
              disabled={loading}
              className="bg-gradient-hero border-0 gap-2 px-6 shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              {loading ? "Testing..." : "Auto Test URL"}
            </Button>
          </div>
        </div>
      </Card>

      {report && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-lg font-bold">{report.missionName}</h3>
              <p className="text-xs text-muted-foreground">Duration: {report.durationSeconds}s · URL: {report.targetUrl}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {report.passed}/{report.testsExecuted} Passed
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 border rounded-lg bg-muted/20">
              <div className="text-2xl font-bold text-success">{report.passed}</div>
              <div className="text-xs text-muted-foreground">Passed</div>
            </div>
            <div className="p-3 border rounded-lg bg-muted/20">
              <div className="text-2xl font-bold text-destructive">{report.failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="p-3 border rounded-lg bg-muted/20">
              <div className="text-2xl font-bold text-primary">{report.bugsCreated}</div>
              <div className="text-xs text-muted-foreground">Bugs Discovered</div>
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-muted/20 text-xs">
            <div className="font-semibold mb-1">Executive Summary:</div>
            <p className="text-muted-foreground leading-relaxed">{report.aiAnalysis}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
